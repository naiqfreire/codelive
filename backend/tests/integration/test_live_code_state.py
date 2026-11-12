"""read_current_state: read-or-empty path against the TEST engine (D-13)."""
import uuid

import pytest
from sqlalchemy import text

from app.features.live_code.service import MAX_CODE_BYTES, persist_code_update, read_current_state

pytestmark = pytest.mark.integration


async def _make_room(db_session):
    user_id = uuid.uuid7()
    room_id = uuid.uuid7()
    await db_session.execute(
        text("INSERT INTO users (id, name, email, password_hash) VALUES (:id, :name, :email, :ph)"),
        {"id": user_id, "name": "Ana", "email": f"ana-{user_id}@example.com", "ph": "x"},
    )
    await db_session.execute(
        text(
            "INSERT INTO rooms (id, owner_id, access_code, language, status) "
            "VALUES (:id, :owner, :code, :lang, :status)"
        ),
        {"id": room_id, "owner": user_id, "code": "ABC234", "lang": "python", "status": "active"},
    )
    return room_id


async def test_read_current_state_returns_none_when_no_row(db_session):
    room_id = await _make_room(db_session)
    assert await read_current_state(db_session, room_id) is None


async def test_read_current_state_returns_row(db_session):
    room_id = await _make_room(db_session)
    await db_session.execute(
        text("INSERT INTO room_code_state (id, room_id, content) VALUES (:id, :room_id, :content)"),
        {"id": uuid.uuid7(), "room_id": room_id, "content": "print('hi')\n"},
    )
    await db_session.commit()
    state = await read_current_state(db_session, room_id)
    assert state is not None
    assert state.room_id == room_id
    assert state.content == "print('hi')\n"


async def test_read_current_state_returns_empty_string_row(db_session):
    room_id = await _make_room(db_session)
    await db_session.execute(
        text("INSERT INTO room_code_state (id, room_id, content) VALUES (:id, :room_id, :content)"),
        {"id": uuid.uuid7(), "room_id": room_id, "content": ""},
    )
    await db_session.commit()
    state = await read_current_state(db_session, room_id)
    assert state is not None
    assert state.content == ""


async def test_persist_code_update_creates_row_when_missing(db_session):
    """Get-or-create (D-13): a room with no row gets its row on first write."""
    room_id = await _make_room(db_session)
    state = await persist_code_update(db_session, room_id, "print('first')\n")
    assert state.room_id == room_id
    assert state.content == "print('first')\n"
    rows = (
        await db_session.execute(
            text("SELECT content FROM room_code_state WHERE room_id = :room_id"),
            {"room_id": room_id},
        )
    ).all()
    assert [row.content for row in rows] == ["print('first')\n"]


async def test_persist_code_update_updates_existing_row_atomically(db_session):
    """INSERT ... ON CONFLICT (room_id) DO UPDATE: one row, latest content."""
    room_id = await _make_room(db_session)
    first = await persist_code_update(db_session, room_id, "before")
    second = await persist_code_update(db_session, room_id, "after")
    assert second.content == "after"
    assert second.id == first.id  # same row, updated in place
    rows = (
        await db_session.execute(
            text("SELECT content FROM room_code_state WHERE room_id = :room_id"),
            {"room_id": room_id},
        )
    ).all()
    assert [row.content for row in rows] == ["after"]


async def test_persist_code_update_accepts_exactly_max_code_bytes(db_session):
    room_id = await _make_room(db_session)
    payload = "A" * MAX_CODE_BYTES
    state = await persist_code_update(db_session, room_id, payload)
    assert state.content == payload
