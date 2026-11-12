"""WS /api/ws/rooms/{room_id}: handshake, join, presence, leave, snapshot."""
import uuid

import pytest
from sqlalchemy import text

pytestmark = pytest.mark.integration


async def _seed_code_state(db_session, room_id, content):
    """Insert a room_code_state row the way migration 0004 backfills them."""
    await db_session.execute(
        text(
            "INSERT INTO room_code_state (id, room_id, content) "
            "VALUES (:id, :room_id, :content)"
        ),
        {"id": uuid.uuid7(), "room_id": uuid.UUID(room_id), "content": content},
    )
    await db_session.commit()


def _make_room(ws_client):
    """Owner registers and creates a room; the owner session is cleared."""
    resp = ws_client.post(
        "/api/auth/register",
        json={"name": "Owner", "email": "ws-owner@example.com", "password": "correct-horse"},
    )
    assert resp.status_code == 201
    resp = ws_client.post("/api/rooms", json={"language": "python"})
    assert resp.status_code == 201
    return resp.json()


def _join_anonymously(ws_client, room):
    ws_client.cookies.clear()
    resp = ws_client.post(
        f"/api/rooms/{room['id']}/join",
        json={"code": room["access_code"], "anonymous": True, "nickname": "Anônimo"},
    )
    assert resp.status_code == 200
    return resp.cookies.get("codelive_anon")


def _connect(ws_client, room_id, anon):
    return ws_client.websocket_connect(
        f"/api/ws/rooms/{room_id}",
        headers={"origin": "http://localhost:5173", "cookie": f"codelive_anon={anon}"},
    )


def _join(ws, expected_count):
    """Send join; expect presence first, then the joiner-only snapshot (D-07)."""
    ws.send_json({"type": "join"})
    frame = ws.receive_json()
    assert frame["type"] == "presence"
    assert frame["count"] == expected_count
    snapshot = ws.receive_json()
    assert snapshot["type"] == "snapshot"
    return frame


def test_anonymous_spectator_joins_and_gets_presence(ws_client):
    room = _make_room(ws_client)
    anon = _join_anonymously(ws_client, room)
    assert anon
    with ws_client.websocket_connect(
        f"/api/ws/rooms/{room['id']}",
        headers={"origin": "http://localhost:5173", "cookie": f"codelive_anon={anon}"},
    ) as ws:
        ws.send_json({"type": "join"})
        frame = ws.receive_json()
        assert frame["type"] == "presence"
        assert frame["room_id"] == room["id"]
        assert frame["count"] == 1
        assert frame["role"] == "viewer"
        assert frame["request_id"]
        snapshot = ws.receive_json()
        assert snapshot["type"] == "snapshot"
        assert snapshot["room_id"] == room["id"]


def _two_anon_spectators(ws_client):
    room = _make_room(ws_client)
    anon1 = _join_anonymously(ws_client, room)
    anon2 = _join_anonymously(ws_client, room)
    return room, anon1, anon2


def test_presence_on_clean_leave(ws_client):
    room, anon1, anon2 = _two_anon_spectators(ws_client)
    with _connect(ws_client, room["id"], anon1) as ws1:
        _join(ws1, 1)
        with _connect(ws_client, room["id"], anon2) as ws2:
            _join(ws2, 2)
            assert ws1.receive_json()["count"] == 2
        # ws2 left cleanly; the remaining socket sees the decremented count
        frame = ws1.receive_json()
        assert frame["type"] == "presence"
        assert frame["count"] == 1
        assert frame["role"] == "viewer"
        assert frame["room_id"] == room["id"]


def test_presence_on_abrupt_disconnect(ws_client):
    room, anon1, anon2 = _two_anon_spectators(ws_client)
    with _connect(ws_client, room["id"], anon1) as ws1:
        _join(ws1, 1)
        with _connect(ws_client, room["id"], anon2) as ws2:
            _join(ws2, 2)
            assert ws1.receive_json()["count"] == 2
            ws2.close(code=1006)
        frame = ws1.receive_json()
        assert frame["type"] == "presence"
        assert frame["count"] == 1
        assert frame["role"] == "viewer"


def test_join_publishes_presence_once(ws_client):
    room = _make_room(ws_client)
    anon1 = _join_anonymously(ws_client, room)
    anon2 = _join_anonymously(ws_client, room)
    with _connect(ws_client, room["id"], anon1) as ws1:
        frame1 = _join(ws1, 1)
        assert frame1["request_id"]
        with _connect(ws_client, room["id"], anon2) as ws2:
            ws2.send_json({"type": "join"})
            frame2 = ws2.receive_json()
            assert set(frame2) == {"type", "room_id", "count", "role", "request_id"}
            assert frame2["type"] == "presence"
            assert frame2["count"] == 2
            assert frame2["role"] == "viewer"
            assert frame2["room_id"] == room["id"]
            assert frame2["request_id"]
            # drain ws2's joiner-only snapshot so the socket closes clean
            snapshot2 = ws2.receive_json()
            assert snapshot2["type"] == "snapshot"
            assert snapshot2["room_id"] == room["id"]
            # the room broadcast carries count == 2 to the first socket, exactly once
            frame1b = ws1.receive_json()
            assert frame1b["type"] == "presence"
            assert frame1b["count"] == 2
        # if join had broadcast twice, ws1's next frame would be a duplicate
        # count == 2 instead of the count == 1 decrement from ws2's leave
        frame1c = ws1.receive_json()
        assert frame1c["type"] == "presence"
        assert frame1c["count"] == 1


def test_second_join_is_idempotent(ws_client):
    room = _make_room(ws_client)
    anon1 = _join_anonymously(ws_client, room)
    anon2 = _join_anonymously(ws_client, room)
    with _connect(ws_client, room["id"], anon1) as ws1:
        _join(ws1, 1)
        ws1.send_json({"type": "join"})
        frame = ws1.receive_json()
        assert frame["type"] == "presence"
        assert frame["count"] == 1  # unchanged, not registered twice
        # a third socket joining observes count == 2, proving ws1 is one member
        with _connect(ws_client, room["id"], anon2) as ws2:
            _join(ws2, 2)


# ---------------------------------------------------------------------------
# 03-04: pre-accept denial matrix and refusal semantics (LIVE-01, LIVE-02)
# ---------------------------------------------------------------------------

_ORIGIN = "http://localhost:5173"


def _register(ws_client, email, name="User"):
    resp = ws_client.post(
        "/api/auth/register",
        json={"name": name, "email": email, "password": "correct-horse"},
    )
    assert resp.status_code == 201
    return ws_client.cookies.get("codelive_session")


def _make_room_with_owner(ws_client, email="owner@example.com"):
    owner = _register(ws_client, email, "Owner")
    resp = ws_client.post("/api/rooms", json={"language": "python"})
    assert resp.status_code == 201
    room = resp.json()
    ws_client.cookies.clear()
    return room, owner


def _expect_denial(ws_client, room_id, headers, status, code):
    from starlette.testclient import WebSocketDenialResponse

    with pytest.raises(WebSocketDenialResponse) as exc_info:
        with ws_client.websocket_connect(f"/api/ws/rooms/{room_id}", headers=headers):
            pass
    resp = exc_info.value  # WebSocketDenialResponse is an httpx.Response
    assert resp.status_code == status
    body = resp.json()
    assert body["error"]["code"] == code
    assert body["error"]["request_id"]
    return body


def test_owner_session_accepts_with_owner_role(ws_client):
    room, owner = _make_room_with_owner(ws_client, "ws-own-acc@example.com")
    with ws_client.websocket_connect(
        f"/api/ws/rooms/{room['id']}",
        headers={"origin": _ORIGIN, "cookie": f"codelive_session={owner}"},
    ) as ws:
        frame = _join(ws, 1)
        assert frame["role"] == "owner"


def test_authenticated_viewer_accepts_with_viewer_role(ws_client):
    room, owner = _make_room_with_owner(ws_client, "ws-own-view@example.com")
    viewer = _register(ws_client, "ws-viewer@example.com", "Viewer")
    resp = ws_client.post(
        f"/api/rooms/{room['id']}/join",
        json={"code": room["access_code"]},
        headers={"cookie": f"codelive_session={viewer}"},
    )
    assert resp.status_code == 200
    ws_client.cookies.clear()
    with ws_client.websocket_connect(
        f"/api/ws/rooms/{room['id']}",
        headers={"origin": _ORIGIN, "cookie": f"codelive_session={viewer}"},
    ) as ws:
        frame = _join(ws, 1)  # only the viewer is in the socket room
        assert frame["role"] == "viewer"


def test_no_cookie_is_denied_401(ws_client):
    room, _owner = _make_room_with_owner(ws_client, "ws-nocookie@example.com")
    _expect_denial(ws_client, room["id"], {"origin": _ORIGIN}, 401, "not_authenticated")


def test_forged_session_is_denied_401(ws_client):
    from itsdangerous import URLSafeTimedSerializer

    room, _owner = _make_room_with_owner(ws_client, "ws-forged@example.com")
    forged = URLSafeTimedSerializer("wrong-secret").dumps({"user_id": "x"})
    _expect_denial(
        ws_client,
        room["id"],
        {"origin": _ORIGIN, "cookie": f"codelive_session={forged}"},
        401,
        "not_authenticated",
    )


def test_authenticated_without_membership_is_denied_403(ws_client):
    room, _owner = _make_room_with_owner(ws_client, "ws-nomemb-o@example.com")
    outsider = _register(ws_client, "ws-outsider@example.com", "Outsider")
    ws_client.cookies.clear()
    _expect_denial(
        ws_client,
        room["id"],
        {"origin": _ORIGIN, "cookie": f"codelive_session={outsider}"},
        403,
        "forbidden",
    )


def test_closed_room_is_denied_409(ws_client):
    room, owner = _make_room_with_owner(ws_client, "ws-closed@example.com")
    resp = ws_client.patch(
        f"/api/rooms/{room['id']}/close",
        headers={"cookie": f"codelive_session={owner}", "origin": _ORIGIN},
    )
    assert resp.status_code == 200
    ws_client.cookies.clear()
    _expect_denial(
        ws_client,
        room["id"],
        {"origin": _ORIGIN, "cookie": f"codelive_session={owner}"},
        409,
        "room_closed",
    )


def test_unknown_room_is_denied_404(ws_client):
    import uuid

    _room, owner = _make_room_with_owner(ws_client, "ws-404@example.com")
    _expect_denial(
        ws_client,
        str(uuid.uuid4()),
        {"origin": _ORIGIN, "cookie": f"codelive_session={owner}"},
        404,
        "room_not_found",
    )


def test_missing_origin_is_denied_403(ws_client):
    room, owner = _make_room_with_owner(ws_client, "ws-noorigin@example.com")
    # ws_client carries a default Origin header; build a client without one
    # to exercise the missing-Origin branch of the admission check.
    from starlette.testclient import TestClient, WebSocketDenialResponse

    from app.main import app

    with TestClient(app, base_url="https://testserver") as raw:
        with pytest.raises(WebSocketDenialResponse) as exc_info:
            with raw.websocket_connect(
                f"/api/ws/rooms/{room['id']}",
                headers={"cookie": f"codelive_session={owner}"},
            ):
                pass
    body = exc_info.value.json()
    assert exc_info.value.status_code == 403
    assert body["error"]["code"] == "invalid_origin"
    assert body["error"]["request_id"]


def test_foreign_origin_is_denied_403(ws_client):
    room, owner = _make_room_with_owner(ws_client, "ws-evilorigin@example.com")
    _expect_denial(
        ws_client,
        room["id"],
        {"origin": "http://evil.example", "cookie": f"codelive_session={owner}"},
        403,
        "invalid_origin",
    )


def test_malformed_room_id_closes_with_1008(ws_client):
    room, owner = _make_room_with_owner(ws_client, "ws-1008@example.com")
    from starlette.testclient import WebSocketDisconnect

    with pytest.raises(WebSocketDisconnect) as exc_info:
        with ws_client.websocket_connect(
            "/api/ws/rooms/not-a-uuid",
            headers={"origin": _ORIGIN, "cookie": f"codelive_session={owner}"},
        ):
            pass
    assert exc_info.value.code == 1008


def test_valid_session_wins_over_anonymous_cookie(ws_client):
    room, owner = _make_room_with_owner(ws_client, "ws-precedence@example.com")
    # The owner human also holds an anonymous membership row in the same room.
    anon = _join_anonymously(ws_client, room)
    assert anon
    with ws_client.websocket_connect(
        f"/api/ws/rooms/{room['id']}",
        headers={
            "origin": _ORIGIN,
            "cookie": f"codelive_session={owner}; codelive_anon={anon}",
        },
    ) as ws:
        frame = _join(ws, 1)
        assert frame["role"] == "owner"  # role from the authenticated row


def test_code_update_is_refused_and_socket_stays_open(ws_client):
    # D-14-mandated revision: an anonymous spectator (non-owner) sending
    # code_update now receives `forbidden` / "Acesso negado." — the exact
    # frame Phase 5 will reuse — instead of Phase 3's validation_error.
    room, _owner = _make_room_with_owner(ws_client, "ws-refuse-cu@example.com")
    anon = _join_anonymously(ws_client, room)
    with ws_client.websocket_connect(
        f"/api/ws/rooms/{room['id']}",
        headers={"origin": _ORIGIN, "cookie": f"codelive_anon={anon}"},
    ) as ws:
        ws.send_json({"type": "code_update", "content": "print('x')"})
        frame = ws.receive_json()
        assert frame == {
            "error": {
                "code": "forbidden",
                "message": "Acesso negado.",
                "request_id": frame["error"]["request_id"],
            }
        }
        assert frame["error"]["request_id"]
        # socket stays open: a join on the same socket still succeeds
        _join(ws, 1)


def test_unknown_type_is_refused_and_socket_stays_open(ws_client):
    room, _owner = _make_room_with_owner(ws_client, "ws-refuse-resync@example.com")
    anon = _join_anonymously(ws_client, room)
    with ws_client.websocket_connect(
        f"/api/ws/rooms/{room['id']}",
        headers={"origin": _ORIGIN, "cookie": f"codelive_anon={anon}"},
    ) as ws:
        ws.send_json({"type": "resync"})
        frame = ws.receive_json()
        assert frame["error"]["code"] == "validation_error"
        assert frame["error"]["request_id"]
        _join(ws, 1)


def test_snapshot_follows_presence_on_join_and_rejoin_sends_presence_only(ws_client):
    """D-04/D-07: initial join yields presence then snapshot (joiner only);

    an idempotent re-join yields presence only (Phase 3 exclusion kept).
    """
    import hashlib

    room, _owner = _make_room_with_owner(ws_client, "ws-snap@example.com")
    anon = _join_anonymously(ws_client, room)
    with ws_client.websocket_connect(
        f"/api/ws/rooms/{room['id']}",
        headers={"origin": _ORIGIN, "cookie": f"codelive_anon={anon}"},
    ) as ws:
        ws.send_json({"type": "join"})
        presence = ws.receive_json()
        assert presence["type"] == "presence"  # presence first (D-07)
        assert presence["count"] == 1
        snapshot = ws.receive_json()
        assert snapshot == {
            "type": "snapshot",
            "room_id": room["id"],
            "content": "",
            "language": "python",
            "content_hash": hashlib.sha256(b"").hexdigest(),
            "request_id": snapshot["request_id"],
        }
        assert snapshot["request_id"]
        # idempotent re-join: presence only, no second snapshot
        ws.send_json({"type": "join"})
        frame = ws.receive_json()
        assert frame["type"] == "presence"
        assert frame["count"] == 1


def test_snapshot_goes_to_joiner_only(ws_client):
    """D-05/D-07: the snapshot is joiner-only; existing peers get presence only."""
    room, owner = _make_room_with_owner(ws_client, "ws-joiner-only@example.com")
    anon = _join_anonymously(ws_client, room)
    with ws_client.websocket_connect(
        f"/api/ws/rooms/{room['id']}",
        headers={"origin": _ORIGIN, "cookie": f"codelive_session={owner}"},
    ) as ws_owner:
        _join(ws_owner, 1)
        with ws_client.websocket_connect(
            f"/api/ws/rooms/{room['id']}",
            headers={"origin": _ORIGIN, "cookie": f"codelive_anon={anon}"},
        ) as ws_anon:
            ws_anon.send_json({"type": "join"})
            presence = ws_anon.receive_json()
            assert presence["type"] == "presence"
            assert presence["count"] == 2
            snapshot = ws_anon.receive_json()
            assert snapshot["type"] == "snapshot"
            assert snapshot["room_id"] == room["id"]
            # the owner, already joined, receives only the presence broadcast
            frame = ws_owner.receive_json()
            assert frame["type"] == "presence"
            assert frame["count"] == 2


def test_room_a_traffic_never_reaches_room_b(ws_client):
    room_a, _owner = _make_room_with_owner(ws_client, "ws-room-a@example.com")
    room_b, owner_b = _make_room_with_owner(ws_client, "ws-room-b@example.com")
    anon_a = _join_anonymously(ws_client, room_a)
    anon_b = _join_anonymously(ws_client, room_b)
    with ws_client.websocket_connect(
        f"/api/ws/rooms/{room_a['id']}",
        headers={"origin": _ORIGIN, "cookie": f"codelive_anon={anon_a}"},
    ) as ws_a:
        with ws_client.websocket_connect(
            f"/api/ws/rooms/{room_b['id']}",
            headers={"origin": _ORIGIN, "cookie": f"codelive_anon={anon_b}"},
        ) as ws_b:
            _join(ws_a, 1)
            _join(ws_b, 1)
            # a second socket joins A; B must not be notified
            anon_a2 = _join_anonymously(ws_client, room_a)
            with ws_client.websocket_connect(
                f"/api/ws/rooms/{room_a['id']}",
                headers={"origin": _ORIGIN, "cookie": f"codelive_anon={anon_a2}"},
            ) as ws_a2:
                _join(ws_a2, 2)
                # B's next frame must be the response to its own action, not A's broadcast
                ws_b.send_json({"type": "join"})
                frame = ws_b.receive_json()
                assert frame["type"] == "presence"
                assert frame["room_id"] == room_b["id"]
                assert frame["count"] == 1  # only B's member, not A's two


# ---------------------------------------------------------------------------
# 03-04 Task 2: session correlation, log hygiene, pool discipline (SPEC §9.2)
# ---------------------------------------------------------------------------


def _capsys_ws_lines(capsys):
    import json

    out = capsys.readouterr().out
    lines = [json.loads(l) for l in out.splitlines() if l.strip()]
    return [l for l in lines if str(l.get("event", "")).startswith("ws_")]


def test_request_id_is_stable_for_the_session(ws_client, capsys):
    from app.shared.logging import configure_logging

    configure_logging("INFO")
    capsys.readouterr()
    room, owner = _make_room_with_owner(ws_client, "ws-corr@example.com")
    with ws_client.websocket_connect(
        f"/api/ws/rooms/{room['id']}",
        headers={"origin": _ORIGIN, "cookie": f"codelive_session={owner}"},
    ) as ws:
        frame = _join(ws, 1)
        frame_request_id = frame["request_id"]
    lines = _capsys_ws_lines(capsys)
    events = {l["event"]: l for l in lines}
    assert {"ws_connected", "ws_join", "ws_disconnected"} <= set(events)
    ids = {events[e]["request_id"] for e in ("ws_connected", "ws_join", "ws_disconnected")}
    assert len(ids) == 1
    assert frame_request_id == events["ws_connected"]["request_id"]


def test_denial_envelope_carries_request_id(ws_client):
    room, _owner = _make_room_with_owner(ws_client, "ws-denial-rid@example.com")
    body = _expect_denial(ws_client, room["id"], {"origin": _ORIGIN}, 401, "not_authenticated")
    assert body["error"]["request_id"]


def test_session_logs_never_carry_secrets(ws_client, capsys):
    from app.shared.logging import configure_logging

    configure_logging("INFO")
    capsys.readouterr()
    room, _owner = _make_room_with_owner(ws_client, "ws-hygiene@example.com")
    ws_client.cookies.clear()
    resp = ws_client.post(
        f"/api/rooms/{room['id']}/join",
        json={"code": room["access_code"], "anonymous": True, "nickname": "SentinelNick"},
    )
    assert resp.status_code == 200
    anon = ws_client.cookies.get("codelive_anon")
    session_cookie_value = None
    with ws_client.websocket_connect(
        f"/api/ws/rooms/{room['id']}",
        headers={"origin": _ORIGIN, "cookie": f"codelive_anon={anon}"},
    ) as ws:
        _join(ws, 1)
    lines = _capsys_ws_lines(capsys)
    assert lines, "expected ws_* log lines"
    blob = "\n".join(__import__("json").dumps(l) for l in lines)
    assert "SentinelNick" not in blob
    assert room["access_code"] not in blob
    assert anon not in blob
    assert session_cookie_value not in blob if session_cookie_value else True


def test_ws_lifecycle_events_emitted(ws_client, capsys):
    from app.shared.logging import configure_logging

    configure_logging("INFO")
    capsys.readouterr()
    room, owner = _make_room_with_owner(ws_client, "ws-lifecycle@example.com")
    with ws_client.websocket_connect(
        f"/api/ws/rooms/{room['id']}",
        headers={"origin": _ORIGIN, "cookie": f"codelive_session={owner}"},
    ) as ws:
        _join(ws, 1)
    lines = _capsys_ws_lines(capsys)
    events = {l["event"]: l for l in lines}
    for event in ("ws_connected", "ws_join", "ws_disconnected"):
        assert event in events, event
        assert events[event]["room_id"] == room["id"]
        assert events[event]["request_id"]
        assert events[event]["user_id"]


def test_pool_not_pinned_by_socket(ws_client, test_engine):
    room, _owner = _make_room_with_owner(ws_client, "ws-pool@example.com")
    anon = _join_anonymously(ws_client, room)
    with ws_client.websocket_connect(
        f"/api/ws/rooms/{room['id']}",
        headers={"origin": _ORIGIN, "cookie": f"codelive_anon={anon}"},
    ) as ws:
        _join(ws, 1)
        assert test_engine.pool.checkedout() == 0


def test_presence_payload_has_no_roster(ws_client):
    room, owner = _make_room_with_owner(ws_client, "ws-noroster@example.com")
    anon = _join_anonymously(ws_client, room)
    expected = {"type", "room_id", "count", "role", "request_id"}
    with ws_client.websocket_connect(
        f"/api/ws/rooms/{room['id']}",
        headers={"origin": _ORIGIN, "cookie": f"codelive_session={owner}"},
    ) as ws_owner:
        _join(ws_owner, 1)
        with ws_client.websocket_connect(
            f"/api/ws/rooms/{room['id']}",
            headers={"origin": _ORIGIN, "cookie": f"codelive_anon={anon}"},
        ) as ws_anon:
            frame_anon = _join(ws_anon, 2)
            frame_owner = ws_owner.receive_json()
            for frame in (frame_anon, frame_owner):
                assert set(frame) == expected
                assert not {"nickname", "email", "user_id", "users", "roster"} & set(frame)


def test_broadcast_frame_carries_each_recipients_own_request_id(ws_client):
    room, owner = _make_room_with_owner(ws_client, "ws-perrid@example.com")
    anon = _join_anonymously(ws_client, room)
    with ws_client.websocket_connect(
        f"/api/ws/rooms/{room['id']}",
        headers={"origin": _ORIGIN, "cookie": f"codelive_session={owner}"},
    ) as ws_owner:
        frame_owner = _join(ws_owner, 1)
        owner_rid = frame_owner["request_id"]
        with ws_client.websocket_connect(
            f"/api/ws/rooms/{room['id']}",
            headers={"origin": _ORIGIN, "cookie": f"codelive_anon={anon}"},
        ) as ws_anon:
            frame_anon = _join(ws_anon, 2)
            anon_rid = frame_anon["request_id"]
            # the broadcast caused by the anon socket's join reaches the owner;
            # it must carry the owner's session id, not the joiner's
            frame = ws_owner.receive_json()
            assert frame["type"] == "presence"
            assert frame["request_id"] == owner_rid
            assert frame["request_id"] != anon_rid


def test_forged_anonymous_cookie_is_denied_401(ws_client):
    room, _owner = _make_room_with_owner(ws_client, "ws-anon-forged@example.com")
    from itsdangerous import URLSafeTimedSerializer

    forged = URLSafeTimedSerializer("wrong-secret", salt="codelive.anonymous").dumps({"sid": "x"})
    _expect_denial(
        ws_client,
        room["id"],
        {"origin": _ORIGIN, "cookie": f"codelive_anon={forged}"},
        401,
        "not_authenticated",
    )


def test_expired_anonymous_cookie_is_denied_401(ws_client, monkeypatch):
    room, _owner = _make_room_with_owner(ws_client, "ws-anon-expired@example.com")
    anon = _join_anonymously(ws_client, room)
    import app.shared.security as security

    # a legitimately-issued token reads as expired when the max-age window is negative
    monkeypatch.setattr(security, "ANONYMOUS_MAX_AGE", -1)
    _expect_denial(
        ws_client,
        room["id"],
        {"origin": _ORIGIN, "cookie": f"codelive_anon={anon}"},
        401,
        "not_authenticated",
    )


# ---------------------------------------------------------------------------
# 04-02 Task 3: backfilled-room and reconnect snapshot coverage (LIVE-03)
# ---------------------------------------------------------------------------

_SHA256_EMPTY = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"


async def test_backfilled_room_empty_snapshot(ws_client, db_session):
    """A room whose room_code_state row came from the 0004 backfill emits a

    valid snapshot with content == "" and content_hash == sha256(b"").
    """
    import hashlib

    room, owner = _make_room_with_owner(ws_client, "ws-backfill@example.com")
    await _seed_code_state(db_session, room["id"], "")
    with ws_client.websocket_connect(
        f"/api/ws/rooms/{room['id']}",
        headers={"origin": _ORIGIN, "cookie": f"codelive_session={owner}"},
    ) as ws:
        ws.send_json({"type": "join"})
        presence = ws.receive_json()
        assert presence["type"] == "presence"
        snapshot = ws.receive_json()
        assert snapshot["type"] == "snapshot"
        assert snapshot["room_id"] == room["id"]
        assert snapshot["content"] == ""
        assert snapshot["language"] == "python"
        assert snapshot["content_hash"] == hashlib.sha256(b"").hexdigest()
        assert snapshot["content_hash"] == _SHA256_EMPTY
        assert snapshot["request_id"] == presence["request_id"]


async def test_owner_reconnect_receives_persisted_state_byte_for_byte(
    ws_client, db_session
):
    """Reconnect is the same code path: the snapshot is byte-for-byte equal

    to the persisted room_code_state row on both connects.
    """
    import hashlib

    payload = "# café\nprint('olá 🐍')\n"
    room, owner = _make_room_with_owner(ws_client, "ws-reconnect@example.com")
    await _seed_code_state(db_session, room["id"], payload)

    def _join_and_get_snapshot(ws):
        ws.send_json({"type": "join"})
        ws.receive_json()  # presence
        return ws.receive_json()  # snapshot

    headers = {"origin": _ORIGIN, "cookie": f"codelive_session={owner}"}
    with ws_client.websocket_connect(
        f"/api/ws/rooms/{room['id']}", headers=headers
    ) as ws:
        snapshot1 = _join_and_get_snapshot(ws)
    with ws_client.websocket_connect(
        f"/api/ws/rooms/{room['id']}", headers=headers
    ) as ws:
        snapshot2 = _join_and_get_snapshot(ws)
    for snapshot in (snapshot1, snapshot2):
        assert snapshot["type"] == "snapshot"
        assert snapshot["room_id"] == room["id"]
        assert snapshot["content"] == payload  # byte-for-byte
        assert snapshot["content_hash"] == hashlib.sha256(
            payload.encode("utf-8")
        ).hexdigest()
        assert snapshot["language"] == "python"
    # the row is unchanged by snapshots: content still the seeded payload
    row = (
        await db_session.execute(
            text("SELECT content FROM room_code_state WHERE room_id = :room_id"),
            {"room_id": uuid.UUID(room["id"])},
        )
    ).one()
    assert row.content == payload


async def test_room_without_state_row_gets_empty_snapshot(ws_client, db_session):
    """Read-or-empty (D-13): a room with no room_code_state row at all still

    emits a valid snapshot with content == "" and the empty-string hash.
    """
    import hashlib

    room, owner = _make_room_with_owner(ws_client, "ws-norow@example.com")
    with ws_client.websocket_connect(
        f"/api/ws/rooms/{room['id']}",
        headers={"origin": _ORIGIN, "cookie": f"codelive_session={owner}"},
    ) as ws:
        ws.send_json({"type": "join"})
        ws.receive_json()  # presence
        snapshot = ws.receive_json()
        assert snapshot["type"] == "snapshot"
        assert snapshot["room_id"] == room["id"]
        assert snapshot["content"] == ""
        assert snapshot["language"] == "python"
        assert snapshot["content_hash"] == hashlib.sha256(b"").hexdigest()


# ---------------------------------------------------------------------------
# 04-03: owner code_update — guard, oversize refusal, persist+broadcast (LIVE-04, LIVE-07, OBS-04, QUAL-03)
# ---------------------------------------------------------------------------

_OVERSIZE_SENTINEL = "Z_SENTINEL_OVERSIZE"


def _capsys_json_lines(capsys):
    import json

    lines = []
    for raw in capsys.readouterr().out.splitlines():
        raw = raw.strip()
        if not raw:
            continue
        try:
            lines.append(json.loads(raw))
        except json.JSONDecodeError:
            continue
    return lines


def _connect_owner(ws_client, room_id, owner_session):
    return ws_client.websocket_connect(
        f"/api/ws/rooms/{room_id}",
        headers={"origin": _ORIGIN, "cookie": f"codelive_session={owner_session}"},
    )


async def test_non_owner_code_update_writes_nothing_and_broadcasts_nothing(
    ws_client, db_session
):
    """T-04-07: a non-owner's code_update is forbidden — no write, no broadcast."""
    room, owner = _make_room_with_owner(ws_client, "ws-nonowner-cu@example.com")
    anon = _join_anonymously(ws_client, room)
    with _connect_owner(ws_client, room["id"], owner) as ws_owner:
        _join(ws_owner, 1)
        with _connect(ws_client, room["id"], anon) as ws_anon:
            _join(ws_anon, 2)
            ws_owner.receive_json()  # presence count == 2 broadcast
            ws_anon.send_json({"type": "code_update", "content": "sneaky edit"})
            frame = ws_anon.receive_json()
            assert frame["error"]["code"] == "forbidden"
            assert frame["error"]["message"] == "Acesso negado."
            # the owner receives no code_update: its next frame is the
            # presence reply to its own idempotent re-join
            ws_owner.send_json({"type": "join"})
            frame_owner = ws_owner.receive_json()
            assert frame_owner["type"] == "presence"
            assert frame_owner["count"] == 2
        # ws_anon closed; drain the disconnect presence broadcast on ws_owner
        assert ws_owner.receive_json()["count"] == 1
    row = (
        await db_session.execute(
            text("SELECT COUNT(*) AS n FROM room_code_state WHERE room_id = :room_id"),
            {"room_id": uuid.UUID(room["id"])},
        )
    ).one()
    assert row.n == 0


async def test_oversize_code_update_is_refused_before_db_access(ws_client, db_session):
    """QUAL-03/D-02: > 262_144 UTF-8 bytes is refused before any DB access."""
    from app.features.live_code.service import MAX_CODE_BYTES

    payload = "A" * MAX_CODE_BYTES + _OVERSIZE_SENTINEL
    room, owner = _make_room_with_owner(ws_client, "ws-oversize@example.com")
    with _connect_owner(ws_client, room["id"], owner) as ws:
        _join(ws, 1)
        ws.send_json({"type": "code_update", "content": payload})
        frame = ws.receive_json()
        assert frame["error"]["code"] == "validation_error"
        assert "256 KiB" in frame["error"]["message"]
        assert frame["error"]["request_id"]
        # socket stays open: a join on the same socket still succeeds
        ws.send_json({"type": "join"})
        assert ws.receive_json()["type"] == "presence"
    row = (
        await db_session.execute(
            text("SELECT COUNT(*) AS n FROM room_code_state WHERE room_id = :room_id"),
            {"room_id": uuid.UUID(room["id"])},
        )
    ).one()
    assert row.n == 0


async def test_oversize_code_update_rejected_log_carries_hash_not_content(
    ws_client, capsys, db_session
):
    """D-03: `code_update_rejected` logs room_id/user_id/size_bytes/content_hash only."""
    import hashlib

    from app.features.live_code.service import MAX_CODE_BYTES
    from app.shared.logging import configure_logging

    configure_logging("INFO")
    capsys.readouterr()
    payload = "A" * MAX_CODE_BYTES + _OVERSIZE_SENTINEL
    room, owner = _make_room_with_owner(ws_client, "ws-oversize-log@example.com")
    with _connect_owner(ws_client, room["id"], owner) as ws:
        _join(ws, 1)
        ws.send_json({"type": "code_update", "content": payload})
        frame = ws.receive_json()
        assert frame["error"]["code"] == "validation_error"
    lines = _capsys_json_lines(capsys)
    blob = "\n".join(__import__("json").dumps(l) for l in lines)
    assert _OVERSIZE_SENTINEL not in blob
    rejected = [l for l in lines if l.get("event") == "code_update_rejected"]
    assert rejected, "expected a code_update_rejected log line"
    entry = rejected[0]
    assert entry["room_id"] == room["id"]
    assert entry["user_id"]
    assert entry["size_bytes"] == len(payload.encode("utf-8"))
    assert entry["content_hash"] == hashlib.sha256(payload.encode("utf-8")).hexdigest()


async def test_owner_code_update_persists_and_broadcasts_after_commit(
    ws_client, db_session, capsys
):
    """D-09/D-10: persist first; broadcast (sender included) only after commit."""
    import hashlib

    from sqlalchemy import text as _text

    from app.shared.logging import configure_logging

    configure_logging("INFO")
    capsys.readouterr()
    sentinel = "supersecret_payload_sentinel_42"
    room, owner = _make_room_with_owner(ws_client, "ws-persist-cu@example.com")
    anon = _join_anonymously(ws_client, room)
    with _connect_owner(ws_client, room["id"], owner) as ws_owner:
        rid_owner = _join(ws_owner, 1)["request_id"]
        with _connect(ws_client, room["id"], anon) as ws_anon:
            rid_anon = _join(ws_anon, 2)["request_id"]
            ws_owner.receive_json()  # presence count == 2 broadcast
            ws_owner.send_json({"type": "code_update", "content": sentinel})
            frame_owner = ws_owner.receive_json()
            frame_anon = ws_anon.receive_json()
            expected_hash = hashlib.sha256(sentinel.encode("utf-8")).hexdigest()
            for frame, rid in ((frame_owner, rid_owner), (frame_anon, rid_anon)):
                assert frame == {
                    "type": "code_update",
                    "room_id": room["id"],
                    "content": sentinel,
                    "content_hash": expected_hash,
                    "request_id": rid,  # per-recipient request_id (D-13)
                }
        # ws_anon closed; drain the disconnect presence broadcast on ws_owner
        assert ws_owner.receive_json()["count"] == 1
    row = (
        await db_session.execute(
            _text("SELECT content FROM room_code_state WHERE room_id = :room_id"),
            {"room_id": uuid.UUID(room["id"])},
        )
    ).one()
    assert row.content == sentinel
    lines = _capsys_json_lines(capsys)
    blob = "\n".join(__import__("json").dumps(l) for l in lines)
    assert sentinel not in blob
    events = {l["event"]: l for l in lines if "event" in l}
    assert "code_update" in events
    assert events["code_update"]["room_id"] == room["id"]
    assert events["code_update"]["content_hash"] == expected_hash


async def test_db_failure_sends_internal_error_to_sender_only(
    ws_client, db_session, monkeypatch
):
    """D-10: DB failure -> internal_error to the sender only; no broadcast; row unchanged."""
    import app.features.live_code.service as service

    room, owner = _make_room_with_owner(ws_client, "ws-dbfail-cu@example.com")
    await _seed_code_state(db_session, room["id"], "before")
    anon = _join_anonymously(ws_client, room)

    async def _boom(session, room_id, content):
        raise RuntimeError("db is down")

    monkeypatch.setattr(service, "persist_code_update", _boom)
    with _connect_owner(ws_client, room["id"], owner) as ws_owner:
        _join(ws_owner, 1)
        with _connect(ws_client, room["id"], anon) as ws_anon:
            _join(ws_anon, 2)
            ws_owner.receive_json()  # presence count == 2 broadcast
            ws_owner.send_json({"type": "code_update", "content": "after"})
            frame = ws_owner.receive_json()
            assert frame["error"]["code"] == "internal_error"
            assert frame["error"]["request_id"]
            # the viewer receives no code_update: its next frame is the
            # presence reply to its own idempotent re-join
            ws_anon.send_json({"type": "join"})
            frame_anon = ws_anon.receive_json()
            assert frame_anon["type"] == "presence"
            assert frame_anon["count"] == 2
            # the sender's socket stays open: a re-join still succeeds
            ws_owner.send_json({"type": "join"})
            frame_owner = ws_owner.receive_json()
            assert frame_owner["type"] == "presence"
            assert frame_owner["count"] == 2
        # ws_anon closed; drain the disconnect presence broadcast on ws_owner
        assert ws_owner.receive_json()["count"] == 1
    row = (
        await db_session.execute(
            text("SELECT content FROM room_code_state WHERE room_id = :room_id"),
            {"room_id": uuid.UUID(room["id"])},
        )
    ).one()
    assert row.content == "before"


# ---------------------------------------------------------------------------
# 04-03 Task 4: full owner code_update round-trip suite
# ---------------------------------------------------------------------------


def test_owner_code_update_round_trip_and_log_hygiene(ws_client, capsys):
    """LIVE-04/LIVE-07/OBS-04: owner + anonymous viewer; raw code never logged."""
    import hashlib
    import json

    from app.shared.logging import configure_logging

    configure_logging("INFO")
    capsys.readouterr()
    sentinel = "roundtrip_secret_content_sentinel_🐍"
    room, owner = _make_room_with_owner(ws_client, "ws-roundtrip@example.com")
    anon = _join_anonymously(ws_client, room)
    with _connect_owner(ws_client, room["id"], owner) as ws_owner:
        rid_owner = _join(ws_owner, 1)["request_id"]
        with _connect(ws_client, room["id"], anon) as ws_anon:
            rid_anon = _join(ws_anon, 2)["request_id"]
            ws_owner.receive_json()  # presence count == 2 broadcast
            ws_owner.send_json({"type": "code_update", "content": sentinel})
            frame_owner = ws_owner.receive_json()
            frame_anon = ws_anon.receive_json()
            expected_hash = hashlib.sha256(sentinel.encode("utf-8")).hexdigest()
            # the sender receives the same broadcast frame, per-recipient ids
            assert frame_owner["type"] == "code_update"
            assert frame_owner["request_id"] == rid_owner
            assert frame_anon["type"] == "code_update"
            assert frame_anon["request_id"] == rid_anon
            assert frame_anon["content"] == sentinel
            assert frame_anon["content_hash"] == expected_hash
            assert frame_anon["room_id"] == room["id"]
        # ws_anon closed; drain the disconnect presence broadcast on ws_owner
        assert ws_owner.receive_json()["count"] == 1
    lines = _capsys_json_lines(capsys)
    blob = "\n".join(json.dumps(l) for l in lines)
    assert sentinel not in blob
    assert "ws-roundtrip@example.com" not in blob


def test_owner_reconnect_after_edit_receives_new_content_byte_for_byte(ws_client):
    """LIVE-07: edit -> disconnect -> reconnect; snapshot matches the edit byte-for-byte."""
    import hashlib

    payload = "# café\nedited 🐍 content\n"
    room, owner = _make_room_with_owner(ws_client, "ws-reconnect-edit@example.com")
    headers = {"origin": _ORIGIN, "cookie": f"codelive_session={owner}"}
    with ws_client.websocket_connect(
        f"/api/ws/rooms/{room['id']}", headers=headers
    ) as ws:
        _join(ws, 1)
        ws.send_json({"type": "code_update", "content": payload})
        frame = ws.receive_json()
        assert frame["type"] == "code_update"
        assert frame["content"] == payload
    with ws_client.websocket_connect(
        f"/api/ws/rooms/{room['id']}", headers=headers
    ) as ws:
        ws.send_json({"type": "join"})
        ws.receive_json()  # presence
        snapshot = ws.receive_json()
        assert snapshot["type"] == "snapshot"
        assert snapshot["content"] == payload  # byte-for-byte
        assert snapshot["content_hash"] == hashlib.sha256(
            payload.encode("utf-8")
        ).hexdigest()

