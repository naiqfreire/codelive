"""Health endpoint against real PostgreSQL."""
import pytest

pytestmark = pytest.mark.integration


async def test_health_ok(raw_client):
    resp = await raw_client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "db": "ok"}


async def test_health_db_unavailable(raw_client, monkeypatch):
    from sqlalchemy.ext.asyncio import create_async_engine

    bad_engine = create_async_engine(
        "postgresql+psycopg://codelive:codelive@127.0.0.1:59999/codelive",
        connect_args={"connect_timeout": 1},
    )

    def fake_get_engine():
        return bad_engine

    monkeypatch.setattr("app.shared.health.get_engine", fake_get_engine)
    resp = await raw_client.get("/api/health")
    assert resp.status_code == 503
    assert resp.json() == {"status": "error", "db": "unavailable"}
    await bad_engine.dispose()


async def test_health_503_has_no_detail(raw_client, monkeypatch):
    from sqlalchemy.ext.asyncio import create_async_engine

    bad_engine = create_async_engine(
        "postgresql+psycopg://codelive:codelive@127.0.0.1:59999/codelive",
        connect_args={"connect_timeout": 1},
    )
    monkeypatch.setattr("app.shared.health.get_engine", lambda: bad_engine)
    resp = await raw_client.get("/api/health")
    assert resp.status_code == 503
    assert "detail" not in resp.json()
    assert "Traceback" not in resp.text
    await bad_engine.dispose()


async def test_no_origin_needed(raw_client):
    resp = await raw_client.get("/api/health")
    assert resp.status_code == 200
