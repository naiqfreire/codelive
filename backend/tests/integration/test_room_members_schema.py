"""Room members schema: columns, constraints and behaviour read from PostgreSQL."""
import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

pytestmark = pytest.mark.integration


async def _make_user_and_room(db_session):
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
    return user_id, room_id


async def _insert_member(db_session, user_id, room_id, **overrides):
    row = {
        "id": uuid.uuid7(),
        "room_id": room_id,
        "user_id": user_id,
        "anonymous_session_id": None,
        "nickname": None,
        "role": "owner",
        "is_anonymous": False,
    }
    row.update(overrides)
    await db_session.execute(
        text(
            "INSERT INTO room_members "
            "(id, room_id, user_id, anonymous_session_id, nickname, role, is_anonymous) "
            "VALUES (:id, :room_id, :user_id, :anonymous_session_id, :nickname, :role, :is_anonymous)"
        ),
        row,
    )


async def test_room_members_schema_constraints(db_session):
    rows = (
        await db_session.execute(
            text(
                "SELECT column_name, data_type, character_maximum_length, "
                "is_nullable, column_default FROM information_schema.columns "
                "WHERE table_name = 'room_members'"
            )
        )
    ).all()
    cols = {r[0]: r for r in rows}
    assert set(cols) == {
        "id",
        "room_id",
        "user_id",
        "anonymous_session_id",
        "nickname",
        "role",
        "is_anonymous",
        "joined_at",
    }
    assert cols["id"][1] == "uuid" and cols["id"][3] == "NO"
    assert cols["room_id"][1] == "uuid" and cols["room_id"][3] == "NO"
    assert cols["user_id"][1] == "uuid" and cols["user_id"][3] == "YES"
    assert cols["anonymous_session_id"][1] == "character varying"
    assert cols["anonymous_session_id"][2] == 64 and cols["anonymous_session_id"][3] == "YES"
    assert cols["nickname"][1] == "character varying"
    assert cols["nickname"][2] == 60 and cols["nickname"][3] == "YES"
    assert cols["role"][1] == "character varying" and cols["role"][3] == "NO"
    assert cols["is_anonymous"][1] == "boolean" and cols["is_anonymous"][3] == "NO"
    assert cols["joined_at"][1] == "timestamp with time zone"
    assert cols["joined_at"][3] == "NO"
    assert "now()" in (cols["joined_at"][4] or "")

    rows = (
        await db_session.execute(
            text(
                "SELECT conname, contype, confdeltype, pg_get_constraintdef(oid) "
                "FROM pg_constraint WHERE conrelid = 'room_members'::regclass "
                "AND contype IN ('p', 'u', 'c', 'f')"
            )
        )
    ).all()
    by_name = {r[0]: r for r in rows}
    assert set(by_name) == {
        "pk_room_members",
        "uq_room_members_room_user",
        "uq_room_members_room_anon",
        "ck_room_members_role_valid",
        "ck_room_members_identity_consistent",
        "ck_room_members_nickname_required",
        "fk_room_members_room_id_rooms",
        "fk_room_members_user_id_users",
    }
    assert by_name["fk_room_members_room_id_rooms"][2] == "c"
    assert by_name["fk_room_members_user_id_users"][2] == "r"

    indexes = (
        await db_session.execute(
            text("SELECT indexname FROM pg_indexes WHERE tablename = 'room_members'")
        )
    ).all()
    index_names = {r[0] for r in indexes}
    assert "ix_room_members_user_id" in index_names
    assert "ix_room_members_room_id" not in index_names


async def test_duplicate_user_membership_rejected(db_session):
    user_id, room_id = await _make_user_and_room(db_session)
    await _insert_member(db_session, user_id, room_id)
    await db_session.flush()
    with pytest.raises(IntegrityError) as excinfo:
        await _insert_member(db_session, user_id, room_id)
        await db_session.flush()
    assert "uq_room_members_room_user" in str(excinfo.value)


async def test_two_null_anonymous_memberships_allowed(db_session):
    user_id, room_id = await _make_user_and_room(db_session)
    # Two authenticated rows (anonymous_session_id IS NULL) coexist: NULLs are
    # distinct for uq_room_members_room_anon.
    user2 = uuid.uuid7()
    await db_session.execute(
        text("INSERT INTO users (id, name, email, password_hash) VALUES (:id, 'Bia', :email, 'x')"),
        {"id": user2, "email": f"bia-{user2}@example.com"},
    )
    await _insert_member(db_session, user_id, room_id, role="viewer")
    await _insert_member(db_session, user2, room_id, role="viewer")
    await db_session.flush()
    count = (
        await db_session.execute(
            text(
                "SELECT count(*) FROM room_members WHERE room_id = :room "
                "AND user_id IS NOT NULL AND anonymous_session_id IS NULL"
            ),
            {"room": room_id},
        )
    ).scalar()
    assert count == 2


async def test_anonymous_row_requires_non_blank_nickname(db_session):
    _user_id, room_id = await _make_user_and_room(db_session)
    with pytest.raises(IntegrityError) as excinfo:
        await _insert_member(
            db_session,
            None,
            room_id,
            anonymous_session_id="anon-1",
            nickname="   ",
            role="viewer",
            is_anonymous=True,
        )
        await db_session.flush()
    assert "ck_room_members_nickname_required" in str(excinfo.value)
    await db_session.rollback()
    _user_id, room_id = await _make_user_and_room(db_session)
    await _insert_member(
        db_session,
        None,
        room_id,
        anonymous_session_id="anon-1",
        nickname="Ana",
        role="viewer",
        is_anonymous=True,
    )
    await db_session.flush()


async def test_identity_check_rejects_mixed_rows(db_session):
    user_id, room_id = await _make_user_and_room(db_session)
    with pytest.raises(IntegrityError) as excinfo:
        await _insert_member(
            db_session,
            user_id,
            room_id,
            anonymous_session_id="anon-1",
            nickname="Ana",
            role="viewer",
            is_anonymous=True,
        )
        await db_session.flush()
    assert "ck_room_members_identity_consistent" in str(excinfo.value)
    await db_session.rollback()
    user_id, room_id = await _make_user_and_room(db_session)
    with pytest.raises(IntegrityError) as excinfo2:
        await _insert_member(
            db_session,
            user_id,
            room_id,
            anonymous_session_id="anon-2",
            nickname=None,
            role="owner",
            is_anonymous=False,
        )
        await db_session.flush()
    assert "ck_room_members_identity_consistent" in str(excinfo2.value)


async def test_role_check_rejects_unknown_role(db_session):
    user_id, room_id = await _make_user_and_room(db_session)
    with pytest.raises(IntegrityError) as excinfo:
        await _insert_member(db_session, user_id, room_id, role="admin")
        await db_session.flush()
    assert "ck_room_members_role_valid" in str(excinfo.value)


async def test_deleting_room_cascades_members(db_session):
    user_id, room_id = await _make_user_and_room(db_session)
    await _insert_member(db_session, user_id, room_id)
    await db_session.flush()
    await db_session.execute(text("DELETE FROM rooms WHERE id = :id"), {"id": room_id})
    count = (
        await db_session.execute(
            text("SELECT count(*) FROM room_members WHERE room_id = :id"), {"id": room_id}
        )
    ).scalar()
    assert count == 0
    # RESTRICT: deleting a user with a membership is refused
    await db_session.rollback()
    user_id, room_id = await _make_user_and_room(db_session)
    await _insert_member(db_session, user_id, room_id)
    await db_session.flush()
    with pytest.raises(IntegrityError):
        await db_session.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})
        await db_session.flush()
