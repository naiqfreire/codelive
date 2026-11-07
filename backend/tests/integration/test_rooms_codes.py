"""Room creation: code collisions, exhaustion, atomicity and log hygiene."""
import json

import pytest
from sqlalchemy import select as sa_select
from sqlalchemy import text

from app.shared.logging import configure_logging

pytestmark = pytest.mark.integration


async def _register(client, email):
    resp = await client.post(
        "/api/auth/register",
        json={"name": "Owner", "email": email, "password": "correct-horse"},
    )
    assert resp.status_code == 201
    return resp


async def _rooms_count(db_session):
    result = await db_session.execute(text("SELECT count(*) FROM rooms"))
    return result.scalar()


async def test_collision_regenerates_code(client, monkeypatch):
    await _register(client, "coll-first@example.com")
    first = await client.post("/api/rooms", json={"language": "python"})
    assert first.status_code == 201
    existing_code = first.json()["access_code"]

    codes = iter([existing_code, "ZZZZ22"])
    monkeypatch.setattr(
        "app.features.rooms.service.generate_access_code",
        lambda: next(codes),
    )
    second = await client.post("/api/rooms", json={"language": "python"})
    assert second.status_code == 201
    assert second.json()["access_code"] == "ZZZZ22"


async def test_collision_on_database_path_regenerates_code(client, db_session, monkeypatch):
    await _register(client, "dbpath-first@example.com")
    first = await client.post("/api/rooms", json={"language": "python"})
    assert first.status_code == 201
    existing_code = first.json()["access_code"]

    # Force the database path: the existence pre-check always misses,
    # so the insert hits uq_rooms_access_code and the SAVEPOINT catches it.
    monkeypatch.setattr(
        "app.features.rooms.service.select",
        lambda *args, **kwargs: sa_select(False),
    )
    codes = iter([existing_code, "ZZZZ23"])
    monkeypatch.setattr(
        "app.features.rooms.service.generate_access_code",
        lambda: next(codes),
    )
    second = await client.post("/api/rooms", json={"language": "python"})
    assert second.status_code == 201
    assert second.json()["access_code"] == "ZZZZ23"
    assert await _rooms_count(db_session) == 2


async def test_attempts_exhausted_returns_500(client, db_session, monkeypatch, capsys):
    await _register(client, "exhaust-first@example.com")
    first = await client.post("/api/rooms", json={"language": "python"})
    assert first.status_code == 201
    existing_code = first.json()["access_code"]

    configure_logging("INFO")
    capsys.readouterr()
    monkeypatch.setattr(
        "app.features.rooms.service.generate_access_code",
        lambda: existing_code,
    )
    resp = await client.post("/api/rooms", json={"language": "python"})
    assert resp.status_code == 500
    body = resp.json()
    assert body["error"]["code"] == "internal_error"
    assert body["error"]["message"] == "Erro interno do servidor."
    assert await _rooms_count(db_session) == 1

    out = capsys.readouterr().out
    lines = [json.loads(line) for line in out.splitlines() if line.strip()]
    collisions = [line for line in lines if line.get("event") == "access_code_collision"]
    assert len(collisions) == 5
    for line in collisions:
        assert "attempt" in line
    exhausted = [line for line in lines if line.get("event") == "access_code_exhausted"]
    assert len(exhausted) == 1
    assert exhausted[0]["attempts"] == 5


async def test_membership_failure_rolls_back_room(client, db_session, monkeypatch):
    from app.features.membership.public import RoomMember

    await _register(client, "rollback-owner@example.com")

    def fake_create_owner_member(session, room_id, user_id, role="owner"):
        member = RoomMember(
            room_id=room_id,
            user_id=user_id,
            anonymous_session_id="anon-x",
            nickname=None,
            role=role,
            is_anonymous=True,
        )
        session.add(member)
        return member

    monkeypatch.setattr(
        "app.features.membership.public.create_owner_member",
        fake_create_owner_member,
    )
    before = await _rooms_count(db_session)
    resp = await client.post("/api/rooms", json={"language": "python"})
    assert resp.status_code == 500
    assert resp.json()["error"]["code"] == "internal_error"
    assert await _rooms_count(db_session) == before


async def test_room_created_log_has_no_access_code(client, capsys):
    configure_logging("INFO")
    await _register(client, "logcheck@example.com")
    me = (await client.get("/api/auth/me")).json()
    cookie_value = client.cookies.get("codelive_session", "")
    capsys.readouterr()
    resp = await client.post("/api/rooms", json={"language": "python"})
    assert resp.status_code == 201
    code = resp.json()["access_code"]
    body = resp.json()
    out = capsys.readouterr().out
    assert code not in out
    if cookie_value:
        assert cookie_value not in out
    lines = [json.loads(line) for line in out.splitlines() if line.strip()]
    created = [line for line in lines if line.get("event") == "room_created"]
    assert len(created) == 1
    assert created[0]["room_id"] == body["id"]
    assert created[0]["user_id"] == me["id"]
    assert created[0]["language"] == "python"
