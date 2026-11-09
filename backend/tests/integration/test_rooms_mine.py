"""GET /api/rooms/mine: owner's room list."""
import re
import uuid

import httpx
import pytest

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


async def test_mine_requires_auth(client):
    resp = await client.get("/api/rooms/mine")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "not_authenticated"


async def test_mine_empty_list_when_no_rooms(client):
    await _register(client, "mine-empty@example.com")
    resp = await client.get("/api/rooms/mine")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_mine_returns_only_own_rooms(client):
    await _register(client, "mine-a@example.com")
    mine = await client.post("/api/rooms", json={"language": "python"})
    assert mine.status_code == 201

    async with _second_client() as other:
        await other.post(
            "/api/auth/register",
            json={"name": "Other", "email": "mine-b@example.com", "password": "correct-horse"},
        )
        other_room = await other.post("/api/rooms", json={"language": "java"})
        assert other_room.status_code == 201

        resp = await other.get("/api/rooms/mine")
        assert resp.status_code == 200
        body = resp.json()
        assert len(body) == 1
        assert body[0]["language"] == "java"

    resp = await client.get("/api/rooms/mine")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["language"] == "python"
    uuid.UUID(body[0]["id"])
    assert re.fullmatch(r"[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}", body[0]["access_code"])
    assert set(body[0]) == {"id", "access_code", "language", "status", "created_at"}


async def test_mine_lists_rooms_in_created_at_desc_order(client):
    await _register(client, "mine-order@example.com")
    first = await client.post("/api/rooms", json={"language": "c"})
    second = await client.post("/api/rooms", json={"language": "php"})
    assert first.status_code == 201
    assert second.status_code == 201
    resp = await client.get("/api/rooms/mine")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 2
    assert body[0]["created_at"] >= body[1]["created_at"]
    assert {room["language"] for room in body} == {"c", "php"}


async def test_mine_reflects_create_without_stale_cache(client):
    await _register(client, "mine-cache-create@example.com")
    first = await client.post("/api/rooms", json={"language": "python"})
    assert first.status_code == 201
    cached = await client.get("/api/rooms/mine")
    assert len(cached.json()) == 1

    second = await client.post("/api/rooms", json={"language": "java"})
    assert second.status_code == 201
    resp = await client.get("/api/rooms/mine")
    assert len(resp.json()) == 2
    assert {room["language"] for room in resp.json()} == {"python", "java"}
