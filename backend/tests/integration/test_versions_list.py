"""GET /api/rooms/{id}/versions: owner-only chronological listing (VERS-04).

Matrix per plan: 401 cookie-less, 401 forged session, 403 authenticated non-owner,
403 anonymous member, owner 200 with exact D-07 shape + ASC order,
closed room 200 for owner, empty room 200 [].
"""
import hashlib
import json
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text

pytestmark = pytest.mark.integration


async def _register(client, email, name="User"):
    resp = await client.post(
        "/api/auth/register",
        json={"name": name, "email": email, "password": "correct-horse"},
    )
    assert resp.status_code == 201
    return resp


async def _create_room(client):
    resp = await client.post("/api/rooms", json={"language": "python"})
    assert resp.status_code == 201
    return resp.json()


async def _seed_version(db_session, room_id, content, created_at, author_id=None, vid=None):
    """Insert a version row with explicit created_at (D-05)."""
    await db_session.execute(
        text(
            "INSERT INTO code_versions (id, room_id, content, language, author_id, created_at) "
            "VALUES (:id, :room, :content, 'python', :author, :created)"
        ),
        {
            "id": vid or uuid.uuid7(),
            "room": room_id,
            "content": content,
            "author": author_id,
            "created": created_at,
        },
    )
    await db_session.commit()


def _content_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


async def test_list_versions_requires_auth(client):
    """a) cookie-less GET → 401 not_authenticated"""
    resp = await client.get(f"/api/rooms/{uuid.uuid4()}/versions")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "not_authenticated"


async def test_list_versions_forged_session_401(client):
    """b) forged codelive_session cookie → 401"""
    client.cookies.set("codelive_session", "forged-invalid-cookie")
    resp = await client.get(f"/api/rooms/{uuid.uuid4()}/versions")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "not_authenticated"


async def test_list_versions_authenticated_non_owner_403(client, capsys):
    """c) authenticated second user (non-owner) → 403 forbidden"""
    from app.shared.logging import configure_logging

    configure_logging("INFO")
    await _register(client, "list-owner@example.com")
    room = await _create_room(client)
    room_id = room["id"]

    # Second user
    await client.post(
        "/api/auth/register",
        json={"name": "Other", "email": "list-other@example.com", "password": "correct-horse"},
    )
    capsys.readouterr()  # flush register/create noise before the listing call
    resp = await client.get(f"/api/rooms/{room_id}/versions")
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "forbidden"
    # D-03: refused reads emit no dedicated event — only the middleware
    # http_request access line.
    lines = [json.loads(l) for l in capsys.readouterr().out.splitlines() if l.strip()]
    assert lines
    assert {l.get("event") for l in lines} == {"http_request"}
    assert lines[0]["status"] == 403


async def test_list_versions_anonymous_member_403(client, db_session, capsys):
    """d) anonymous member: POST /join with anonymous=true, then GET with only codelive_anon cookie → 403"""
    from app.shared.logging import configure_logging

    configure_logging("INFO")
    await _register(client, "list-anon-owner@example.com")
    room = await _create_room(client)
    room_id = room["id"]
    access_code = room["access_code"]

    # Clear cookies, join anonymously
    client.cookies.clear()
    join_resp = await client.post(
        f"/api/rooms/{room_id}/join",
        json={"code": access_code, "anonymous": True, "nickname": "Anônimo"},
    )
    assert join_resp.status_code == 200
    anon_cookie = join_resp.cookies.get("codelive_anon")
    assert anon_cookie

    # Clear session cookie, keep only anon cookie
    client.cookies.clear()
    client.cookies.set("codelive_anon", anon_cookie)

    capsys.readouterr()  # flush register/create/join noise before the listing call
    resp = await client.get(f"/api/rooms/{room_id}/versions")
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "forbidden"
    # D-03: the versions slice emits no dedicated refusal event. The only
    # lines are the middleware http_request access line plus, for this
    # no-session anonymous path, the auth kernel's standard auth_rejected
    # (same noise the mirrored WS admit path produces). No version_* event.
    lines = [json.loads(l) for l in capsys.readouterr().out.splitlines() if l.strip()]
    assert lines
    events = {l.get("event") for l in lines}
    assert events <= {"http_request", "auth_rejected"}
    assert "http_request" in events
    assert not any("version" in str(e) for e in events)
    access = [l for l in lines if l.get("event") == "http_request"]
    assert len(access) == 1
    assert access[0]["status"] == 403
    assert access[0]["path"].endswith("/versions")


async def test_list_versions_owner_200_exact_shape_and_order(client, db_session):
    """e) owner → 200 with rows exactly {id, created_at, content_hash, language, author_id},
    no content key, created_at ASC order across 3 backdated seeds, job-written row author_id null serialized."""
    await _register(client, "list-owner-200@example.com")
    room = await _create_room(client)
    room_id = uuid.UUID(room["id"])

    now = datetime(2026, 11, 13, 12, 0, 0, tzinfo=timezone.utc)

    # Seed 3 versions with distinct created_at (oldest first in ASC order)
    await _seed_version(db_session, room_id, "version-1", now - timedelta(days=2))  # 2 days ago
    await _seed_version(db_session, room_id, "version-2", now - timedelta(days=1))  # 1 day ago
    # Job-written version (author_id = NULL)
    await _seed_version(
        db_session, room_id, "version-3-job", now, author_id=None
    )  # today

    resp = await client.get(f"/api/rooms/{room_id}/versions")
    assert resp.status_code == 200
    body = resp.json()

    # Exactly 3 rows
    assert len(body) == 3

    # Response rows in ASC order (created_at ASC)
    assert body[0]["content_hash"] == _content_hash("version-1")
    assert body[1]["content_hash"] == _content_hash("version-2")
    assert body[2]["content_hash"] == _content_hash("version-3-job")

    # Exact key set per row (no "content" key)
    expected_keys = {"id", "created_at", "content_hash", "language", "author_id"}
    for row in body:
        assert set(row.keys()) == expected_keys, f"Row keys: {set(row.keys())}"

    # Job-written row has author_id = null (serialized as JSON null)
    assert body[2]["author_id"] is None

    # All content_hashes correct
    assert body[0]["content_hash"] == _content_hash("version-1")
    assert body[1]["content_hash"] == _content_hash("version-2")
    assert body[2]["content_hash"] == _content_hash("version-3-job")

    # Language is python
    for row in body:
        assert row["language"] == "python"


async def test_list_versions_closed_room_owner_200(client, db_session):
    """f) closed room (PATCH /close) owner list → 200 (D-04)"""
    await _register(client, "list-closed@example.com")
    room = await _create_room(client)
    room_id = room["id"]

    # Close the room
    close_resp = await client.patch(f"/api/rooms/{room_id}/close")
    assert close_resp.status_code == 200

    # Seed a version
    now = datetime(2026, 11, 13, 12, 0, 0, tzinfo=timezone.utc)
    await _seed_version(db_session, uuid.UUID(room_id), "closed-room-version", now)

    resp = await client.get(f"/api/rooms/{room_id}/versions")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["content_hash"] == _content_hash("closed-room-version")


async def test_list_versions_empty_room_200(client):
    """g) empty room → 200 []"""
    await _register(client, "list-empty@example.com")
    room = await _create_room(client)
    room_id = room["id"]

    resp = await client.get(f"/api/rooms/{room_id}/versions")
    assert resp.status_code == 200
    assert resp.json() == []


# --- Task 2: ordering stability + edge cases -------------------------------

BASE_NOW = datetime(2026, 11, 13, 12, 0, 0, tzinfo=timezone.utc)


async def test_list_versions_equal_created_at_breaks_tie_by_id_asc(client, db_session):
    """VERS-04 adjacency: rows with the SAME created_at separate by id ASC, not merged.

    Two distinct UUIDv7 ids share one explicit created_at; the response order
    is exactly sorted(id) ascending (D-07 tiebreak). Run twice to prove
    determinism.
    """
    await _register(client, "list-tiebreak@example.com")
    room = await _create_room(client)
    room_id = uuid.UUID(room["id"])

    tie_at = BASE_NOW - timedelta(days=1)
    low_id = uuid.UUID(int=1)
    high_id = uuid.UUID(int=2)
    # Insert high-then-low to prove the order comes from ORDER BY, not insert order.
    await _seed_version(db_session, room_id, "tie-high", tie_at, vid=high_id)
    await _seed_version(db_session, room_id, "tie-low", tie_at, vid=low_id)

    for _ in range(2):
        resp = await client.get(f"/api/rooms/{room_id}/versions")
        assert resp.status_code == 200
        body = resp.json()
        assert len(body) == 2
        returned_ids = [uuid.UUID(row["id"]) for row in body]
        assert returned_ids == sorted(returned_ids)
        assert returned_ids == [low_id, high_id]
        assert body[0]["content_hash"] == _content_hash("tie-low")
        assert body[1]["content_hash"] == _content_hash("tie-high")


async def test_list_versions_single_row_room(client, db_session):
    """One version → exactly one row in the response."""
    await _register(client, "list-single@example.com")
    room = await _create_room(client)
    room_id = uuid.UUID(room["id"])

    version_id = uuid.uuid7()
    await _seed_version(
        db_session, room_id, "only-version", BASE_NOW, author_id=None, vid=version_id
    )

    resp = await client.get(f"/api/rooms/{room_id}/versions")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["id"] == str(version_id)
    assert body[0]["content_hash"] == _content_hash("only-version")
    assert body[0]["author_id"] is None


async def test_list_versions_old_row_still_listed(client, db_session):
    """A 31-day-old row is still listed (the listing filters nothing; retention is separate).

    The lone version is the newest of its room, so retention would keep it too;
    the listing returns whatever rows exist.
    """
    await _register(client, "list-old@example.com")
    room = await _create_room(client)
    room_id = uuid.UUID(room["id"])

    await _seed_version(db_session, room_id, "old-31d", BASE_NOW - timedelta(days=31))

    resp = await client.get(f"/api/rooms/{room_id}/versions")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["content_hash"] == _content_hash("old-31d")