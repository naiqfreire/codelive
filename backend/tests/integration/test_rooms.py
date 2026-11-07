"""Room creation: authenticated owner creates a room via POST /api/rooms."""
import re
import uuid

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


async def test_create_returns_201_and_body_shape(client):
    await _register(client, "owner1@example.com")
    resp = await client.post("/api/rooms", json={"language": "python"})
    assert resp.status_code == 201
    body = resp.json()
    assert set(body) == {"id", "access_code", "language", "status", "created_at"}
    uuid.UUID(body["id"])
    assert re.fullmatch(r"[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}", body["access_code"])
    assert body["language"] == "python"
    assert body["status"] == "active"
    assert "owner_id" not in resp.text
    assert "updated_at" not in resp.text
    assert "password_hash" not in resp.text
    assert "token" not in resp.text


async def test_room_row_persisted(client, db_session):
    await _register(client, "owner2@example.com")
    me = await client.get("/api/auth/me")
    assert me.status_code == 200
    owner_id = me.json()["id"]
    resp = await client.post("/api/rooms", json={"language": "python"})
    assert resp.status_code == 201
    body = resp.json()
    rows = (await db_session.execute(text("SELECT owner_id, access_code, language, status FROM rooms"))).all()
    assert len(rows) == 1
    row = rows[0]
    assert str(row[0]) == owner_id
    assert row[1] == body["access_code"]
    assert row[2] == "python"
    assert row[3] == "active"


async def test_owner_membership_created(client, db_session):
    await _register(client, "owner3@example.com")
    me = await client.get("/api/auth/me")
    owner_id = me.json()["id"]
    resp = await client.post("/api/rooms", json={"language": "java"})
    assert resp.status_code == 201
    room_id = resp.json()["id"]
    rows = (await db_session.execute(text("SELECT role, is_anonymous, nickname, user_id FROM room_members WHERE room_id = :room"), {"room": room_id})).all()
    assert len(rows) == 1
    role, is_anon, nickname, user_id = rows[0]
    assert role == "owner"
    assert is_anon is False
    assert nickname is None
    assert str(user_id) == owner_id


async def test_route_is_reachable_without_trailing_slash(client):
    await _register(client, "owner4@example.com")
    resp_no_slash = await client.post("/api/rooms", json={"language": "python"})
    assert resp_no_slash.status_code == 201
    resp_slash = await client.post("/api/rooms/", json={"language": "python"})
    assert resp_slash.status_code == 307
