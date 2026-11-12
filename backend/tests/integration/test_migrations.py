"""Migration reversibility on a dedicated scratch database."""
import os
import subprocess
import sys
import uuid
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

pytestmark = [pytest.mark.integration, pytest.mark.slow]

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent


@pytest.fixture(scope="module")
async def scratch_url(test_database_url):
    scratch_name = "codelive_migrationtest"
    server_url = test_database_url.rsplit("/", 1)[0] + "/postgres"
    engine = create_async_engine(server_url, isolation_level="AUTOCOMMIT")
    try:
        async with engine.begin() as conn:
            await conn.execute(text(f"DROP DATABASE IF EXISTS {scratch_name}"))
            await conn.execute(text(f"CREATE DATABASE {scratch_name}"))
        yield test_database_url.rsplit("/", 1)[0] + f"/{scratch_name}"
    finally:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                    "WHERE datname = :name AND pid <> pg_backend_pid()"
                ),
                {"name": scratch_name},
            )
            await conn.execute(text(f"DROP DATABASE IF EXISTS {scratch_name}"))
        await engine.dispose()


def _alembic(*args, url):
    return subprocess.run(
        [sys.executable, "-m", "alembic", "-c", "backend/alembic.ini", *args],
        cwd=str(REPO_ROOT),
        env={**os.environ, "DATABASE_URL": url},
        capture_output=True,
        text=True,
    )


async def test_upgrade_head_reads_database_url_from_dotenv(scratch_url, tmp_path):
    """Regression: alembic must find DATABASE_URL in a .env even when the
    process environment does not export it (tutorial flow)."""
    (tmp_path / ".env").write_text(f"DATABASE_URL={scratch_url}\n")
    env = {k: v for k, v in os.environ.items() if k != "DATABASE_URL"}
    env["PYTHONPATH"] = str(REPO_ROOT / "backend")
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "-c", str(REPO_ROOT / "backend" / "alembic.ini"), "upgrade", "head"],
        cwd=str(tmp_path),
        env=env,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    tables = await _table_names(scratch_url)
    assert {"users", "rooms", "room_members"} <= tables


async def _table_names(url):
    engine = create_async_engine(url, isolation_level="AUTOCOMMIT")
    try:
        async with engine.connect() as conn:
            result = await conn.execute(
                text(
                    "SELECT table_name FROM information_schema.tables "
                    "WHERE table_schema = 'public'"
                )
            )
            return {row[0] for row in result.all()}
    finally:
        await engine.dispose()


async def test_upgrade_head_downgrade_base_upgrade_head(scratch_url):
    result = _alembic("upgrade", "head", url=scratch_url)
    assert result.returncode == 0, result.stdout + result.stderr
    tables = await _table_names(scratch_url)
    assert {"users", "rooms", "room_members"} <= tables

    result = _alembic("downgrade", "base", url=scratch_url)
    assert result.returncode == 0, result.stdout + result.stderr
    tables = await _table_names(scratch_url)
    assert tables == {"alembic_version"}

    result = _alembic("upgrade", "head", url=scratch_url)
    assert result.returncode == 0, result.stdout + result.stderr
    tables = await _table_names(scratch_url)
    assert {"users", "rooms", "room_members"} <= tables

    result = _alembic("check", url=scratch_url)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "No new upgrade operations detected" in result.stdout


async def test_downgrade_0002_drops_only_members(scratch_url):
    result = _alembic("upgrade", "head", url=scratch_url)
    assert result.returncode == 0, result.stdout + result.stderr

    result = _alembic("downgrade", "0002", url=scratch_url)
    assert result.returncode == 0, result.stdout + result.stderr
    tables = await _table_names(scratch_url)
    assert "room_members" not in tables
    assert {"rooms", "users", "alembic_version"} <= tables

    result = _alembic("upgrade", "head", url=scratch_url)
    assert result.returncode == 0, result.stdout + result.stderr
    tables = await _table_names(scratch_url)
    assert "room_members" in tables


async def test_room_code_state_backfill_and_reversibility(scratch_url):
    """Revision 0004 backfills one empty room_code_state row per pre-existing
    room, and downgrade -1 removes the table without touching rooms."""
    # Deterministic starting point: empty schema, then up to 0003 only.
    result = _alembic("downgrade", "base", url=scratch_url)
    assert result.returncode == 0, result.stdout + result.stderr
    result = _alembic("upgrade", "0003", url=scratch_url)
    assert result.returncode == 0, result.stdout + result.stderr

    user_id = uuid.uuid4()
    room_a, room_b = uuid.uuid4(), uuid.uuid4()
    engine = create_async_engine(scratch_url, isolation_level="AUTOCOMMIT")
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    "INSERT INTO users (id, name, email, password_hash) "
                    "VALUES (:id, :name, :email, :hash)"
                ),
                {
                    "id": user_id,
                    "name": "Backfill Owner",
                    "email": f"backfill-{user_id}@example.com",
                    "hash": "not-a-real-hash",
                },
            )
            for rid, code in ((room_a, "BFT001"), (room_b, "BFT002")):
                await conn.execute(
                    text(
                        "INSERT INTO rooms (id, owner_id, access_code, language) "
                        "VALUES (:id, :owner, :code, 'python')"
                    ),
                    {"id": rid, "owner": user_id, "code": code},
                )

        # Upgrade to head (0004): table created + backfill runs.
        result = _alembic("upgrade", "head", url=scratch_url)
        assert result.returncode == 0, result.stdout + result.stderr

        async with engine.connect() as conn:
            rows = (
                await conn.execute(
                    text("SELECT room_id, content FROM room_code_state")
                )
            ).all()
        by_room = {row.room_id: row.content for row in rows}
        assert by_room[room_a] == ""
        assert by_room[room_b] == ""

        # downgrade -1 drops only room_code_state.
        result = _alembic("downgrade", "-1", url=scratch_url)
        assert result.returncode == 0, result.stdout + result.stderr
        tables = await _table_names(scratch_url)
        assert "room_code_state" not in tables
        assert {"rooms", "room_members", "users", "alembic_version"} <= tables

        # Re-upgrade re-creates the table and re-backfills from rooms.
        result = _alembic("upgrade", "head", url=scratch_url)
        assert result.returncode == 0, result.stdout + result.stderr
        async with engine.connect() as conn:
            rows = (
                await conn.execute(
                    text("SELECT room_id, content FROM room_code_state")
                )
            ).all()
        by_room = {row.room_id: row.content for row in rows}
        assert by_room[room_a] == ""
        assert by_room[room_b] == ""
    finally:
        await engine.dispose()


async def test_room_code_state_contract(scratch_url):
    """Lock the exact SPEC §6 contract of revision 0004:
    uq constraint name, exact column set (no extras), FK ondelete CASCADE,
    and backfilled content = '' (never NULL)."""
    result = _alembic("downgrade", "base", url=scratch_url)
    assert result.returncode == 0, result.stdout + result.stderr

    # Seed rooms at 0003 so the 0004 backfill has work to do.
    result = _alembic("upgrade", "0003", url=scratch_url)
    assert result.returncode == 0, result.stdout + result.stderr
    user_id = uuid.uuid4()
    room_id = uuid.uuid4()
    engine = create_async_engine(scratch_url, isolation_level="AUTOCOMMIT")
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    "INSERT INTO users (id, name, email, password_hash) "
                    "VALUES (:id, :name, :email, :hash)"
                ),
                {
                    "id": user_id,
                    "name": "Contract Owner",
                    "email": f"contract-{user_id}@example.com",
                    "hash": "not-a-real-hash",
                },
            )
            await conn.execute(
                text(
                    "INSERT INTO rooms (id, owner_id, access_code, language) "
                    "VALUES (:id, :owner, 'CNT001', 'python')"
                ),
                {"id": room_id, "owner": user_id},
            )

        result = _alembic("upgrade", "head", url=scratch_url)
        assert result.returncode == 0, result.stdout + result.stderr

        async with engine.connect() as conn:
            columns = (
                await conn.execute(
                    text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_schema = 'public' AND table_name = 'room_code_state'"
                    )
                )
            ).all()
            assert {row[0] for row in columns} == {
                "id",
                "room_id",
                "content",
                "updated_at",
            }

            constraints = (
                await conn.execute(
                    text(
                        "SELECT conname FROM pg_constraint "
                        "WHERE conrelid = 'room_code_state'::regclass"
                    )
                )
            ).all()
            connames = {row[0] for row in constraints}
            assert "uq_room_code_state_room_id" in connames

            fk = (
                await conn.execute(
                    text(
                        "SELECT confdeltype FROM pg_constraint "
                        "WHERE conrelid = 'room_code_state'::regclass "
                        "AND contype = 'f'"
                    )
                )
            ).all()
            assert len(fk) == 1
            assert fk[0][0] == "c"  # 'c' = CASCADE

            backfilled = (
                await conn.execute(
                    text(
                        "SELECT content FROM room_code_state WHERE room_id = :rid"
                    ),
                    {"rid": room_id},
                )
            ).all()
            assert len(backfilled) == 1
            assert backfilled[0][0] is not None
            assert backfilled[0][0] == ""
    finally:
        await engine.dispose()


async def test_room_code_state_upgrade_downgrade_empty_db(scratch_url):
    """upgrade head and downgrade base both succeed on an empty database."""
    result = _alembic("downgrade", "base", url=scratch_url)
    assert result.returncode == 0, result.stdout + result.stderr

    result = _alembic("upgrade", "head", url=scratch_url)
    assert result.returncode == 0, result.stdout + result.stderr
    tables = await _table_names(scratch_url)
    assert {"users", "rooms", "room_members", "room_code_state"} <= tables

    result = _alembic("downgrade", "base", url=scratch_url)
    assert result.returncode == 0, result.stdout + result.stderr
    tables = await _table_names(scratch_url)
    assert tables == {"alembic_version"}

    result = _alembic("upgrade", "head", url=scratch_url)
    assert result.returncode == 0, result.stdout + result.stderr
    tables = await _table_names(scratch_url)
    assert "room_code_state" in tables
