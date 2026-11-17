"""Tracer (VERS-05): owner restore end-to-end over REST + WS.

The owner restores a seeded version; the room state is rewritten, a new
authored version row is created in the same transaction, and every joined
spectator receives the existing ``snapshot`` frame byte-equal to the REST
response (D-06/D-08). An anonymous spectator joined before the restore is
the recipient of record. The success log line is hash-only (D-09).
"""
import hashlib
import json
import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import text

pytestmark = pytest.mark.integration

_ORIGIN = "http://localhost:5173"


def _ndjson_lines(capsys):
    out = capsys.readouterr().out
    return [json.loads(line) for line in out.splitlines() if line.strip()]


def _make_room_with_owner(ws_client, email):
    """Owner registers and creates a room; returns (room, owner_session)."""
    resp = ws_client.post(
        "/api/auth/register",
        json={"name": "Owner", "email": email, "password": "correct-horse"},
    )
    assert resp.status_code == 201
    resp = ws_client.post("/api/rooms", json={"language": "python"})
    assert resp.status_code == 201
    room = resp.json()
    owner = ws_client.cookies.get("codelive_session")
    ws_client.cookies.clear()
    return room, owner


def _join_anonymously(ws_client, room):
    resp = ws_client.post(
        f"/api/rooms/{room['id']}/join",
        json={"code": room["access_code"], "anonymous": True, "nickname": "Anônimo"},
    )
    assert resp.status_code == 200
    return resp.cookies.get("codelive_anon")


def _join(ws, expected_count):
    """Send join; expect presence then the joiner-only snapshot (D-07)."""
    ws.send_json({"type": "join"})
    frame = ws.receive_json()
    assert frame["type"] == "presence"
    assert frame["count"] == expected_count
    snapshot = ws.receive_json()
    assert snapshot["type"] == "snapshot"
    return snapshot


async def test_owner_restore_writes_state_creates_version_and_broadcasts(
    ws_client, db_session, capsys
):
    room, owner_session = _make_room_with_owner(
        ws_client, "restore-tracer@example.com"
    )
    room_id = room["id"]

    owner_row = (
        await db_session.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": "restore-tracer@example.com"},
        )
    ).one()
    owner_id = owner_row.id

    anon = _join_anonymously(ws_client, room)
    assert anon

    seeded_content = "print('restored')\n"
    version_id = uuid.uuid7()
    await db_session.execute(
        text(
            "INSERT INTO code_versions (id, room_id, content, language, author_id, created_at) "
            "VALUES (:id, :room, :content, 'python', NULL, :created)"
        ),
        {
            "id": version_id,
            "room": uuid.UUID(room_id),
            "content": seeded_content,
            "created": datetime(2026, 11, 10, 12, 0, 0, tzinfo=timezone.utc),
        },
    )
    await db_session.commit()

    # Anonymous spectator joins BEFORE the restore and stays connected for it.
    with ws_client.websocket_connect(
        f"/api/ws/rooms/{room_id}",
        headers={"origin": _ORIGIN, "cookie": f"codelive_anon={anon}"},
    ) as spectator:
        join_snapshot = _join(spectator, 1)

        # Restore as the owner over REST.
        from app.shared.logging import configure_logging

        configure_logging("INFO")
        capsys.readouterr()  # flush join noise before the restore
        ws_client.cookies.clear()
        ws_client.cookies.set("codelive_session", owner_session)
        resp = ws_client.post(f"/api/rooms/{room_id}/versions/{version_id}/restore")

        assert resp.status_code == 200
        body = resp.json()
        # D-08: exactly {content, content_hash, id, created_at}
        assert set(body) == {"content", "content_hash", "id", "created_at"}
        assert body["content"] == seeded_content
        assert (
            body["content_hash"]
            == hashlib.sha256(seeded_content.encode("utf-8")).hexdigest()
        )
        uuid.UUID(body["id"])  # id is a UUID string

        # The joined spectator receives exactly one snapshot frame after the
        # restore — byte-equal to the REST response, with its own request_id.
        frame = spectator.receive_json()
        assert frame["type"] == "snapshot"
        assert frame["content"] == body["content"]
        assert frame["content_hash"] == body["content_hash"]
        assert frame["content_hash"] == hashlib.sha256(
            seeded_content.encode("utf-8")
        ).hexdigest()
        assert frame["room_id"] == room_id
        assert frame["request_id"] == join_snapshot["request_id"]

    # Single-transaction proof: state row carries the restored bytes...
    state = (
        await db_session.execute(
            text("SELECT content FROM room_code_state WHERE room_id = :room_id"),
            {"room_id": uuid.UUID(room_id)},
        )
    ).one()
    assert state.content == seeded_content

    # ...and a NEW code_versions row exists, authored by the restoring owner,
    # on top of the seeded one (immutable: the seeded row is untouched).
    rows = (
        await db_session.execute(
            text(
                "SELECT id, content, author_id FROM code_versions "
                "WHERE room_id = :room_id ORDER BY created_at ASC"
            ),
            {"room_id": uuid.UUID(room_id)},
        )
    ).all()
    assert len(rows) == 2
    assert str(rows[0].id) == str(version_id)
    assert rows[0].author_id is None
    assert rows[1].content == seeded_content
    assert rows[1].author_id == owner_id
    assert str(rows[1].id) == body["id"]

    # D-09 log discipline: exactly one version_restored info line, hash-only
    # field set, and no content key anywhere in the emitted lines.
    lines = _ndjson_lines(capsys)
    restored_lines = [l for l in lines if l.get("event") == "version_restored"]
    assert len(restored_lines) == 1, "one version_restored line per restore"
    restored_line = restored_lines[0]
    assert restored_line["room_id"] == room_id
    assert restored_line["restored_version_id"] == str(version_id)
    assert restored_line["new_version_id"] == body["id"]
    assert restored_line["content_hash"] == body["content_hash"]
    assert restored_line["user_id"] == str(owner_id)
    assert restored_line["duration_ms"] >= 0
    assert "content" not in restored_line, "the log line never carries content"


BASE_NOW = datetime(2026, 11, 14, 12, 0, 0, tzinfo=timezone.utc)


async def _seed_version(db_session, room_id, content, created_at, author_id=None, vid=None):
    """Insert a version row with an explicit created_at (raw SQL seed)."""
    vid = vid or uuid.uuid7()
    await db_session.execute(
        text(
            "INSERT INTO code_versions (id, room_id, content, language, author_id, created_at) "
            "VALUES (:id, :room, :content, 'python', :author, :created)"
        ),
        {
            "id": vid,
            "room": uuid.UUID(room_id) if isinstance(room_id, str) else room_id,
            "content": content,
            "author": author_id,
            "created": created_at,
        },
    )
    await db_session.commit()
    return vid


async def _seed_code_state(db_session, room_id, content):
    """Upsert a room_code_state row the way the migration backfills them."""
    await db_session.execute(
        text(
            "INSERT INTO room_code_state (id, room_id, content) "
            "VALUES (:id, :room, :content) "
            "ON CONFLICT (room_id) DO UPDATE SET content = EXCLUDED.content"
        ),
        {"id": uuid.uuid7(), "room": uuid.UUID(room_id), "content": content},
    )
    await db_session.commit()


async def _count_versions(db_session, room_id):
    return (
        await db_session.execute(
            text("SELECT COUNT(*) FROM code_versions WHERE room_id = :room_id"),
            {"room_id": uuid.UUID(room_id)},
        )
    ).scalar_one()


async def _state_content(db_session, room_id):
    row = (
        await db_session.execute(
            text("SELECT content FROM room_code_state WHERE room_id = :room_id"),
            {"room_id": uuid.UUID(room_id)},
        )
    ).first()
    return row.content if row else None


async def _state_updated_at(db_session, room_id):
    row = (
        await db_session.execute(
            text("SELECT updated_at FROM room_code_state WHERE room_id = :room_id"),
            {"room_id": uuid.UUID(room_id)},
        )
    ).one()
    return row.updated_at


def _assert_no_version_restored_lines(capsys):
    lines = _ndjson_lines(capsys)
    restored = [l for l in lines if l.get("event") == "version_restored"]
    assert restored == [], f"refusal must not log version_restored, got: {restored}"
    return lines


# --- Task 1: refusal matrix, one test per ladder rung --------------------


async def test_restore_unknown_room_404_room_not_found(ws_client, db_session, capsys):
    from app.shared.logging import configure_logging

    configure_logging("INFO")
    room, owner_session = _make_room_with_owner(ws_client, "restore-404-room@example.com")
    room_id = room["id"]
    await _seed_code_state(db_session, room_id, "print('before')\n")
    await _seed_version(db_session, room_id, "print('v1')\n", BASE_NOW)

    ws_client.cookies.set("codelive_session", owner_session)
    unknown_room = str(uuid.uuid4())
    unknown_version = str(uuid.uuid4())
    capsys.readouterr()
    resp = ws_client.post(f"/api/rooms/{unknown_room}/versions/{unknown_version}/restore")

    assert resp.status_code == 404
    body = resp.json()
    assert body["error"]["code"] == "room_not_found"
    assert body["error"]["message"] == "Sala não encontrada."
    err = body["error"]
    assert set(err) == {"code", "message", "request_id"}
    assert await _state_content(db_session, room_id) == "print('before')\n"
    assert await _count_versions(db_session, room_id) == 1
    _assert_no_version_restored_lines(capsys)


async def test_restore_non_owner_403_forbidden(ws_client, db_session, capsys):
    from app.shared.logging import configure_logging

    configure_logging("INFO")
    room, owner_session = _make_room_with_owner(ws_client, "restore-403-owner@example.com")
    room_id = room["id"]
    await _seed_code_state(db_session, room_id, "print('before')\n")
    version_id = await _seed_version(db_session, room_id, "print('v1')\n", BASE_NOW)

    resp = ws_client.post(
        "/api/auth/register",
        json={"name": "Other", "email": "restore-403-other@example.com", "password": "correct-horse"},
    )
    assert resp.status_code == 201

    capsys.readouterr()
    resp = ws_client.post(f"/api/rooms/{room_id}/versions/{version_id}/restore")

    assert resp.status_code == 403
    body = resp.json()
    assert body["error"]["code"] == "forbidden"
    assert body["error"]["message"] == "Acesso negado."
    err = body["error"]
    assert set(err) == {"code", "message", "request_id"}
    assert await _state_content(db_session, room_id) == "print('before')\n"
    assert await _count_versions(db_session, room_id) == 1
    _assert_no_version_restored_lines(capsys)


async def test_restore_anonymous_member_403_forbidden(ws_client, db_session, capsys):
    from app.shared.logging import configure_logging

    configure_logging("INFO")
    room, owner_session = _make_room_with_owner(ws_client, "restore-403-anon@example.com")
    room_id = room["id"]
    await _seed_code_state(db_session, room_id, "print('before')\n")
    version_id = await _seed_version(db_session, room_id, "print('v1')\n", BASE_NOW)

    anon = _join_anonymously(ws_client, room)
    assert anon
    ws_client.cookies.clear()
    ws_client.cookies.set("codelive_anon", anon)

    capsys.readouterr()
    resp = ws_client.post(f"/api/rooms/{room_id}/versions/{version_id}/restore")

    assert resp.status_code == 403
    body = resp.json()
    assert body["error"]["code"] == "forbidden"
    assert body["error"]["message"] == "Acesso negado."
    assert await _state_content(db_session, room_id) == "print('before')\n"
    assert await _count_versions(db_session, room_id) == 1
    _assert_no_version_restored_lines(capsys)


async def test_restore_closed_room_409_room_closed(ws_client, db_session, capsys):
    from app.shared.logging import configure_logging

    configure_logging("INFO")
    room, owner_session = _make_room_with_owner(ws_client, "restore-409@example.com")
    room_id = room["id"]
    await _seed_code_state(db_session, room_id, "print('before')\n")
    version_id = await _seed_version(db_session, room_id, "print('v1')\n", BASE_NOW)

    ws_client.cookies.set("codelive_session", owner_session)
    close_resp = ws_client.patch(f"/api/rooms/{room_id}/close")
    assert close_resp.status_code == 200

    capsys.readouterr()
    resp = ws_client.post(f"/api/rooms/{room_id}/versions/{version_id}/restore")

    assert resp.status_code == 409
    body = resp.json()
    assert body["error"]["code"] == "room_closed"
    assert body["error"]["message"] == "Sala encerrada."
    assert await _state_content(db_session, room_id) == "print('before')\n"
    assert await _count_versions(db_session, room_id) == 1
    _assert_no_version_restored_lines(capsys)


async def test_restore_unknown_version_404_version_not_found(ws_client, db_session, capsys):
    from app.shared.logging import configure_logging

    configure_logging("INFO")
    room, owner_session = _make_room_with_owner(ws_client, "restore-404-unknown@example.com")
    room_id = room["id"]
    await _seed_code_state(db_session, room_id, "print('before')\n")
    await _seed_version(db_session, room_id, "print('v1')\n", BASE_NOW)

    ws_client.cookies.set("codelive_session", owner_session)
    unknown_version = str(uuid.uuid4())
    capsys.readouterr()
    resp = ws_client.post(f"/api/rooms/{room_id}/versions/{unknown_version}/restore")

    assert resp.status_code == 404
    body = resp.json()
    assert body["error"]["code"] == "version_not_found"
    assert body["error"]["message"] == "Versão não encontrada."
    assert await _state_content(db_session, room_id) == "print('before')\n"
    assert await _count_versions(db_session, room_id) == 1
    _assert_no_version_restored_lines(capsys)


async def test_restore_cross_room_version_404_version_not_found(ws_client, db_session, capsys):
    from app.shared.logging import configure_logging

    configure_logging("INFO")
    room_a, owner_session = _make_room_with_owner(ws_client, "restore-404-cross@example.com")
    room_a_id = room_a["id"]
    await _seed_code_state(db_session, room_a_id, "print('a-before')\n")
    version_a = await _seed_version(db_session, room_a_id, "print('a')\n", BASE_NOW)

    ws_client.cookies.set("codelive_session", owner_session)
    resp_b = ws_client.post("/api/rooms", json={"language": "python"})
    assert resp_b.status_code == 201
    room_b_id = resp_b.json()["id"]

    capsys.readouterr()
    resp = ws_client.post(f"/api/rooms/{room_b_id}/versions/{version_a}/restore")

    assert resp.status_code == 404
    body = resp.json()
    assert body["error"]["code"] == "version_not_found"
    assert body["error"]["message"] == "Versão não encontrada."
    assert await _state_content(db_session, room_a_id) == "print('a-before')\n"
    assert await _count_versions(db_session, room_a_id) == 1
    assert await _state_content(db_session, room_b_id) is None
    assert await _count_versions(db_session, room_b_id) == 0
    _assert_no_version_restored_lines(capsys)


# --- Task 2: atomicity, byte equality, no-dedup, log discipline -------------


async def test_restore_failure_rolls_back_both_writes(
    ws_client, db_session, capsys, monkeypatch
):
    from app.shared.logging import configure_logging

    configure_logging("INFO")
    room, owner_session = _make_room_with_owner(ws_client, "restore-boom@example.com")
    room_id = room["id"]
    await _seed_code_state(db_session, room_id, "print('before')\n")
    version_id = await _seed_version(db_session, room_id, "print('v1')\n", BASE_NOW)

    anon = _join_anonymously(ws_client, room)
    assert anon

    async def _boom(*args, **kwargs):
        raise RuntimeError("forced failure for the atomicity test")

    from app.features.versions import service

    monkeypatch.setattr(service, "_insert_version", _boom)

    ws_client.cookies.set("codelive_session", owner_session)

    with ws_client.websocket_connect(
        f"/api/ws/rooms/{room_id}",
        headers={"origin": _ORIGIN, "cookie": f"codelive_anon={anon}"},
    ) as spectator:
        _join(spectator, 1)
        capsys.readouterr()  # flush seeding/join noise before the restore
        resp = ws_client.post(f"/api/rooms/{room_id}/versions/{version_id}/restore")

    assert resp.status_code == 500
    body = resp.json()
    assert body["error"]["code"] == "internal_error"
    assert body["error"]["message"] == "Erro interno do servidor."

    # Both tables are untouched: the upsert rolled back with the insert.
    assert await _state_content(db_session, room_id) == "print('before')\n"
    assert await _count_versions(db_session, room_id) == 1

    lines = _ndjson_lines(capsys)
    failed = [l for l in lines if l.get("event") == "version_restore_failed"]
    restored = [l for l in lines if l.get("event") == "version_restored"]
    assert len(failed) == 1, "exactly one version_restore_failed line"
    assert failed[0]["error_type"] == "RuntimeError"
    assert failed[0]["duration_ms"] >= 0
    assert "content" not in failed[0]
    assert restored == [], "the success line never fires without a durable commit"


async def test_restore_failure_leaves_socket_silent(ws_client, db_session, capsys, monkeypatch):
    from app.shared.logging import configure_logging

    configure_logging("INFO")
    room, owner_session = _make_room_with_owner(ws_client, "restore-boom-ws@example.com")
    room_id = room["id"]
    await _seed_code_state(db_session, room_id, "print('before')\n")
    version_id = await _seed_version(db_session, room_id, "print('v1')\n", BASE_NOW)

    anon = _join_anonymously(ws_client, room)
    assert anon

    async def _boom(*args, **kwargs):
        raise RuntimeError("forced failure for the broadcast test")

    from app.features.versions import service

    monkeypatch.setattr(service, "_insert_version", _boom)

    ws_client.cookies.set("codelive_session", owner_session)

    with ws_client.websocket_connect(
        f"/api/ws/rooms/{room_id}",
        headers={"origin": _ORIGIN, "cookie": f"codelive_anon={anon}"},
    ) as spectator:
        _join(spectator, 1)
        resp = ws_client.post(f"/api/rooms/{room_id}/versions/{version_id}/restore")
        assert resp.status_code == 500

        # Starlette's sync WebSocketTestSession has no receive timeout, so the
        # silence proof is a join round-trip: any broadcast snapshot buffered by
        # the failed restore would be read before the presence frame.
        spectator.send_json({"type": "join"})
        assert spectator.receive_json()["type"] == "presence"


async def test_restore_unicode_content_is_byte_equal_everywhere(
    ws_client, db_session, capsys
):
    from app.shared.logging import configure_logging

    configure_logging("INFO")
    room, owner_session = _make_room_with_owner(ws_client, "restore-unicode@example.com")
    room_id = room["id"]

    owner_row = (
        await db_session.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": "restore-unicode@example.com"},
        )
    ).one()
    owner_id = owner_row.id

    await _seed_code_state(db_session, room_id, "print('current')\n")
    seeded = "print('résumé → ói')\n"
    version_id = await _seed_version(db_session, room_id, seeded, BASE_NOW)

    anon = _join_anonymously(ws_client, room)
    assert anon

    ws_client.cookies.set("codelive_session", owner_session)
    with ws_client.websocket_connect(
        f"/api/ws/rooms/{room_id}",
        headers={"origin": _ORIGIN, "cookie": f"codelive_anon={anon}"},
    ) as spectator:
        _join(spectator, 1)
        capsys.readouterr()
        resp = ws_client.post(f"/api/rooms/{room_id}/versions/{version_id}/restore")

        assert resp.status_code == 200
        body = resp.json()
        assert body["content"] == seeded  # exact str, not an escaped copy
        assert body["content_hash"] == hashlib.sha256(
            seeded.encode("utf-8")
        ).hexdigest()

        frame = spectator.receive_json()
        assert frame["type"] == "snapshot"
        assert frame["content"] == body["content"]  # REST == WS frame, byte-equal
        assert frame["content_hash"] == body["content_hash"]

    # The persisted state row carries the same bytes as the version row.
    state = (
        await db_session.execute(
            text("SELECT content FROM room_code_state WHERE room_id = :room_id"),
            {"room_id": uuid.UUID(room_id)},
        )
    ).one()
    assert state.content == seeded
    assert state.content.encode("utf-8") == body["content"].encode("utf-8")

    # The new version row: authored by the restoring owner, source language,
    # job-seeded row stays author-free.
    rows = (
        await db_session.execute(
            text(
                "SELECT id, content, language, author_id FROM code_versions "
                "WHERE room_id = :room_id ORDER BY created_at ASC"
            ),
            {"room_id": uuid.UUID(room_id)},
        )
    ).all()
    assert len(rows) == 2
    assert rows[0].content == seeded
    assert rows[0].author_id is None
    assert rows[1].id == uuid.UUID(body["id"])
    assert rows[1].content == seeded
    assert rows[1].language == "python"
    assert rows[1].author_id == owner_id
    assert str(rows[1].id) == body["id"]


async def test_restore_identical_content_still_writes_state_and_version(
    ws_client, db_session
):
    from app.shared.logging import configure_logging

    configure_logging("INFO")
    room, owner_session = _make_room_with_owner(ws_client, "restore-nodedup@example.com")
    room_id = room["id"]

    await _seed_code_state(db_session, room_id, "")
    version_id = await _seed_version(db_session, room_id, "", BASE_NOW)
    updated_before = await _state_updated_at(db_session, room_id)

    ws_client.cookies.set("codelive_session", owner_session)
    resp = ws_client.post(f"/api/rooms/{room_id}/versions/{version_id}/restore")

    # No dedup: identical content still writes state and appends a version row.
    assert resp.status_code == 200
    body = resp.json()
    assert body["content"] == ""
    assert body["content_hash"] == hashlib.sha256(b"").hexdigest()
    assert await _state_content(db_session, room_id) == ""
    updated_after = await _state_updated_at(db_session, room_id)
    assert updated_after >= updated_before
    assert await _count_versions(db_session, room_id) == 2


# --- VERS-07 (Phase 9): the restoring owner's own socket stays silent ------


def _register(ws_client, email, name="User"):
    """Register a user; returns its session cookie (local copy, D-12)."""
    resp = ws_client.post(
        "/api/auth/register",
        json={"name": name, "email": email, "password": "correct-horse"},
    )
    assert resp.status_code == 201
    return ws_client.cookies.get("codelive_session")


async def test_restore_snapshot_skips_owner_socket_and_reaches_spectators(
    ws_client, db_session, capsys
):
    """VERS-07: owner silent, anonymous spectator receives the snapshot.

    Runs the owner socket and an anonymous spectator together, restores over
    REST with the owner cookie, then proves the spectator got exactly one
    byte-equal snapshot with its own ``request_id`` while the owner's next
    frame after a re-join is ``presence`` (a stray snapshot would be buffered
    ahead of it — D-14).
    """
    from app.shared.logging import configure_logging

    configure_logging("INFO")
    room, owner_session = _make_room_with_owner(
        ws_client, "restore-owner-silent@example.com"
    )
    room_id = room["id"]

    seeded_content = "print('owner-silent')\n"
    version_id = await _seed_version(db_session, room_id, seeded_content, BASE_NOW)
    anon = _join_anonymously(ws_client, room)
    assert anon

    with ws_client.websocket_connect(
        f"/api/ws/rooms/{room_id}",
        headers={"origin": _ORIGIN, "cookie": f"codelive_session={owner_session}"},
    ) as owner_ws:
        _join(owner_ws, 1)
        with ws_client.websocket_connect(
            f"/api/ws/rooms/{room_id}",
            headers={"origin": _ORIGIN, "cookie": f"codelive_anon={anon}"},
        ) as spectator:
            join_snapshot = _join(spectator, 2)
            # Drain the presence caused by the spectator's join.
            peer_presence = owner_ws.receive_json()
            assert peer_presence["type"] == "presence"
            assert peer_presence["count"] == 2

            capsys.readouterr()  # flush join noise before the restore
            ws_client.cookies.clear()
            ws_client.cookies.set("codelive_session", owner_session)
            resp = ws_client.post(
                f"/api/rooms/{room_id}/versions/{version_id}/restore"
            )
            ws_client.cookies.clear()

            assert resp.status_code == 200
            body = resp.json()
            # C-03 / VERS-05: exactly {content, content_hash, id, created_at}
            assert set(body) == {"content", "content_hash", "id", "created_at"}
            assert body["content"] == seeded_content
            assert body["content_hash"] == hashlib.sha256(
                seeded_content.encode("utf-8")
            ).hexdigest()

            frame = spectator.receive_json()
            assert frame["type"] == "snapshot"
            assert frame["content"] == body["content"]
            assert frame["content_hash"] == body["content_hash"]
            assert frame["room_id"] == room_id
            assert frame["request_id"] == join_snapshot["request_id"]

            # D-14 owner silence: a buffered restore snapshot would be read
            # before this presence frame.
            owner_ws.send_json({"type": "join"})
            probe = owner_ws.receive_json()
            assert probe["type"] == "presence"
            assert probe["count"] == 2


async def test_restore_snapshot_reaches_authenticated_viewer_but_not_owner(
    ws_client, db_session, capsys
):
    """VERS-07: an authenticated viewer (not anonymous) still receives it."""
    from app.shared.logging import configure_logging

    configure_logging("INFO")
    room, owner_session = _make_room_with_owner(
        ws_client, "restore-viewer-owner@example.com"
    )
    room_id = room["id"]

    viewer_session = _register(ws_client, "restore-viewer@example.com", "Viewer")
    resp = ws_client.post(
        f"/api/rooms/{room_id}/join",
        json={"code": room["access_code"]},
        headers={"cookie": f"codelive_session={viewer_session}"},
    )
    assert resp.status_code == 200
    ws_client.cookies.clear()

    seeded_content = "print('viewer-gets-it')\n"
    version_id = await _seed_version(db_session, room_id, seeded_content, BASE_NOW)

    with ws_client.websocket_connect(
        f"/api/ws/rooms/{room_id}",
        headers={"origin": _ORIGIN, "cookie": f"codelive_session={owner_session}"},
    ) as owner_ws:
        _join(owner_ws, 1)
        with ws_client.websocket_connect(
            f"/api/ws/rooms/{room_id}",
            headers={"origin": _ORIGIN, "cookie": f"codelive_session={viewer_session}"},
        ) as viewer_ws:
            viewer_join = _join(viewer_ws, 2)
            peer_presence = owner_ws.receive_json()
            assert peer_presence["type"] == "presence"
            assert peer_presence["count"] == 2

            capsys.readouterr()  # flush join noise before the restore
            ws_client.cookies.set("codelive_session", owner_session)
            resp = ws_client.post(
                f"/api/rooms/{room_id}/versions/{version_id}/restore"
            )
            ws_client.cookies.clear()

            assert resp.status_code == 200
            body = resp.json()
            assert set(body) == {"content", "content_hash", "id", "created_at"}

            frame = viewer_ws.receive_json()
            assert frame["type"] == "snapshot"
            assert frame["content"] == body["content"] == seeded_content
            assert frame["content_hash"] == body["content_hash"]
            assert frame["room_id"] == room_id
            assert frame["request_id"] == viewer_join["request_id"]

            # D-14 owner silence via the presence round-trip.
            owner_ws.send_json({"type": "join"})
            probe = owner_ws.receive_json()
            assert probe["type"] == "presence"
            assert probe["count"] == 2


async def test_restore_logs_one_hydrated_line_without_content(
    ws_client, db_session, capsys
):
    from app.shared.logging import configure_logging

    configure_logging("INFO")
    room, owner_session = _make_room_with_owner(ws_client, "restore-log@example.com")
    room_id = room["id"]

    owner_row = (
        await db_session.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": "restore-log@example.com"},
        )
    ).one()
    owner_id = owner_row.id

    await _seed_code_state(db_session, room_id, "print('log-hygiene')\n")
    version_id = await _seed_version(db_session, room_id, "print('log-hygiene')\n", BASE_NOW)

    ws_client.cookies.set("codelive_session", owner_session)
    capsys.readouterr()
    resp = ws_client.post(f"/api/rooms/{room_id}/versions/{version_id}/restore")
    assert resp.status_code == 200
    body = resp.json()

    lines = _ndjson_lines(capsys)
    restored = [l for l in lines if l.get("event") == "version_restored"]
    assert len(restored) == 1, "exactly one version_restored line per successful restore"
    line = restored[0]
    assert set(line) == {
        "event",
        "room_id",
        "restored_version_id",
        "new_version_id",
        "content_hash",
        "user_id",
        "duration_ms",
        "request_id",
        "level",
        "timestamp",
    }
    assert line["room_id"] == room_id
    assert line["restored_version_id"] == str(version_id)
    assert line["new_version_id"] == body["id"]
    assert line["content_hash"] == body["content_hash"]
    assert line["user_id"] == str(owner_id)
    assert line["duration_ms"] >= 0
    assert uuid.UUID(line["request_id"]).version == 4  # middleware-minted uuid4
    assert line["request_id"] == resp.headers.get("x-request-id")
    assert "content" not in line, "the log line never carries a content key"
    assert "print('log-hygiene')" not in json.dumps(line), "raw content never appears in the log"
