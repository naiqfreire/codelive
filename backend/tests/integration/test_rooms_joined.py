"""GET /api/rooms/joined: lists the current user's memberships (no role filter)."""
import pytest

pytestmark = pytest.mark.integration


async def _register(client, email, name="User"):
    resp = await client.post(
        "/api/auth/register",
        json={"name": name, "email": email, "password": "correct-horse"},
    )
    assert resp.status_code == 201
    return resp


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
    created = await client.post("/api/rooms", json={"language": "java"})
    assert created.status_code == 201
    resp = await client.get("/api/rooms/joined")
    assert resp.status_code == 200
    assert resp.json() == {"items": []}


async def test_joined_lists_viewer_membership_after_join(client):
    owner = await _register(client, "joined-2-owner@example.com", "Owner")
    room = (await client.post("/api/rooms", json={"language": "c"})).json()
    client.cookies.clear()
    viewer = await _register(client, "joined-2-viewer@example.com", "Viewer")
    viewer_id = (await client.get("/api/auth/me")).json()["id"]
    joined = await client.post(
        f"/api/rooms/{room['id']}/join",
        json={"code": room["access_code"], "nickname": "Espectador"},
    )
    assert joined.status_code == 200
    resp = await client.get("/api/rooms/joined")
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 1
    item = items[0]
    assert item["room_id"] == room["id"]
    assert item["user_id"] == viewer_id
    assert item["role"] == "viewer"
    assert item["is_anonymous"] is False
    assert item["nickname"] == "Espectador"


async def test_joined_excludes_owner_memberships(client):
    await _register(client, "joined-3@example.com", "Owner")
    await client.post("/api/rooms", json={"language": "php"})
    await client.post("/api/rooms", json={"language": "javascript"})
    resp = await client.get("/api/rooms/joined")
    assert resp.status_code == 200
    assert resp.json() == {"items": []}


async def test_joined_stays_empty_for_owner_after_primed_cache(client):
    await _register(client, "joined-cache-1@example.com", "Owner")
    primed = await client.get("/api/rooms/joined")
    assert primed.status_code == 200
    assert primed.json() == {"items": []}
    await client.post("/api/rooms", json={"language": "python"})
    resp = await client.get("/api/rooms/joined")
    assert resp.status_code == 200
    assert resp.json() == {"items": []}


async def test_joined_reflects_join_after_primed_cache(client):
    await _register(client, "joined-cache-2-owner@example.com", "Owner")
    room = (await client.post("/api/rooms", json={"language": "c"})).json()
    client.cookies.clear()
    await _register(client, "joined-cache-2-viewer@example.com", "Viewer")
    me = await client.get("/api/auth/me")
    primed = await client.get("/api/rooms/joined")
    assert primed.status_code == 200
    assert primed.json() == {"items": []}
    joined = await client.post(
        f"/api/rooms/{room['id']}/join",
        json={"code": room["access_code"]},
    )
    assert joined.status_code == 200
    resp = await client.get("/api/rooms/joined")
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert [item["room_id"] for item in items] == [room["id"]]
    assert items[0]["role"] == "viewer"
    assert items[0]["user_id"] == me.json()["id"]
