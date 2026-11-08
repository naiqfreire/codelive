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


async def _rooms_count(db_session):
    result = await db_session.execute(text("SELECT count(*) FROM rooms"))
    return result.scalar()


async def test_create_without_session_is_401(client):
    resp = await client.post("/api/rooms", json={"language": "python"})
    assert resp.status_code == 401
    body = resp.json()
    assert body["error"]["code"] == "not_authenticated"
    uuid.UUID(body["error"]["request_id"])
    assert "detail" not in body


async def test_invalid_body_without_session_is_401(client):
    resp = await client.post("/api/rooms", json={"language": "rust"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "not_authenticated"


async def test_create_bad_origin_is_403(client, db_session):
    await _register(client, "owner5@example.com")
    before = await _rooms_count(db_session)
    resp = await client.post(
        "/api/rooms",
        json={"language": "python"},
        headers={"Origin": "http://evil.example"},
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "invalid_origin"
    request = client.build_request("POST", "/api/rooms", json={"language": "python"})
    if "origin" in request.headers:
        del request.headers["origin"]
    resp_no_origin = await client.send(request)
    assert resp_no_origin.status_code == 403
    assert resp_no_origin.json()["error"]["code"] == "invalid_origin"
    assert await _rooms_count(db_session) == before


@pytest.mark.parametrize("language", ["python", "java", "c", "php", "javascript"])
async def test_all_supported_languages_accepted(client, language):
    await _register(client, f"lang-{language}@example.com")
    resp = await client.post("/api/rooms", json={"language": language})
    assert resp.status_code == 201
    assert resp.json()["language"] == language


@pytest.mark.parametrize("language", ["rust", "Python"])
async def test_invalid_language_is_422_pt_br(client, db_session, language):
    await _register(client, f"badlang-{language}@example.com")
    before = await _rooms_count(db_session)
    resp = await client.post("/api/rooms", json={"language": language})
    assert resp.status_code == 422
    body = resp.json()
    assert body["error"]["code"] == "validation_error"
    message = body["error"]["message"]
    assert "deve ser um de:" in message
    for value in ("'python'", "'java'", "'c'", "'php'", "'javascript'"):
        assert value in message
    assert "Input should be" not in message
    assert await _rooms_count(db_session) == before


async def test_extra_field_rejected_422(client, db_session):
    await _register(client, "extra@example.com")
    before = await _rooms_count(db_session)
    resp = await client.post("/api/rooms", json={"language": "c", "title": "x"})
    assert resp.status_code == 422
    assert "campo não permitido" in resp.json()["error"]["message"]
    assert await _rooms_count(db_session) == before


async def test_owner_id_cannot_be_injected(client, db_session):
    await _register(client, "victim@example.com")
    victim_id = (await client.get("/api/auth/me")).json()["id"]
    await _register(client, "session-user@example.com")
    session_id = (await client.get("/api/auth/me")).json()["id"]
    before = await _rooms_count(db_session)
    resp = await client.post("/api/rooms", json={"language": "c", "owner_id": victim_id})
    assert resp.status_code == 422
    assert await _rooms_count(db_session) == before
    legit = await client.post("/api/rooms", json={"language": "c"})
    assert legit.status_code == 201
    rows = (await db_session.execute(text("SELECT owner_id FROM rooms"))).all()
    assert len(rows) == 1
    assert str(rows[0][0]) == session_id
    assert str(rows[0][0]) != victim_id


async def test_openapi_publishes_language_enum(client):
    resp = await client.get("/openapi.json")
    assert resp.status_code == 200
    schema = resp.json()["components"]["schemas"]["CreateRoomRequest"]
    assert schema["properties"]["language"]["enum"] == [
        "python",
        "java",
        "c",
        "php",
        "javascript",
    ]
    assert schema["additionalProperties"] is False


async def test_rooms_are_cleaned_between_tests_a(client, db_session):
    await _register(client, "iso-a@example.com")
    resp = await client.post("/api/rooms", json={"language": "python"})
    assert resp.status_code == 201
    assert await _rooms_count(db_session) == 1


async def test_rooms_are_cleaned_between_tests_b(client, db_session):
    await _register(client, "iso-b@example.com")
    resp = await client.post("/api/rooms", json={"language": "python"})
    assert resp.status_code == 201
    assert await _rooms_count(db_session) == 1
