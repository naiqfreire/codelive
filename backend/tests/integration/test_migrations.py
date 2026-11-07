"""Migration reversibility on a dedicated scratch database."""
import os
import subprocess
import sys
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
