"""Observability: one X-Request-ID per response, NDJSON logs correlated."""
import json
import uuid

import pytest

from app.shared.logging import configure_logging

pytestmark = pytest.mark.integration


async def test_exactly_one_x_request_id(raw_client):
    resp = await raw_client.get("/api/health")
    assert len(resp.headers.get_list("x-request-id")) == 1


async def test_client_supplied_request_id_is_overwritten(raw_client):
    resp = await raw_client.get("/api/health", headers={"X-Request-ID": "client-forged"})
    value = resp.headers.get("x-request-id")
    assert value != "client-forged"
    uuid.UUID(value)  # must be valid UUIDv4


async def test_http_request_log_line_matches_header(raw_client, capsys):
    configure_logging("INFO")
    resp = await raw_client.get("/api/health")
    out = capsys.readouterr().out
    parsed = [json.loads(l) for l in out.splitlines() if l.strip()]
    http = [l for l in parsed if l.get("event") == "http_request"]
    assert http, "no http_request log line captured"
    last = http[-1]
    assert last["event"] == "http_request"
    for key in ("timestamp", "level", "event", "request_id", "method", "path", "status", "duration_ms"):
        assert last.get(key) is not None, key
    assert last["request_id"] == resp.headers.get("x-request-id")
    assert last["method"] == "GET"
    assert last["path"] == "/api/health"
    assert last["status"] == 200


async def test_every_line_is_ndjson_and_no_body_or_cookie(raw_client, capsys):
    configure_logging("INFO")
    resp = await raw_client.get("/api/health")
    out = capsys.readouterr().out
    for line in out.splitlines():
        if not line.strip():
            continue
        json.loads(line)  # must parse standalone
        assert "cookie" not in line.lower()
    # request body must never be logged
    assert "client-forged" not in out


async def test_second_request_gets_different_request_id(raw_client, capsys):
    configure_logging("INFO")
    r1 = await raw_client.get("/api/health")
    capsys.readouterr()
    r2 = await raw_client.get("/api/health")
    assert r1.headers.get("x-request-id") != r2.headers.get("x-request-id")
    out = capsys.readouterr().out
    lines = [json.loads(l) for l in out.splitlines() if l.strip()]
    http_lines = [l for l in lines if l.get("event") == "http_request"]
    assert len(http_lines) == 1
    assert http_lines[0]["request_id"] == r2.headers.get("x-request-id")


async def test_events(client, capsys):
    """D-21 auth events exist and carry no PII."""
    configure_logging("INFO")
    capsys.readouterr()
    email = "events@example.com"
    password = "correct-horse"
    r = await client.post(
        "/api/auth/register",
        json={"name": "Ev", "email": email, "password": password},
    )
    assert r.status_code == 201
    cookie_value = r.cookies.get("codelive_session", "")
    client.cookies.clear()
    bad = await client.post("/api/auth/login", json={"email": email, "password": "wrong-password"})
    assert bad.status_code == 401
    good = await client.post("/api/auth/login", json={"email": email, "password": password})
    assert good.status_code == 200
    test_client2 = await client.post("/api/auth/logout")
    assert test_client2.status_code == 204
    rej = await client.get("/api/auth/me")
    assert rej.status_code == 401
    out = capsys.readouterr().out
    lines = [json.loads(l) for l in out.splitlines() if l.strip()]
    events = {l.get("event") for l in lines}
    for expected in ("user_registered", "login_succeeded", "login_failed", "logout", "auth_rejected"):
        assert expected in events, expected
    for line in out.splitlines():
        assert email not in line
        assert password not in line
        if cookie_value:
            assert cookie_value not in line
        assert "password_hash" not in line


async def _post_no_origin(client, path, payload):
    request = client.build_request("POST", path, json=payload)
    if "origin" in request.headers:
        del request.headers["origin"]
    return await client.send(request)


async def test_origin_missing_on_post_is_403(client, db_session):
    from sqlalchemy import text as _text

    resp = await _post_no_origin(
        client,
        "/api/auth/register",
        {"name": "NoOrigin", "email": "noorigin@example.com", "password": "correct-horse"},
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "invalid_origin"
    result = await db_session.execute(
        _text("SELECT count(*) FROM users WHERE email = 'noorigin@example.com'")
    )
    assert result.scalar() == 0


async def test_origin_foreign_on_post_is_403(client):
    resp = await client.post(
        "/api/auth/register",
        json={"name": "Evil", "email": "evil@example.com", "password": "correct-horse"},
        headers={"Origin": "http://evil.example"},
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "invalid_origin"


async def test_origin_allowed_on_post_is_201(client):
    resp = await client.post(
        "/api/auth/register",
        json={"name": "Good", "email": "allowed@example.com", "password": "correct-horse"},
        headers={"Origin": "http://localhost:5173"},
    )
    assert resp.status_code == 201


async def test_preflight_allowed_origin(client):
    resp = await client.options(
        "/api/auth/login",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert resp.headers.get("access-control-allow-credentials") == "true"


async def test_preflight_foreign_origin_not_echoed(client):
    resp = await client.options(
        "/api/auth/login",
        headers={
            "Origin": "http://evil.example",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert resp.status_code != 403
    assert resp.headers.get("access-control-allow-origin") != "http://evil.example"


async def test_envelope_matrix(client, raw_client):
    # 401 no cookie
    r401 = await raw_client.get("/api/auth/me")
    assert r401.status_code == 401
    # 403 foreign origin
    r403 = await client.post(
        "/api/auth/register",
        json={"name": "X", "email": "matrix@example.com", "password": "correct-horse"},
        headers={"Origin": "http://evil.example"},
    )
    assert r403.status_code == 403
    # 404
    r404 = await raw_client.get("/api/does-not-exist")
    assert r404.status_code == 404
    # 405
    r405 = await client.request("PUT", "/api/health")
    assert r405.status_code == 405
    # 422
    r422 = await client.post(
        "/api/auth/register", json={"name": "X", "email": "bad", "password": "short"}
    )
    assert r422.status_code == 422
    for resp in (r401, r403, r404, r405, r422):
        body = resp.json()
        assert set(body.keys()) == {"error"}
        assert set(body["error"].keys()) == {"code", "message", "request_id"}
        assert "detail" not in body
    assert r404.json()["error"]["code"] != "Not Found"


async def test_single_request_id_matrix(client, raw_client):
    responses = []
    responses.append(await raw_client.get("/api/health"))
    responses.append(await raw_client.get("/api/auth/me"))
    responses.append(
        await client.post(
            "/api/auth/register",
            json={"name": "X", "email": "m2@example.com", "password": "correct-horse"},
            headers={"Origin": "http://evil.example"},
        )
    )
    responses.append(await raw_client.get("/api/does-not-exist"))
    responses.append(
        await client.post("/api/auth/register", json={"name": "", "email": "bad", "password": "x"})
    )
    for resp in responses:
        assert len(resp.headers.get_list("x-request-id")) == 1
        if "error" in resp.json():
            assert resp.json()["error"]["request_id"] == resp.headers.get("x-request-id")


async def test_500_generic(raw_client):
    from fastapi import FastAPI

    from app.shared.errors import register_handlers
    from app.shared.middleware import RequestContextMiddleware

    boom = FastAPI()
    boom.add_middleware(RequestContextMiddleware)
    register_handlers(boom)

    @boom.get("/boom")
    async def _boom():
        raise RuntimeError("secret-detail-marker")

    import httpx

    transport = httpx.ASGITransport(app=boom, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="https://test") as ac:
        resp = await ac.get("/boom")
    assert resp.status_code == 500
    body = resp.json()
    assert body["error"]["code"] == "internal_error"
    assert body["error"]["message"] == "Erro interno do servidor."
    assert "secret-detail-marker" not in resp.text
    assert "RuntimeError" not in resp.text
    assert "Traceback" not in resp.text


async def test_422_message_names_field_in_portuguese(client):
    resp = await client.post(
        "/api/auth/register",
        json={"name": "X", "email": "field@example.com", "password": "short"},
    )
    assert resp.status_code == 422
    message = resp.json()["error"]["message"]
    assert "password" in message
