"""
Integration test configuration and fixtures.
"""
import pytest
import os
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))


@pytest.fixture(scope="session")
def test_database_url():
    """
    Return the TEST_DATABASE_URL from environment variables.
    Uses the value from .env file.
    """
    return os.getenv("TEST_DATABASE_URL", "postgresql+psycopg://codelive:codelive@localhost:5433/codelive_test")


@pytest.fixture(scope="session")
def database_url():
    """
    Return the DATABASE_URL from environment variables.
    Uses the value from .env file.
    """
    return os.getenv("DATABASE_URL", "postgresql+psycopg://codelive:codelive@localhost:5432/codelive")


@pytest.fixture(scope="session")
def test_db_container_name():
    """Return the container name for the test database."""
    return "codelive_postgres_test"


@pytest.fixture(scope="session")
def main_db_container_name():
    """Return the container name for the main database."""
    return "codelive_postgres"


@pytest.fixture
async def raw_client():
    """httpx client on the real app — deliberately no get_session override."""
    import httpx

    from app.main import app

    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    # Warm the connection pool so the 2s health timeout is not hit on cold start
    from sqlalchemy import text as _text

    from app.shared.database import get_engine

    async with get_engine().connect() as _conn:
        await _conn.execute(_text("SELECT 1"))
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=transport, base_url="https://test") as client:
            yield client


@pytest.fixture(scope="session")
def _migrate():
    """Run alembic upgrade head against the TEST database once per session."""
    import os
    import subprocess

    from app.shared.config import get_settings

    # get_settings may have cached DATABASE_URL pointing at main DB; use env var directly
    test_url = os.getenv(
        "TEST_DATABASE_URL",
        "postgresql+psycopg://codelive:codelive@localhost:5433/codelive_test",
    )
    env = {**os.environ, "DATABASE_URL": test_url}
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=str(Path(project_root) / "backend"),
        env=env,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"alembic upgrade failed:\n{result.stdout}\n{result.stderr}"
    yield
    # downgrade back to base after session? keep schema for debugging; no teardown


@pytest.fixture(scope="session")
def test_engine(_migrate):
    """Async engine bound to the TEST database."""
    import os

    from sqlalchemy.ext.asyncio import create_async_engine

    test_url = os.getenv(
        "TEST_DATABASE_URL",
        "postgresql+psycopg://codelive:codelive@localhost:5433/codelive_test",
    )
    engine = create_async_engine(test_url, pool_pre_ping=True)
    yield engine


@pytest.fixture
async def db_session(test_engine):
    """A session on the test DB; rolled back after each test."""
    from sqlalchemy.ext.asyncio import async_sessionmaker

    factory = async_sessionmaker(test_engine, expire_on_commit=False)
    async with factory() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def client(test_engine):
    """Full app client with get_session overridden to the test DB."""
    import httpx

    from app.main import app
    from app.shared.database import get_session

    from sqlalchemy.ext.asyncio import async_sessionmaker

    factory = async_sessionmaker(test_engine, expire_on_commit=False)

    async def override_get_session():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=transport,
            base_url="https://test",
            headers={"Origin": "http://localhost:5173"},
        ) as ac:
            yield ac
    app.dependency_overrides.clear()


@pytest.fixture
def ws_client(test_engine, monkeypatch):
    """Sync TestClient for WS upgrades; REST and WS both hit the TEST database.

    WS admission reads get_sessionmaker() directly (D-19), so
    dependency_overrides cannot redirect it — the symbol imported into
    live_code.router is monkeypatched instead (PATTERNS §13 test seam).
    """
    from starlette.testclient import TestClient
    from sqlalchemy.ext.asyncio import async_sessionmaker

    from app.main import app
    from app.shared.database import get_session
    import app.features.live_code.router as ws_router

    factory = async_sessionmaker(test_engine, expire_on_commit=False)

    async def override_get_session():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session
    monkeypatch.setattr(ws_router, "get_sessionmaker", lambda: factory)
    with TestClient(app, base_url="https://testserver", headers={"Origin": "http://localhost:5173"}) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def _reset_hub():
    """Isolate tests: drop all room registry entries before and after each test."""
    from app.features.live_code.hub import hub

    hub.reset()
    yield
    hub.reset()


@pytest.fixture(autouse=True)
def _clear_rooms_cache():
    """Isolate tests: drop cached rooms:mine entries before and after each test."""
    from app.features.rooms import cache

    cache.clear_rooms_cache()
    yield
    cache.clear_rooms_cache()


@pytest.fixture(autouse=True)
async def _clean_tables(test_engine):
    """Isolate tests: empty the users table before each test.

    Phase 2: rooms.owner_id -> users.id is ON DELETE RESTRICT, so
    DELETE FROM users would raise RestrictViolation once a room
    exists. TRUNCATE ... CASCADE reaches every table holding a
    foreign key to users (rooms, room_members) without naming
    tables that may not exist yet.
    """
    from sqlalchemy import text as _t

    async with test_engine.begin() as conn:
        await conn.execute(_t("TRUNCATE users RESTART IDENTITY CASCADE"))
    yield
