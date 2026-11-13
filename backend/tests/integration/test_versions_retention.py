"""Retention semantics against real PostgreSQL (VERS-06, D-05/D-07/D-08)."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text

from app.features.versions import service

pytestmark = pytest.mark.integration

BASE_NOW = datetime(2026, 11, 13, 12, 0, 0, tzinfo=timezone.utc)


async def _make_user(db_session, name="Ana"):
    user_id = uuid.uuid7()
    await db_session.execute(
        text("INSERT INTO users (id, name, email, password_hash) VALUES (:id, :name, :email, :ph)"),
        {"id": user_id, "name": name, "email": f"{name.lower()}-{user_id}@example.com", "ph": "x"},
    )
    return user_id


async def _make_room(db_session, owner_id, code):
    room_id = uuid.uuid7()
    await db_session.execute(
        text(
            "INSERT INTO rooms (id, owner_id, access_code, language, status) "
            "VALUES (:id, :owner, :code, 'python', 'active')"
        ),
        {"id": room_id, "owner": owner_id, "code": code},
    )
    return room_id


async def _seed(db_session, rows):
    """Insert versions backdated via explicit created_at (D-05)."""
    for label, room_id, age_days, author_id in rows:
        await db_session.execute(
            text(
                "INSERT INTO code_versions (id, room_id, content, language, author_id, created_at) "
                "VALUES (:id, :room, :content, 'python', :author, :created)"
            ),
            {
                "id": uuid.uuid7(),
                "room": room_id,
                "content": label,
                "author": author_id,
                "created": BASE_NOW - timedelta(days=age_days),
            },
        )
    await db_session.commit()


async def _labels(db_session):
    rows = (
        await db_session.execute(text("SELECT content FROM code_versions"))
    ).all()
    return {row[0] for row in rows}


async def test_room_delete_cascades_versions(db_session):
    owner = await _make_user(db_session)
    room = await _make_room(db_session, owner, "CASC01")
    await _seed(db_session, [("v1", room, 1, None), ("v2", room, 40, None)])

    await db_session.execute(text("DELETE FROM rooms WHERE id = :id"), {"id": room})
    await db_session.commit()

    assert await _labels(db_session) == set()


async def test_author_delete_sets_author_id_null(db_session):
    owner = await _make_user(db_session, "Owner")
    author = await _make_user(db_session, "Author")
    room = await _make_room(db_session, owner, "SETN01")
    await _seed(db_session, [("v-authored", room, 1, author)])

    await db_session.execute(text("DELETE FROM users WHERE id = :id"), {"id": author})
    await db_session.commit()

    rows = (
        await db_session.execute(
            text("SELECT content, author_id FROM code_versions")
        )
    ).all()
    assert [row[0] for row in rows] == ["v-authored"]
    assert rows[0][1] is None


async def _insert_version(db_session, label, room_id, created, vid=None, author_id=None):
    await db_session.execute(
        text(
            "INSERT INTO code_versions (id, room_id, content, language, author_id, created_at) "
            "VALUES (:id, :room, :content, 'python', :author, :created)"
        ),
        {
            "id": vid or uuid.uuid7(),
            "room": room_id,
            "content": label,
            "author": author_id,
            "created": created,
        },
    )


async def test_retention_keeps_newest_per_room(db_session):
    owner = await _make_user(db_session)
    rooms = {
        code: await _make_room(db_session, owner, code)
        for code in ["RMT001", "RMT002", "RMT003", "RMT004", "RMT005", "RMT006", "RMT007"]
    }
    # Room A: two old versions + a recent one — only the recent survives.
    await _insert_version(db_session, "A-old-1", rooms["RMT001"], BASE_NOW - timedelta(days=90))
    await _insert_version(db_session, "A-old-2", rooms["RMT001"], BASE_NOW - timedelta(days=60))
    await _insert_version(db_session, "A-newest", rooms["RMT001"], BASE_NOW - timedelta(days=10))
    # Room B: a single 90-day-old version — newest per room beats age.
    await _insert_version(db_session, "B-only", rooms["RMT002"], BASE_NOW - timedelta(days=90))
    # Room C: recent + exactly-30-day boundary — both survive (D-08).
    await _insert_version(db_session, "C-recent", rooms["RMT003"], BASE_NOW - timedelta(days=5))
    await _insert_version(db_session, "C-boundary", rooms["RMT003"], BASE_NOW - timedelta(days=30))
    # Room D: a lone exactly-30-day-old version — boundary survives.
    await _insert_version(db_session, "D-boundary-only", rooms["RMT004"], BASE_NOW - timedelta(days=30))
    # Room E: two old versions — the newer of the two survives.
    await _insert_version(db_session, "E-old-1", rooms["RMT005"], BASE_NOW - timedelta(days=90))
    await _insert_version(db_session, "E-old-2", rooms["RMT005"], BASE_NOW - timedelta(days=60))
    # Room F: same created_at, tie broken by higher id (D-07).
    tie_at = BASE_NOW - timedelta(days=40)
    await _insert_version(db_session, "F-tie-low", rooms["RMT006"], tie_at, vid=uuid.UUID(int=1))
    await _insert_version(db_session, "F-tie-high", rooms["RMT006"], tie_at, vid=uuid.UUID(int=2))
    # Room G: two recent versions — both survive.
    await _insert_version(db_session, "G-recent-1", rooms["RMT007"], BASE_NOW - timedelta(days=1))
    await _insert_version(db_session, "G-recent-2", rooms["RMT007"], BASE_NOW - timedelta(days=2))
    await db_session.commit()

    deleted = await service.purge_expired_versions(db_session, now=BASE_NOW)

    assert deleted == 4
    assert await _labels(db_session) == {
        "A-newest",
        "B-only",
        "C-recent",
        "C-boundary",
        "D-boundary-only",
        "E-old-2",
        "F-tie-high",
        "G-recent-1",
        "G-recent-2",
    }


async def test_single_old_version_survives(db_session):
    owner = await _make_user(db_session)
    room = await _make_room(db_session, owner, "SGL001")
    await _insert_version(db_session, "lone-old", room, BASE_NOW - timedelta(days=90))
    await db_session.commit()

    await service.purge_expired_versions(db_session, now=BASE_NOW)

    assert await _labels(db_session) == {"lone-old"}


async def test_cutoff_is_strictly_older_than_30_days(db_session):
    assert service.retention_cutoff(BASE_NOW) == BASE_NOW - timedelta(days=30)

    owner = await _make_user(db_session)
    room_p = await _make_room(db_session, owner, "BND001")
    room_q = await _make_room(db_session, owner, "BND002")
    await _insert_version(db_session, "P-recent", room_p, BASE_NOW - timedelta(days=1))
    await _insert_version(db_session, "P-exactly-30d", room_p, BASE_NOW - timedelta(days=30))
    await _insert_version(db_session, "Q-recent", room_q, BASE_NOW - timedelta(days=1))
    await _insert_version(
        db_session,
        "Q-30d-plus-1us",
        room_q,
        BASE_NOW - timedelta(days=30) - timedelta(microseconds=1),
    )
    await db_session.commit()

    await service.purge_expired_versions(db_session, now=BASE_NOW)

    assert await _labels(db_session) == {"P-recent", "P-exactly-30d", "Q-recent"}


async def test_tie_on_created_at_keeps_higher_id(db_session):
    owner = await _make_user(db_session)
    room = await _make_room(db_session, owner, "TIE001")
    tie_at = BASE_NOW - timedelta(days=40)
    await _insert_version(db_session, "tie-low", room, tie_at, vid=uuid.UUID(int=100))
    await _insert_version(db_session, "tie-high", room, tie_at, vid=uuid.UUID(int=200))
    await db_session.commit()

    await service.purge_expired_versions(db_session, now=BASE_NOW)

    assert await _labels(db_session) == {"tie-high"}


async def test_purge_is_idempotent(db_session):
    owner = await _make_user(db_session)
    room = await _make_room(db_session, owner, "IDM001")
    await _insert_version(db_session, "old-1", room, BASE_NOW - timedelta(days=90))
    await _insert_version(db_session, "old-2", room, BASE_NOW - timedelta(days=60))
    await _insert_version(db_session, "new", room, BASE_NOW - timedelta(days=1))
    await db_session.commit()

    first = await service.purge_expired_versions(db_session, now=BASE_NOW)
    second = await service.purge_expired_versions(db_session, now=BASE_NOW)

    assert first == 2
    assert second == 0
    assert await _labels(db_session) == {"new"}
