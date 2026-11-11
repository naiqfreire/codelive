"""WS /api/ws/rooms/{room_id}: handshake, join, presence, leave."""
import pytest

pytestmark = pytest.mark.integration


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
    ws.send_json({"type": "join"})
    frame = ws.receive_json()
    assert frame["type"] == "presence"
    assert frame["count"] == expected_count
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
                "code": "validation_error",
                "message": "Dados inválidos.",
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


def test_no_snapshot_frame_after_join(ws_client):
    room, _owner = _make_room_with_owner(ws_client, "ws-nosnap@example.com")
    anon = _join_anonymously(ws_client, room)
    with ws_client.websocket_connect(
        f"/api/ws/rooms/{room['id']}",
        headers={"origin": _ORIGIN, "cookie": f"codelive_anon={anon}"},
    ) as ws:
        frame = _join(ws, 1)
        assert frame["type"] == "presence"  # the first frame is presence, never snapshot
        # an idempotent re-join yields presence again — no snapshot in between
        ws.send_json({"type": "join"})
        assert ws.receive_json()["type"] == "presence"


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
