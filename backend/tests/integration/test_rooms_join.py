"""POST /api/rooms/{id}/join: enter a room with its access code."""
import uuid

import pytest
from sqlalchemy import text

pytestmark = pytest.mark.integration

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _wrong_code(code: str) -> str:
    first = next(c for c in ALPHABET if c != code[0])
    return first + code[1:]


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


async def _create_room(client):
    resp = await client.post("/api/rooms", json={"language": "python"})
    assert resp.status_code == 201
    return resp.json()


async def _member_rows(db_session, room_id):
    result = await db_session.execute(
        text(
            "SELECT role, is_anonymous, nickname, user_id "
            "FROM room_members WHERE room_id = :room"
        ),
        {"room": room_id},
    )
    return result.all()


async def _anon_rows(db_session, room_id):
    result = await db_session.execute(
        text(
            "SELECT role, is_anonymous, nickname, user_id, anonymous_session_id "
            "FROM room_members WHERE room_id = :room AND is_anonymous = true"
        ),
        {"room": room_id},
    )
    return result.all()


async def _make_room_and_viewer(client):
    """Owner creates a room; client then registers as a viewer."""
    await _register(client, "join-owner@example.com", "Owner")
    room = await _create_room(client)
    client.cookies.clear()
    await _register(client, "join-viewer@example.com", "Viewer")
    me = await client.get("/api/auth/me")
    assert me.status_code == 200
    return room, me.json()["id"]


async def _make_room(client):
    """Owner creates a room; no viewer session is left on the client."""
    await _register(client, "anon-owner@example.com", "Owner")
    return await _create_room(client)


async def test_join_viewer_creates_membership_and_returns_room(client, db_session):
    room, viewer_id = await _make_room_and_viewer(client)
    resp = await client.post(
        f"/api/rooms/{room['id']}/join",
        json={"code": room["access_code"], "nickname": "Aluno"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert set(body) == {"id", "access_code", "language", "status", "created_at"}
    assert body["id"] == room["id"]
    assert "password_hash" not in resp.text
    rows = await _member_rows(db_session, room["id"])
    assert len(rows) == 2  # owner + viewer
    viewer_rows = [r for r in rows if str(r[3]) == viewer_id]
    assert len(viewer_rows) == 1
    role, is_anonymous, nickname, _user_id = viewer_rows[0]
    assert role == "viewer"
    assert is_anonymous is False
    assert nickname == "Aluno"


async def test_join_as_owner_is_idempotent(client, db_session):
    await _register(client, "join-owner@example.com", "Owner")
    room = await _create_room(client)
    resp = await client.post(
        f"/api/rooms/{room['id']}/join",
        json={"code": room["access_code"]},
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == room["id"]
    rows = await _member_rows(db_session, room["id"])
    assert len(rows) == 1
    assert rows[0][0] == "owner"


async def test_join_twice_keeps_single_membership(client, db_session):
    room, viewer_id = await _make_room_and_viewer(client)
    for _ in range(2):
        resp = await client.post(
            f"/api/rooms/{room['id']}/join",
            json={"code": room["access_code"]},
        )
        assert resp.status_code == 200
    rows = await _member_rows(db_session, room["id"])
    viewer_rows = [r for r in rows if str(r[3]) == viewer_id]
    assert len(viewer_rows) == 1


async def test_join_wrong_code_returns_404_and_no_row(client, db_session):
    room, viewer_id = await _make_room_and_viewer(client)
    resp = await client.post(
        f"/api/rooms/{room['id']}/join",
        json={"code": _wrong_code(room["access_code"])},
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "room_not_found"
    rows = await _member_rows(db_session, room["id"])
    assert all(str(r[3]) != viewer_id for r in rows)


async def test_join_unknown_room_returns_404(client):
    await _register(client, "join-ghost@example.com")
    resp = await client.post(
        f"/api/rooms/{uuid.uuid4()}/join",
        json={"code": "ZZZZZZ"},
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "room_not_found"


async def test_join_closed_room_returns_409_and_no_row(client, db_session):
    room, viewer_id = await _make_room_and_viewer(client)
    await _login(client, "join-owner@example.com")
    close = await client.patch(f"/api/rooms/{room['id']}/close")
    assert close.status_code == 200
    await _login(client, "join-viewer@example.com")
    resp = await client.post(
        f"/api/rooms/{room['id']}/join",
        json={"code": room["access_code"]},
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "room_closed"
    rows = await _member_rows(db_session, room["id"])
    assert all(str(r[3]) != viewer_id for r in rows)


async def test_join_without_session_is_401(client):
    await _register(client, "join-owner@example.com", "Owner")
    room = await _create_room(client)
    client.cookies.clear()
    resp = await client.post(
        f"/api/rooms/{room['id']}/join",
        json={"code": room["access_code"]},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "not_authenticated"


async def test_join_anonymous_creates_membership_and_sets_cookie(client, db_session):
    room = await _make_room(client)
    client.cookies.clear()

    resp = await client.post(
        f"/api/rooms/{room['id']}/join",
        json={"code": room["access_code"], "anonymous": True, "nickname": "Anônimo"},
    )
    assert resp.status_code == 200
    assert resp.cookies.get("codelive_anon")
    assert "password_hash" not in resp.text
    rows = await _anon_rows(db_session, room["id"])
    assert len(rows) == 1
    role, is_anonymous, nickname, user_id, anonymous_session_id = rows[0]
    assert role == "viewer"
    assert is_anonymous is True
    assert nickname == "Anônimo"
    assert user_id is None
    assert anonymous_session_id


async def test_join_anonymous_rejoin_with_same_cookie_is_idempotent(client, db_session):
    room = await _make_room(client)
    client.cookies.clear()

    first = await client.post(
        f"/api/rooms/{room['id']}/join",
        json={"code": room["access_code"], "anonymous": True, "nickname": "Anônimo"},
    )
    assert first.status_code == 200
    second = await client.post(
        f"/api/rooms/{room['id']}/join",
        json={"code": room["access_code"], "anonymous": True, "nickname": "Anônimo"},
    )
    assert second.status_code == 200
    rows = await _anon_rows(db_session, room["id"])
    assert len(rows) == 1


async def test_join_anonymous_new_session_after_cookie_clear(client, db_session):
    room = await _make_room(client)
    client.cookies.clear()

    first = await client.post(
        f"/api/rooms/{room['id']}/join",
        json={"code": room["access_code"], "anonymous": True, "nickname": "Anônimo"},
    )
    assert first.status_code == 200
    client.cookies.clear()
    second = await client.post(
        f"/api/rooms/{room['id']}/join",
        json={"code": room["access_code"], "anonymous": True, "nickname": "Anônimo"},
    )
    assert second.status_code == 200
    rows = await _anon_rows(db_session, room["id"])
    assert len(rows) == 2
    assert rows[0][4] != rows[1][4]


async def test_join_anonymous_without_nickname_returns_422(client, db_session):
    room = await _make_room(client)
    client.cookies.clear()

    resp = await client.post(
        f"/api/rooms/{room['id']}/join",
        json={"code": room["access_code"], "anonymous": True},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation_error"
    assert await _anon_rows(db_session, room["id"]) == []


async def test_join_anonymous_blank_nickname_returns_422(client, db_session):
    room = await _make_room(client)
    client.cookies.clear()

    resp = await client.post(
        f"/api/rooms/{room['id']}/join",
        json={"code": room["access_code"], "anonymous": True, "nickname": "   "},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation_error"
    assert await _anon_rows(db_session, room["id"]) == []


async def test_join_anonymous_wrong_code_returns_404_and_no_row(client, db_session):
    room = await _make_room(client)
    client.cookies.clear()

    resp = await client.post(
        f"/api/rooms/{room['id']}/join",
        json={"code": _wrong_code(room["access_code"]), "anonymous": True, "nickname": "Anônimo"},
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "room_not_found"
    assert await _anon_rows(db_session, room["id"]) == []


async def test_join_anonymous_closed_room_returns_409_and_no_row(client, db_session):
    room = await _make_room(client)
    close = await client.patch(f"/api/rooms/{room['id']}/close")
    assert close.status_code == 200
    client.cookies.clear()

    resp = await client.post(
        f"/api/rooms/{room['id']}/join",
        json={"code": room["access_code"], "anonymous": True, "nickname": "Anônimo"},
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "room_closed"
    assert await _anon_rows(db_session, room["id"]) == []


async def test_joined_requires_auth_even_with_anonymous_cookie(client):
    room = await _make_room(client)
    client.cookies.clear()

    joined = await client.post(
        f"/api/rooms/{room['id']}/join",
        json={"code": room["access_code"], "anonymous": True, "nickname": "Anônimo"},
    )
    assert joined.status_code == 200
    assert joined.cookies.get("codelive_anon")

    resp = await client.get("/api/rooms/joined")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "not_authenticated"


async def test_join_extra_field_is_422(client):
    await _register(client, "join-owner@example.com", "Owner")
    room = await _create_room(client)
    resp = await client.post(
        f"/api/rooms/{room['id']}/join",
        json={"code": room["access_code"], "role": "owner"},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation_error"


async def test_join_bad_origin_is_403(client):
    await _register(client, "join-owner@example.com", "Owner")
    room = await _create_room(client)
    resp = await client.post(
        f"/api/rooms/{room['id']}/join",
        json={"code": room["access_code"]},
        headers={"Origin": "http://evil.example"},
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "invalid_origin"


async def test_join_blank_nickname_is_stored_as_null(client, db_session):
    room, viewer_id = await _make_room_and_viewer(client)
    resp = await client.post(
        f"/api/rooms/{room['id']}/join",
        json={"code": room["access_code"], "nickname": "   "},
    )
    assert resp.status_code == 200
    rows = await _member_rows(db_session, room["id"])
    viewer_rows = [r for r in rows if str(r[3]) == viewer_id]
    assert viewer_rows[0][2] is None
