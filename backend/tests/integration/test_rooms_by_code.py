"""GET /api/rooms/by-code/{codigo}: validates a room's access code."""
import uuid

import pytest

pytestmark = pytest.mark.integration

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


async def _register(client, email):
    resp = await client.post(
        "/api/auth/register",
        json={"name": "Owner", "email": email, "password": "correct-horse"},
    )
    assert resp.status_code == 201
    return resp


async def _create_room(client, language="python"):
    resp = await client.post("/api/rooms", json={"language": language})
    assert resp.status_code == 201
    return resp.json()


async def test_by_code_valid_returns_200_and_body(client):
    await _register(client, "bycode-valid@example.com")
    room = await _create_room(client, "python")
    resp = await client.get(f"/api/rooms/by-code/{room['access_code']}")
    assert resp.status_code == 200
    body = resp.json()
    assert set(body) == {
        "id",
        "owner_id",
        "access_code",
        "language",
        "status",
        "created_at",
        "updated_at",
    }
    assert body["id"] == room["id"]
    assert body["access_code"] == room["access_code"]
    assert body["language"] == "python"
    assert body["status"] == "active"
    uuid.UUID(body["owner_id"])
    uuid.UUID(body["id"])
    assert "password_hash" not in resp.text
    assert "token" not in resp.text


async def test_by_code_wrong_code_returns_404_room_not_found(client):
    await _register(client, "bycode-wrong@example.com")
    room = await _create_room(client)
    code = room["access_code"]
    first = next(c for c in ALPHABET if c != code[0])
    wrong = first + code[1:]
    resp = await client.get(f"/api/rooms/by-code/{wrong}")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "room_not_found"


async def test_by_code_unknown_code_returns_404_room_not_found(client):
    await _register(client, "bycode-unknown@example.com")
    resp = await client.get("/api/rooms/by-code/ZZZZZZ")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "room_not_found"


async def test_by_code_without_session_is_401(client):
    resp = await client.get("/api/rooms/by-code/ZZZZZZ")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "not_authenticated"


async def test_by_code_on_closed_room_returns_status_closed(client):
    await _register(client, "bycode-closed@example.com")
    room = await _create_room(client)
    close = await client.patch(f"/api/rooms/{room['id']}/close")
    assert close.status_code == 200
    resp = await client.get(f"/api/rooms/by-code/{room['access_code']}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "closed"
