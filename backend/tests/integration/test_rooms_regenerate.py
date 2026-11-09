"""POST /api/rooms/{id}/regenerate-code: owner rotates the access code."""
import re
import uuid

import httpx
import pytest
from sqlalchemy import text

pytestmark = pytest.mark.integration

CODE_PATTERN = re.compile(r"[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}")


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


async def test_regenerate_requires_auth(client):
    resp = await client.post(f"/api/rooms/{uuid.uuid4()}/regenerate-code")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "not_authenticated"


async def test_regenerate_missing_room_returns_404(client):
    await _register(client, "regen-404@example.com")
    resp = await client.post(f"/api/rooms/{uuid.uuid4()}/regenerate-code")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "room_not_found"


async def test_regenerate_non_owner_returns_403(client):
    await _register(client, "regen-owner@example.com")
    room = await client.post("/api/rooms", json={"language": "python"})
    room_id = room.json()["id"]

    async with _second_client() as other:
        await other.post(
            "/api/auth/register",
            json={"name": "Other", "email": "regen-other@example.com", "password": "correct-horse"},
        )
        resp = await other.post(f"/api/rooms/{room_id}/regenerate-code")
        assert resp.status_code == 403
        assert resp.json()["error"]["code"] == "forbidden"


async def test_regenerate_on_closed_room_returns_409(client, db_session):
    await _register(client, "regen-closed@example.com")
    room = await client.post("/api/rooms", json={"language": "python"})
    body = room.json()
    original_code = body["access_code"]
    await client.patch(f"/api/rooms/{body['id']}/close")

    resp = await client.post(f"/api/rooms/{body['id']}/regenerate-code")
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "room_closed"

    rows = (
        await db_session.execute(
            text("SELECT access_code FROM rooms WHERE id = :id"), {"id": body["id"]}
        )
    ).all()
    assert rows[0][0] == original_code


async def test_regenerate_returns_new_valid_code(client, db_session):
    await _register(client, "regen-ok@example.com")
    room = await client.post("/api/rooms", json={"language": "python"})
    body = room.json()
    old_code = body["access_code"]

    resp = await client.post(f"/api/rooms/{body['id']}/regenerate-code")
    assert resp.status_code == 200
    new_body = resp.json()
    assert new_body["id"] == body["id"]
    assert new_body["access_code"] != old_code
    assert CODE_PATTERN.fullmatch(new_body["access_code"])
    assert new_body["status"] == "active"
    assert set(new_body) == {"id", "access_code", "language", "status", "created_at"}

    rows = (
        await db_session.execute(
            text("SELECT access_code FROM rooms WHERE id = :id"), {"id": body["id"]}
        )
    ).all()
    assert rows[0][0] == new_body["access_code"]


async def test_regenerate_retries_on_collision(client, monkeypatch):
    await _register(client, "regen-coll@example.com")
    first = await client.post("/api/rooms", json={"language": "python"})
    second = await client.post("/api/rooms", json={"language": "java"})
    assert first.status_code == 201
    assert second.status_code == 201
    taken_code = second.json()["access_code"]

    codes = iter([taken_code, "ZZZZ22"])
    monkeypatch.setattr(
        "app.features.rooms.service.generate_access_code",
        lambda: next(codes),
    )
    resp = await client.post(f"/api/rooms/{first.json()['id']}/regenerate-code")
    assert resp.status_code == 200
    assert resp.json()["access_code"] == "ZZZZ22"


async def test_regenerate_exhausted_attempts_returns_500(client, monkeypatch):
    await _register(client, "regen-exhaust@example.com")
    first = await client.post("/api/rooms", json={"language": "python"})
    second = await client.post("/api/rooms", json={"language": "java"})
    assert first.status_code == 201
    assert second.status_code == 201
    taken_code = second.json()["access_code"]

    monkeypatch.setattr(
        "app.features.rooms.service.generate_access_code",
        lambda: taken_code,
    )
    resp = await client.post(f"/api/rooms/{first.json()['id']}/regenerate-code")
    assert resp.status_code == 500
    assert resp.json()["error"]["code"] == "internal_error"


async def test_regenerate_invalidates_mine_cache(client):
    await _register(client, "regen-cache@example.com")
    room = await client.post("/api/rooms", json={"language": "python"})
    room_id = room.json()["id"]
    old_code = room.json()["access_code"]

    cached = await client.get("/api/rooms/mine")
    assert cached.json()[0]["access_code"] == old_code

    regen = await client.post(f"/api/rooms/{room_id}/regenerate-code")
    assert regen.status_code == 200
    resp = await client.get("/api/rooms/mine")
    assert resp.json()[0]["access_code"] == regen.json()["access_code"]
