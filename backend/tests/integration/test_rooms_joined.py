"""GET /api/rooms/joined: rooms the authenticated user entered as spectator (RF04).

Each item carries the current room identity (access code, language, status and
creation date) so the screen can show status and a quick access link without a
second request. Owner memberships are excluded, and a user only ever sees rooms
they joined.
"""
import pytest

pytestmark = pytest.mark.integration


async def _register(client, email, name="User"):
    resp = await client.post(
        "/api/auth/register",
        json={"name": name, "email": email, "password": "correct-horse"},
    )
    assert resp.status_code == 201
    return resp


async def _login(client, email):
    client.cookies.clear()
    resp = await client.post(
        "/api/auth/login",
        json={"email": email, "password": "correct-horse"},
    )
    assert resp.status_code == 200
    return resp


async def _create_room(client, language="python"):
    resp = await client.post("/api/rooms", json={"language": language})
    assert resp.status_code == 201
    return resp.json()


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
    assert item["access_code"] == room["access_code"]
    assert item["language"] == "c"
    assert item["status"] == "active"
    assert item["created_at"] == room["created_at"]


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


async def test_joined_reflects_closed_status_after_primed_cache(client):
    await _register(client, "joined-close-owner@example.com", "Owner")
    room = await _create_room(client, "java")
    client.cookies.clear()
    await _register(client, "joined-close-viewer@example.com", "Viewer")
    joined = await client.post(
        f"/api/rooms/{room['id']}/join",
        json={"code": room["access_code"], "nickname": "Espectador"},
    )
    assert joined.status_code == 200
    primed = await client.get("/api/rooms/joined")
    assert primed.status_code == 200
    assert primed.json()["items"][0]["status"] == "active"

    await _login(client, "joined-close-owner@example.com")
    closed = await client.patch(f"/api/rooms/{room['id']}/close")
    assert closed.status_code == 200

    await _login(client, "joined-close-viewer@example.com")
    resp = await client.get("/api/rooms/joined")
    assert resp.status_code == 200
    assert resp.json()["items"][0]["status"] == "closed"


async def test_joined_reflects_regenerated_code_after_primed_cache(client):
    await _register(client, "joined-regen-owner@example.com", "Owner")
    room = await _create_room(client, "php")
    client.cookies.clear()
    await _register(client, "joined-regen-viewer@example.com", "Viewer")
    joined = await client.post(
        f"/api/rooms/{room['id']}/join",
        json={"code": room["access_code"], "nickname": "Espectador"},
    )
    assert joined.status_code == 200
    primed = await client.get("/api/rooms/joined")
    assert primed.status_code == 200
    assert primed.json()["items"][0]["access_code"] == room["access_code"]

    await _login(client, "joined-regen-owner@example.com")
    regenerated = await client.post(f"/api/rooms/{room['id']}/regenerate-code")
    assert regenerated.status_code == 200
    new_code = regenerated.json()["access_code"]
    assert new_code != room["access_code"]

    await _login(client, "joined-regen-viewer@example.com")
    resp = await client.get("/api/rooms/joined")
    assert resp.status_code == 200
    assert resp.json()["items"][0]["access_code"] == new_code


async def test_joined_never_lists_rooms_of_other_users(client):
    await _register(client, "joined-privacy-owner-a@example.com", "Owner A")
    room_a = await _create_room(client, "python")
    client.cookies.clear()
    await _register(client, "joined-privacy-viewer-a@example.com", "Viewer A")
    joined_a = await client.post(
        f"/api/rooms/{room_a['id']}/join",
        json={"code": room_a["access_code"], "nickname": "Espectador A"},
    )
    assert joined_a.status_code == 200

    await _login(client, "joined-privacy-owner-a@example.com")
    room_unjoined = await _create_room(client, "javascript")

    client.cookies.clear()
    await _register(client, "joined-privacy-owner-b@example.com", "Owner B")
    room_b = await _create_room(client, "c")
    client.cookies.clear()
    await _register(client, "joined-privacy-viewer-b@example.com", "Viewer B")
    joined_b = await client.post(
        f"/api/rooms/{room_b['id']}/join",
        json={"code": room_b["access_code"], "nickname": "Espectador B"},
    )
    assert joined_b.status_code == 200

    await _login(client, "joined-privacy-viewer-a@example.com")
    seen_a = (await client.get("/api/rooms/joined")).json()["items"]
    assert [item["room_id"] for item in seen_a] == [room_a["id"]]
    assert room_unjoined["id"] not in {item["room_id"] for item in seen_a}

    await _login(client, "joined-privacy-viewer-b@example.com")
    seen_b = (await client.get("/api/rooms/joined")).json()["items"]
    assert [item["room_id"] for item in seen_b] == [room_b["id"]]
    assert room_a["id"] not in {item["room_id"] for item in seen_b}
    assert room_unjoined["id"] not in {item["room_id"] for item in seen_b}
