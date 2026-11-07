"""Rooms schema: columns, constraints and indexes read from PostgreSQL catalogs."""
import pytest
from sqlalchemy import text

pytestmark = pytest.mark.integration


async def test_rooms_schema_columns(db_session):
    rows = (
        await db_session.execute(
            text(
                "SELECT column_name, data_type, character_maximum_length, "
                "is_nullable, column_default FROM information_schema.columns "
                "WHERE table_name = 'rooms'"
            )
        )
    ).all()
    cols = {r[0]: r for r in rows}
    assert set(cols) == {
        "id",
        "owner_id",
        "access_code",
        "language",
        "status",
        "created_at",
        "updated_at",
    }
    assert cols["id"][1] == "uuid" and cols["id"][3] == "NO"
    assert cols["owner_id"][1] == "uuid" and cols["owner_id"][3] == "NO"
    assert cols["access_code"][1] == "character varying"
    assert cols["access_code"][2] == 6 and cols["access_code"][3] == "NO"
    assert cols["language"][1] == "character varying"
    assert cols["language"][2] == 20 and cols["language"][3] == "NO"
    assert cols["status"][1] == "character varying"
    assert cols["status"][2] == 20 and cols["status"][3] == "NO"
    assert "active" in (cols["status"][4] or "")
    for ts in ("created_at", "updated_at"):
        assert cols[ts][1] == "timestamp with time zone"
        assert cols[ts][3] == "NO"
        assert "now()" in (cols[ts][4] or "")


async def test_rooms_schema_constraints(db_session):
    rows = (
        await db_session.execute(
            text(
                "SELECT conname, contype, confdeltype, pg_get_constraintdef(oid) "
                "FROM pg_constraint WHERE conrelid = 'rooms'::regclass "
                "AND contype IN ('p', 'u', 'c', 'f')"
            )
        )
    ).all()
    by_name = {r[0]: r for r in rows}
    assert set(by_name) == {
        "pk_rooms",
        "uq_rooms_access_code",
        "ck_rooms_status_valid",
        "fk_rooms_owner_id_users",
    }
    assert by_name["fk_rooms_owner_id_users"][2] == "r"
    check_def = by_name["ck_rooms_status_valid"][3]
    assert "active" in check_def and "closed" in check_def
    indexes = (
        await db_session.execute(
            text("SELECT indexname FROM pg_indexes WHERE tablename = 'rooms'")
        )
    ).all()
    index_names = {r[0] for r in indexes}
    assert "ix_rooms_owner_id" in index_names
    assert "uq_rooms_access_code" in index_names


async def test_rooms_has_no_language_check(db_session):
    count = (
        await db_session.execute(
            text(
                "SELECT count(*) FROM pg_constraint "
                "WHERE conrelid = 'rooms'::regclass AND contype = 'c'"
            )
        )
    ).scalar()
    assert count == 1
