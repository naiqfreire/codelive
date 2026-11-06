"""Login: 200 + cookie, generic 401 invalid_credentials, dummy-hash equalization."""
import pytest

pytestmark = pytest.mark.integration

EMAIL = "login@example.com"
PASSWORD = "correct-horse"


async def _register(client, email=EMAIL, password=PASSWORD):
    resp = await client.post(
        "/api/auth/register",
        json={"name": "Login", "email": email, "password": password},
    )
    assert resp.status_code == 201
    return resp.json()


async def test_login_returns_200_with_user_body(client):
    await _register(client)
    client.cookies.clear()
    resp = await client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert resp.status_code == 200
    body = resp.json()
    assert set(body.keys()) == {"id", "name", "email", "created_at"}
    assert "password_hash" not in body
    assert "token" not in body


async def test_login_cookie_attributes(client):
    await _register(client)
    resp = await client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert resp.status_code == 200
    set_cookie = resp.headers.get("set-cookie", "")
    assert "codelive_session=" in set_cookie
    assert "HttpOnly" in set_cookie
    assert "Secure" in set_cookie
    assert "SameSite=lax" in set_cookie
    assert "Path=/" in set_cookie
    assert "Max-Age" not in set_cookie
    assert "Expires" not in set_cookie


async def test_unknown_email_and_wrong_password_are_identical(client):
    await _register(client)
    unknown = await client.post(
        "/api/auth/login", json={"email": "nobody@example.com", "password": PASSWORD}
    )
    wrong = await client.post(
        "/api/auth/login", json={"email": EMAIL, "password": "wrong-password"}
    )
    assert unknown.status_code == 401
    assert wrong.status_code == 401
    b1 = unknown.json()
    b2 = wrong.json()
    assert b1["error"]["code"] == "invalid_credentials"
    b1["error"].pop("request_id")
    b2["error"].pop("request_id")
    assert b1 == b2


async def test_unknown_email_performs_dummy_verify(client, monkeypatch):
    await _register(client)
    calls = []
    import app.features.auth.service as svc

    real = svc.verify_password

    def recording(stored, raw):
        calls.append(stored)
        return real(stored, raw)

    monkeypatch.setattr(svc, "verify_password", recording)
    resp = await client.post(
        "/api/auth/login", json={"email": "ghost@example.com", "password": PASSWORD}
    )
    assert resp.status_code == 401
    assert len(calls) == 1
    from app.shared.security import DUMMY_HASH

    assert calls[0] == DUMMY_HASH


async def test_login_malformed_body_is_422(client):
    resp = await client.post("/api/auth/login", json={"email": "not-an-email"})
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation_error"
