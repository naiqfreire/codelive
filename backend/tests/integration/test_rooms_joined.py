"""GET /api/rooms/joined: rooms the current user joined as a viewer.

The list is scoped to the authenticated user's viewer memberships: owned rooms
and rooms without a membership row must never appear.
"""
import pytest

pytestmark = pytest.mark.integration

PASSWORD = "correct-horse"
ITEM_KEYS = {"id", "access_code", "language", "status", "created_at", "joined_at"}


async def _register(client, email, name="User"):
    resp = await client.post(
        "/api/auth/register",
        json={"name": name, "email": email, "password": PASSWORD},
    )
    assert resp.status_code == 201
    return resp.json()


async def _login(client, email):
    resp = await client.post(
        "/api/auth/login",
        json={"email": email, "password": PASSWORD},
    )
    assert resp.status_code == 200
    return resp.json()


async def _create_room(client, language="python"):
    resp = await client.post("/api/rooms", json={"language": language})
    assert resp.status_code == 201
    return resp.json()


async def _join(client, room, nickname="Espectador"):
    payload = {"code": room["access_code"]}
    if nickname is not None:
        payload["nickname"] = nickname
    resp = await client.post(f"/api/rooms/{room['id']}/join", json=payload)
    assert resp.status_code == 200
    return resp


async def _joined_items(client):
    resp = await client.get("/api/rooms/joined")
    assert resp.status_code == 200
    return resp.json()["items"]


async def test_joined_empty_for_new_user(client):
    await _register(client, "joined-empty@example.com")
    resp = await client.get("/api/rooms/joined")
    assert resp.status_code == 200
    assert resp.json() == {"items": []}


async def test_joined_requires_auth(client):
    resp = await client.get("/api/rooms/joined")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "not_authenticated"


async def test_joined_excludes_owner_membership(client):
    await _register(client, "joined-owner@example.com", "Owner")
    await _create_room(client, "java")
    assert await _joined_items(client) == []


async def test_joined_lists_room_metadata_after_join(client):
    await _register(client, "joined-meta-owner@example.com", "Owner")
    room = await _create_room(client, "c")
    client.cookies.clear()
    await _register(client, "joined-meta-viewer@example.com", "Viewer")
    await _join(client, room)

    items = await _joined_items(client)

    assert len(items) == 1
    item = items[0]
    assert set(item) == ITEM_KEYS
    assert item["id"] == room["id"]
    assert item["access_code"] == room["access_code"]
    assert item["language"] == "c"
    assert item["status"] == "active"
    assert item["created_at"] == room["created_at"]
    assert item["joined_at"]


async def test_joined_never_lists_rooms_without_membership(client):
    await _register(client, "joined-leak-owner@example.com", "Owner")
    await _create_room(client, "java")
    client.cookies.clear()
    await _register(client, "joined-leak-other@example.com", "Other")

    assert await _joined_items(client) == []


async def test_joined_lists_newest_membership_first(client):
    await _register(client, "joined-order-owner@example.com", "Owner")
    first_room = await _create_room(client, "python")
    second_room = await _create_room(client, "javascript")
    client.cookies.clear()
    await _register(client, "joined-order-viewer@example.com", "Viewer")
    await _join(client, first_room)
    await _join(client, second_room)

    items = await _joined_items(client)

    assert [item["id"] for item in items] == [second_room["id"], first_room["id"]]


async def test_joined_reflects_join_after_primed_cache(client):
    await _register(client, "joined-cache-owner@example.com", "Owner")
    room = await _create_room(client, "c")
    client.cookies.clear()
    await _register(client, "joined-cache-viewer@example.com", "Viewer")
    assert await _joined_items(client) == []

    await _join(client, room)

    items = await _joined_items(client)
    assert [item["id"] for item in items] == [room["id"]]


async def test_joined_reports_closed_status_after_primed_cache(client):
    await _register(client, "joined-closed-owner@example.com", "Owner")
    room = await _create_room(client, "php")
    client.cookies.clear()
    await _register(client, "joined-closed-viewer@example.com", "Viewer")
    await _join(client, room)
    primed = await _joined_items(client)
    assert primed[0]["status"] == "active"

    client.cookies.clear()
    await _login(client, "joined-closed-owner@example.com")
    closed = await client.patch(f"/api/rooms/{room['id']}/close")
    assert closed.status_code == 200
    assert closed.json()["status"] == "closed"

    client.cookies.clear()
    await _login(client, "joined-closed-viewer@example.com")
    items = await _joined_items(client)
    assert items[0]["status"] == "closed"


async def test_joined_reflects_regenerated_code_after_primed_cache(client):
    await _register(client, "joined-code-owner@example.com", "Owner")
    room = await _create_room(client, "python")
    client.cookies.clear()
    await _register(client, "joined-code-viewer@example.com", "Viewer")
    await _join(client, room)
    primed = await _joined_items(client)
    assert primed[0]["access_code"] == room["access_code"]

    client.cookies.clear()
    await _login(client, "joined-code-owner@example.com")
    regenerated = await client.post(f"/api/rooms/{room['id']}/regenerate-code")
    assert regenerated.status_code == 200
    new_code = regenerated.json()["access_code"]
    assert new_code != room["access_code"]

    client.cookies.clear()
    await _login(client, "joined-code-viewer@example.com")
    items = await _joined_items(client)
    assert items[0]["access_code"] == new_code
