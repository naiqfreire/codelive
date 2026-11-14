"""DB-backed tracer for the 30-second snapshot tick (VERS-02, D-05/D-06/D-07).

Seeds users/rooms/room_code_state via raw SQL exactly like
test_versions_retention.py, then calls app.features.versions.job.snapshot_tick()
directly (D-02: tests never enter the lifespan loop).
"""
import hashlib
import json
import time
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text

from app.shared.logging import configure_logging

pytestmark = pytest.mark.integration


def _ndjson_lines(capsys):
    out = capsys.readouterr().out
    return [json.loads(line) for line in out.splitlines() if line.strip()]


async def _make_user(db_session, name="Ana"):
    user_id = uuid.uuid7()
    await db_session.execute(
        text("INSERT INTO users (id, name, email, password_hash) VALUES (:id, :name, :email, :ph)"),
        {"id": user_id, "name": name, "email": f"{name.lower()}-{user_id}@example.com", "ph": "x"},
    )
    return user_id


async def _make_room(db_session, owner_id, code, status="active", language="python"):
    room_id = uuid.uuid7()
    await db_session.execute(
        text(
            "INSERT INTO rooms (id, owner_id, access_code, language, status) "
            "VALUES (:id, :owner, :code, :language, :status)"
        ),
        {"id": room_id, "owner": owner_id, "code": code, "language": language, "status": status},
    )
    return room_id


async def _set_state(db_session, room_id, content):
    await db_session.execute(
        text(
            "INSERT INTO room_code_state (id, room_id, content) VALUES (:id, :room, :content) "
            "ON CONFLICT (room_id) DO UPDATE SET content = EXCLUDED.content"
        ),
        {"id": uuid.uuid7(), "room": room_id, "content": content},
    )
    await db_session.commit()


async def _version_rows(db_session):
    rows = (
        await db_session.execute(
            text(
                "SELECT room_id, content, language, author_id FROM code_versions"
            )
        )
    ).all()
    return rows


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


async def test_changed_room_gets_exactly_one_snapshot(db_session, capsys):
    configure_logging("INFO")
    from app.features.versions import job

    owner = await _make_user(db_session)
    room = await _make_room(db_session, owner, "SNAP01")
    await _set_state(db_session, room, "print('hello')\n")

    capsys.readouterr()  # flush any noise before the tick
    await job.snapshot_tick()

    rows = await _version_rows(db_session)
    assert len(rows) == 1
    assert rows[0][0] == room
    assert bytes(rows[0][1], "utf-8") == b"print('hello')\n"
    assert rows[0][2] == "python"
    assert rows[0][3] is None  # job-written versions carry no author (Phase 6 D-10)

    lines = [l for l in _ndjson_lines(capsys) if l.get("event") == "snapshot"]
    assert len(lines) == 1
    line = lines[0]
    assert line["room_id"] == str(room)
    assert line["content_hash"] == hashlib.sha256(b"print('hello')\n").hexdigest()
    assert line["duration_ms"] >= 0
    assert "user_id" not in line
    assert "content" not in line


async def test_second_tick_writes_nothing_for_identical_content(db_session, capsys):
    configure_logging("INFO")
    from app.features.versions import job

    owner = await _make_user(db_session)
    room = await _make_room(db_session, owner, "SNAP02")
    await _set_state(db_session, room, "unchanged")

    await job.snapshot_tick()
    capsys.readouterr()  # flush first tick's lines
    await job.snapshot_tick()

    rows = await _version_rows(db_session)
    assert len(rows) == 1
    assert [l for l in _ndjson_lines(capsys) if l.get("event") == "snapshot"] == []


async def test_empty_content_is_skipped_and_closed_rooms_still_snapshot(db_session, capsys):
    configure_logging("INFO")
    from app.features.versions import job

    owner = await _make_user(db_session)
    empty_room = await _make_room(db_session, owner, "SNAP03")
    await _set_state(db_session, empty_room, "")
    closed_room = await _make_room(db_session, owner, "SNAP04", status="closed")
    await _set_state(db_session, closed_room, "closed but changed")

    capsys.readouterr()
    await job.snapshot_tick()

    rows = await _version_rows(db_session)
    assert [row[0] for row in rows] == [closed_room]
    assert rows[0][1] == "closed but changed"
    snapshot_lines = [l for l in _ndjson_lines(capsys) if l.get("event") == "snapshot"]
    assert len(snapshot_lines) == 1
    assert snapshot_lines[0]["room_id"] == str(closed_room)


async def test_purge_correlates_by_request_id(db_session, capsys):
    """Integration: seed expired+recent versions, reset last_purge, run tick;
    expired row is purged, recent survives, versions_purged shares request_id."""
    configure_logging("INFO")
    from app.features.versions import job, service

    job.last_purge = None  # force purge on first tick
    owner = await _make_user(db_session)
    room_id = await _make_room(db_session, owner, "SNAP05")
    # A non-empty current state that differs from the seeded latest version so
    # the tick writes one snapshot line to correlate against (D-17).
    await _set_state(db_session, room_id, "print('current')\n")

    now = datetime.now(timezone.utc)
    # Recent version (within retention window) — survives the purge.
    await db_session.execute(
        text(
            "INSERT INTO code_versions (id, room_id, content, language, author_id, created_at) "
            "VALUES (:id, :room, :content, :lang, :auth, :created)"
        ),
        {
            "id": uuid.uuid7(),
            "room": room_id,
            "content": "print('recent')\n",
            "lang": "python",
            "auth": None,
            "created": now - timedelta(days=1),
        },
    )
    # Expired version (strictly older than 30 days) — purged.
    await db_session.execute(
        text(
            "INSERT INTO code_versions (id, room_id, content, language, author_id, created_at) "
            "VALUES (:id, :room, :content, :lang, :auth, :created)"
        ),
        {
            "id": uuid.uuid7(),
            "room": room_id,
            "content": "print('old')\n",
            "lang": "python",
            "auth": None,
            "created": now - timedelta(days=service.RETENTION_DAYS + 1),
        },
    )
    await db_session.commit()

    capsys.readouterr()  # flush seeding noise
    await job.snapshot_tick(now=now)

    rows = await _version_rows(db_session)
    contents = [r[1] for r in rows]
    assert "print('old')\n" not in contents, "expired version must be purged"
    assert "print('recent')\n" in contents, "recent version must survive"

    lines = _ndjson_lines(capsys)
    snapshot_lines = [l for l in lines if l.get("event") == "snapshot"]
    purged_lines = [l for l in lines if l.get("event") == "versions_purged"]
    assert len(snapshot_lines) == 1, "the tick must write exactly one snapshot line"
    assert len(purged_lines) == 1, "the tick must emit exactly one versions_purged line"
    assert purged_lines[0]["deleted_count"] == 1
    # D-17: the purge line and the snapshot line share the run's request_id.
    assert purged_lines[0]["request_id"] == snapshot_lines[0]["request_id"]
    assert uuid.UUID(purged_lines[0]["request_id"]).version == 7


# ---------------------------------------------------------------------------
# 07-02 Task 2: lifespan lifecycle proof + failing-tick isolation (VERS-03)
# ---------------------------------------------------------------------------

_ORIGIN = "http://localhost:5173"


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


def _connect_owner(ws_client, room_id, owner_session):
    return ws_client.websocket_connect(
        f"/api/ws/rooms/{room_id}",
        headers={"origin": _ORIGIN, "cookie": f"codelive_session={owner_session}"},
    )


def _join(ws, expected_count):
    """Send join; expect presence then the joiner-only snapshot (D-07)."""
    ws.send_json({"type": "join"})
    frame = ws.receive_json()
    assert frame["type"] == "presence"
    assert frame["count"] == expected_count
    snapshot = ws.receive_json()
    assert snapshot["type"] == "snapshot"
    return frame


async def test_lifespan_starts_the_loop_and_cancels_cleanly(
    db_session, test_engine, monkeypatch
):
    """07-02-06: entering the lifespan fires exactly one tick (sentinel room
    gains exactly one version); exiting cancels the task and returns cleanly."""
    import asyncio

    from sqlalchemy.ext.asyncio import async_sessionmaker

    import app.features.versions.job as job_module
    from app.main import app

    factory = async_sessionmaker(test_engine, expire_on_commit=False)
    monkeypatch.setattr(job_module, "get_sessionmaker", lambda: factory)

    owner = await _make_user(db_session)
    room_id = await _make_room(db_session, owner, "LIFE01")
    await _set_state(db_session, room_id, "print('lifespan')\n")

    async with app.router.lifespan_context(app):
        deadline = time.monotonic() + 10
        while True:
            count = (
                await db_session.execute(
                    text("SELECT COUNT(*) FROM code_versions WHERE room_id = :room_id"),
                    {"room_id": room_id},
                )
            ).scalar_one()
            if count == 1:
                break
            assert time.monotonic() < deadline, "lifespan tick never wrote the snapshot"
            await asyncio.sleep(0.05)

    # exiting the context cancelled the task and returned without raising
    assert True


async def test_lifespan_tick_cannot_reach_the_main_dev_db(test_engine, monkeypatch):
    """07-02-06: the symbol job.run_forever resolves is the patched test factory,
    so no lifespan tick can reach the main dev database (Pitfall 1)."""
    import asyncio

    from sqlalchemy.ext.asyncio import async_sessionmaker

    import app.features.versions.job as job_module
    from app.main import app
    from app.shared.database import get_sessionmaker as real_get_sessionmaker

    factory = async_sessionmaker(test_engine, expire_on_commit=False)
    monkeypatch.setattr(job_module, "get_sessionmaker", lambda: factory)

    async with app.router.lifespan_context(app):
        # seam identity: the patched symbol is the one run_forever resolves
        assert job_module.get_sessionmaker is not real_get_sessionmaker
        assert job_module.get_sessionmaker() is factory
        await asyncio.sleep(0.05)


async def test_failed_tick_does_not_interrupt_editing(
    ws_client, db_session, capsys, monkeypatch
):
    """07-02-07 / VERS-03 / D-13: with create_version failing, the owner's WS
    code_update still persists and broadcasts, snapshot_tick() returns normally
    with a snapshot_failed line, and the socket stays open."""
    import hashlib

    from app.features.versions import job, service
    from app.shared.logging import configure_logging

    configure_logging("INFO")
    capsys.readouterr()  # flush lifespan startup noise

    room, owner = _make_room_with_owner(ws_client, "ws-failed-tick@example.com")
    await _seed_code_state(db_session, room["id"], "print('before')\n")

    async def _boom(session, room_id, content, language):
        raise RuntimeError("create_version exploded")

    monkeypatch.setattr(service, "create_version", _boom)

    with _connect_owner(ws_client, room["id"], owner) as ws_owner:
        _join(ws_owner, 1)
        ws_owner.send_json({"type": "code_update", "content": "print('after')\n"})
        frame = ws_owner.receive_json()
        assert frame["type"] == "code_update"
        assert frame["content"] == "print('after')\n"
        assert frame["content_hash"] == hashlib.sha256(b"print('after')\n").hexdigest()
        # the socket stays open: a join round-trip still succeeds afterwards
        ws_owner.send_json({"type": "join"})
        assert ws_owner.receive_json()["type"] == "presence"

    row = (
        await db_session.execute(
            text("SELECT content FROM room_code_state WHERE room_id = :room_id"),
            {"room_id": uuid.UUID(room["id"])},
        )
    ).one()
    assert row.content == "print('after')\n", "the edit must persist despite the failing job"

    capsys.readouterr()  # flush WS noise before the direct tick
    await job.snapshot_tick()  # must return normally, not raise

    lines = _ndjson_lines(capsys)
    failed = [l for l in lines if l.get("event") == "snapshot_failed"]
    assert len(failed) == 1, "the failed tick logs exactly one snapshot_failed line"
    assert failed[0]["error_type"] == "RuntimeError"
    assert "content" not in failed[0], "no raw content in the failure line"
    assert "user_id" not in failed[0], "no user identifier in the failure line"
    assert failed[0]["room_id"] == room["id"]
