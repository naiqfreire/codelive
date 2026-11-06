"""
Logout tests.
Accepted limitation (D-04): no central revocation — a copied session cookie
stays valid until exp; logout only clears the browser cookie.
"""
import pytest

pytestmark = pytest.mark.integration


async def _register(client, email="logout@example.com"):
    resp = await client.post(
        "/api/auth/register",
        json={"name": "Out", "email": email, "password": "correct-horse"},
    )
    assert resp.status_code == 201
    return resp.json()


async def test_logout_returns_204_and_clears_cookie(client):
    await _register(client)
    resp = await client.post("/api/auth/logout")
    assert resp.status_code == 204
    set_cookie = resp.headers.get("set-cookie", "")
    assert set_cookie.startswith("codelive_session=")
    assert "Max-Age=0" in set_cookie
    assert "Path=/" in set_cookie
    assert "HttpOnly" in set_cookie
    assert "Secure" in set_cookie
    assert "SameSite=lax" in set_cookie


async def test_me_after_logout_is_401(client):
    await _register(client)
    resp = await client.post("/api/auth/logout")
    assert resp.status_code == 204
    me = await client.get("/api/auth/me")
    assert me.status_code == 401
    assert me.json()["error"]["code"] == "not_authenticated"


async def test_logout_without_cookie_is_401(raw_client):
    resp = await raw_client.post("/api/auth/logout", headers={"Origin": "http://localhost:5173"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "not_authenticated"
