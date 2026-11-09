"""PATCH /api/rooms/{id}/close: owner closes a room; idempotent."""
import uuid

import httpx
import pytest
from sqlalchemy import text

pytestmark = pytest.mark.integration


async def _register(client, email):
    resp = await client.post(
        "/api/auth/register",
        json={"name": "Owner", "email": email, "password": "correct-horse"},
    )
    assert resp.status_code == 201
    return resp


def _second_client():
    from app.main import app

    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    return httpx.AsyncClient(
        transport=transport,
        base_url="https://test",
        headers={"Origin": "http://localhost:5173"},
    )


async def test_close_requires_auth(client):
    resp = await client.patch(f"/api/rooms/{uuid.uuid4()}/close")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "not_authenticated"


async def test_close_missing_room_returns_404(client):
    await _register(client, "close-404@example.com")
    resp = await client.patch(f"/api/rooms/{uuid.uuid4()}/close")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "room_not_found"


async def test_close_non_owner_returns_403(client):
    await _register(client, "close-owner@example.com")
    room = await client.post("/api/rooms", json={"language": "python"})
    room_id = room.json()["id"]

    async with _second_client() as other:
        await other.post(
            "/api/auth/register",
            json={"name": "Other", "email": "close-other@example.com", "password": "correct-horse"},
        )
        resp = await other.patch(f"/api/rooms/{room_id}/close")
        assert resp.status_code == 403
        assert resp.json()["error"]["code"] == "forbidden"


async def test_close_sets_status_closed(client, db_session):
    await _register(client, "close-ok@example.com")
    room = await client.post("/api/rooms", json={"language": "python"})
    room_id = room.json()["id"]

    resp = await client.patch(f"/api/rooms/{room_id}/close")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == room_id
    assert body["status"] == "closed"
    assert set(body) == {"id", "access_code", "language", "status", "created_at"}

    rows = (
        await db_session.execute(text("SELECT status FROM rooms WHERE id = :id"), {"id": room_id})
    ).all()
    assert rows[0][0] == "closed"


async def test_close_is_idempotent(client):
    await _register(client, "close-idem@example.com")
    room = await client.post("/api/rooms", json={"language": "python"})
    room_id = room.json()["id"]

    first = await client.patch(f"/api/rooms/{room_id}/close")
    assert first.status_code == 200
    second = await client.patch(f"/api/rooms/{room_id}/close")
    assert second.status_code == 200
    assert second.json()["status"] == "closed"


async def test_close_invalidates_mine_cache(client):
    await _register(client, "close-cache@example.com")
    room = await client.post("/api/rooms", json={"language": "python"})
    room_id = room.json()["id"]

    cached = await client.get("/api/rooms/mine")
    assert cached.json()[0]["status"] == "active"

    await client.patch(f"/api/rooms/{room_id}/close")
    resp = await client.get("/api/rooms/mine")
    assert resp.json()[0]["status"] == "closed"
