"""GET /api/auth/me resolves the signed cookie via public.get_current_user."""
import uuid

import pytest

pytestmark = pytest.mark.integration


async def _register(client, email="me@example.com"):
    resp = await client.post(
        "/api/auth/register",
        json={"name": "Me", "email": email, "password": "correct-horse"},
    )
    assert resp.status_code == 201
    return resp.json()


async def test_me_after_register(client):
    body = await _register(client)
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == body["id"]
    assert data["name"] == "Me"
    assert data["email"] == "me@example.com"


async def test_me_without_cookie_is_401_envelope(raw_client):
    resp = await raw_client.get("/api/auth/me")
    assert resp.status_code == 401
    body = resp.json()
    assert body["error"]["code"] == "not_authenticated"
    assert body["error"]["message"]
    uuid.UUID(body["error"]["request_id"])


async def test_me_tampered_cookie_is_401(client):
    await _register(client, "tamper@example.com")
    client.cookies.clear()
    client.cookies.set("codelive_session", "not-a-signed-token", domain="test")
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "not_authenticated"


async def test_me_expired_cookie_is_401(client, monkeypatch):
    await _register(client, "expired@example.com")
    monkeypatch.setattr("app.shared.security.TOKEN_MAX_AGE", -1)
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "not_authenticated"


def test_public_contract_importable():
    from app.features.auth.public import get_current_user

    assert get_current_user is not None
