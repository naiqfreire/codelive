"""Register: persists user, argon2id hash, signed session cookie."""
import re
import uuid

import pytest
from sqlalchemy import text

pytestmark = pytest.mark.integration


async def test_register_returns_201(client):
    resp = await client.post(
        "/api/auth/register",
        json={"name": "Ana", "email": "ana@example.com", "password": "correct-horse"},
    )
    assert resp.status_code == 201


async def test_register_body_shape(client):
    resp = await client.post(
        "/api/auth/register",
        json={"name": "Bob", "email": "bob@example.com", "password": "correct-horse"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert set(body.keys()) == {"id", "name", "email", "created_at"}
    assert isinstance(body["id"], str)
    uuid.UUID(body["id"])
    assert "password_hash" not in body
    assert "token" not in body


async def test_register_row_exists(client, db_session):
    resp = await client.post(
        "/api/auth/register",
        json={"name": "Carol", "email": "carol@example.com", "password": "correct-horse"},
    )
    assert resp.status_code == 201
    result = await db_session.execute(
        text("SELECT count(*) FROM users WHERE email = 'carol@example.com'")
    )
    assert result.scalar() == 1


async def test_cookie_attributes(client):
    resp = await client.post(
        "/api/auth/register",
        json={"name": "Dave", "email": "dave@example.com", "password": "correct-horse"},
    )
    assert resp.status_code == 201
    set_cookie = resp.headers.get("set-cookie", "")
    assert "codelive_session=" in set_cookie
    assert "HttpOnly" in set_cookie
    assert "Secure" in set_cookie
    assert "SameSite=lax" in set_cookie
    assert "Path=/" in set_cookie
    assert "Max-Age" not in set_cookie
    assert "Expires" not in set_cookie


async def test_password_hash_is_argon2id_and_salted(client, db_session):
    for email in ("erin@example.com", "frank@example.com"):
        resp = await client.post(
            "/api/auth/register",
            json={"name": "E", "email": email, "password": "same-password-1"},
        )
        assert resp.status_code == 201
    rows = (
        await db_session.execute(
            text("SELECT password_hash FROM users WHERE email IN ('erin@example.com','frank@example.com') ORDER BY email")
        )
    ).all()
    assert len(rows) == 2
    for (h,) in rows:
        assert re.match(r"^\$argon2id\$v=19\$", h)
    assert rows[0][0] != rows[1][0]


async def test_email_is_normalized(client, db_session):
    resp = await client.post(
        "/api/auth/register",
        json={"name": "Ana", "email": "  Ana@Example.COM ", "password": "correct-horse"},
    )
    assert resp.status_code == 201
    assert resp.json()["email"] == "ana@example.com"
    result = await db_session.execute(
        text("SELECT count(*) FROM users WHERE email = 'ana@example.com'")
    )
    assert result.scalar() == 1


async def test_duplicate_normalized_email_is_409(client):
    resp = await client.post(
        "/api/auth/register",
        json={"name": "Ana", "email": "ana@example.com", "password": "correct-horse"},
    )
    assert resp.status_code == 201
    resp2 = await client.post(
        "/api/auth/register",
        json={"name": "Ana2", "email": "  ANA@example.com ", "password": "correct-horse"},
    )
    assert resp2.status_code == 409
    assert resp2.json()["error"]["code"] == "email_already_exists"


async def test_integrity_error_race_is_mapped_to_409(client, monkeypatch):
    import app.features.auth.service as svc

    # Simulate the race: pre-check returns None even though the row will collide.
    async def fake_precheck(session, data):
        return None

    monkeypatch.setattr(svc, "_precheck_existing", fake_precheck, raising=False)
    resp = await client.post(
        "/api/auth/register",
        json={"name": "Race", "email": "race@example.com", "password": "correct-horse"},
    )
    assert resp.status_code == 201
    resp2 = await client.post(
        "/api/auth/register",
        json={"name": "Race2", "email": "race@example.com", "password": "correct-horse"},
    )
    # Even with the pre-check stubbed, the UNIQUE constraint must surface as 409, not 500.
    assert resp2.status_code == 409
    assert resp2.json()["error"]["code"] == "email_already_exists"


async def test_whitespace_name_is_422_and_writes_nothing(client, db_session):
    resp = await client.post(
        "/api/auth/register",
        json={"name": "   ", "email": "blank@example.com", "password": "correct-horse"},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation_error"
    result = await db_session.execute(
        text("SELECT count(*) FROM users WHERE email = 'blank@example.com'")
    )
    assert result.scalar() == 0


async def test_long_password_is_422_and_writes_nothing(client, db_session):
    resp = await client.post(
        "/api/auth/register",
        json={"name": "Long", "email": "long@example.com", "password": "x" * 129},
    )
    assert resp.status_code == 422
    result = await db_session.execute(
        text("SELECT count(*) FROM users WHERE email = 'long@example.com'")
    )
    assert result.scalar() == 0


async def test_no_credential_leakage_in_auth_responses(client):
    for path, payload in (
        ("/api/auth/register", {"name": "Leak", "email": "leak@example.com", "password": "correct-horse"}),
        ("/api/auth/login", {"email": "leak@example.com", "password": "correct-horse"}),
        ("/api/auth/login", {"email": "leak@example.com", "password": "wrong-password"}),
    ):
        resp = await client.post(path, json=payload)
        assert "password_hash" not in resp.text
        assert "argon2" not in resp.text
    resp = await client.get("/api/auth/me")
    assert "password_hash" not in resp.text
    assert "argon2" not in resp.text
