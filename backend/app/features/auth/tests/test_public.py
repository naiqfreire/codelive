"""Unit: 403 policy path + protected-router wiring. No database."""
import httpx
import pytest
from fastapi import Depends, FastAPI

from app.features.auth import public
from app.features.auth.public import get_current_user, require_authenticated, require_role
from app.features.auth.router import protected_router
from app.shared.errors import register_handlers
from app.shared.middleware import RequestContextMiddleware


class _User:
    id = "user-1"
    name = "NoRole"
    email = "norole@example.com"


def _build_app():
    app = FastAPI()
    app.add_middleware(RequestContextMiddleware)
    register_handlers(app)

    @app.get("/owner-only")
    async def owner_only(user=Depends(require_role("owner"))):
        return {"ok": True}

    app.dependency_overrides[get_current_user] = lambda: _User()
    # require_role resolves get_current_user via Depends — override must apply
    return app


@pytest.mark.asyncio
async def test_require_role_without_role_is_403_envelope():
    app = _build_app()
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="https://test") as client:
        resp = await client.get("/owner-only")
    assert resp.status_code == 403
    body = resp.json()
    assert body["error"]["code"] == "forbidden"
    assert body["error"]["message"]
    assert body["error"]["request_id"]


def test_require_authenticated_is_get_current_user_alias():
    assert require_authenticated is get_current_user


def test_get_current_user_optional_is_exported_and_async():
    import inspect

    from app.features.auth import public

    assert "get_current_user_optional" in public.__all__
    assert inspect.iscoroutinefunction(public.get_current_user_optional)


def test_protected_router_wiring():
    deps = protected_router.dependencies
    assert any(
        getattr(d, "dependency", None) is require_authenticated for d in deps
    ), "protected_router must declare Depends(require_authenticated)"


def _settings():
    from app.shared.config import Settings

    return Settings(
        DATABASE_URL="postgresql+psycopg://codelive:codelive@localhost:5432/codelive_test",
        SESSION_SECRET="unit-test-secret-token",
        ALLOWED_ORIGINS=["http://localhost:5173"],
    )


def _connection(cookies: dict | None = None):
    from starlette.requests import HTTPConnection

    headers = []
    if cookies:
        raw = "; ".join(f"{k}={v}" for k, v in cookies.items()).encode()
        headers.append((b"cookie", raw))
    return HTTPConnection(
        {"type": "http", "method": "GET", "path": "/", "headers": headers}
    )


def _session_with_user(user):
    class _Session:
        def __init__(self):
            self.lookups = []

        async def get(self, model, pk):
            self.lookups.append((model, pk))
            return user

    return _Session()


def test_resolve_user_is_exported_and_async():
    import inspect

    assert "resolve_user" in public.__all__
    assert inspect.iscoroutinefunction(public.resolve_user)


def test_resolve_user_first_parameter_is_httpconnection():
    import inspect

    from starlette.requests import HTTPConnection

    from app.features.auth.public import resolve_user

    params = list(inspect.signature(resolve_user).parameters.values())
    assert params[0].annotation is HTTPConnection


async def test_resolve_user_without_cookie_returns_none_and_stays_silent():
    from structlog.testing import capture_logs

    from app.features.auth.public import resolve_user

    session = _session_with_user(_User())
    with capture_logs() as logs:
        found = await resolve_user(
            _connection(), session, _settings(), log_rejections=False
        )
    assert found is None
    assert session.lookups == []
    assert [e for e in logs if e.get("event") == "auth_rejected"] == []


async def test_resolve_user_without_cookie_logs_missing_when_enabled():
    from structlog.testing import capture_logs

    from app.features.auth.public import resolve_user

    session = _session_with_user(_User())
    with capture_logs() as logs:
        found = await resolve_user(_connection(), session, _settings())
    assert found is None
    reasons = [e.get("reason") for e in logs if e.get("event") == "auth_rejected"]
    assert reasons == ["missing"]


async def test_resolve_user_invalid_signature_returns_none_and_logs():
    from structlog.testing import capture_logs

    from app.features.auth.public import resolve_user

    session = _session_with_user(_User())
    conn = _connection({"codelive_session": "not-a-valid-token"})
    with capture_logs() as logs:
        found = await resolve_user(conn, session, _settings())
    assert found is None
    assert session.lookups == []
    reasons = [e.get("reason") for e in logs if e.get("event") == "auth_rejected"]
    assert reasons == ["invalid"]


async def test_resolve_user_expired_token_returns_none_and_logs(monkeypatch):
    from structlog.testing import capture_logs

    from app.features.auth.public import resolve_user
    from app.shared.security import issue_session

    monkeypatch.setattr("app.shared.security.TOKEN_MAX_AGE", -1)
    token = issue_session("unit-test-secret-token", "user-1")
    session = _session_with_user(_User())
    conn = _connection({"codelive_session": token})
    with capture_logs() as logs:
        found = await resolve_user(conn, session, _settings())
    assert found is None
    reasons = [e.get("reason") for e in logs if e.get("event") == "auth_rejected"]
    assert reasons == ["expired"]


async def test_resolve_user_valid_token_returns_user():
    from app.features.auth.public import resolve_user
    from app.shared.security import issue_session

    token = issue_session("unit-test-secret-token", "user-1")
    user = _User()
    session = _session_with_user(user)
    conn = _connection({"codelive_session": token})

    found = await resolve_user(conn, session, _settings())

    assert found is user
    assert session.lookups[0][1] == "user-1"


async def test_resolve_user_unknown_subject_returns_none_and_logs():
    from structlog.testing import capture_logs

    from app.features.auth.public import resolve_user
    from app.shared.security import issue_session

    token = issue_session("unit-test-secret-token", "ghost-user")
    session = _session_with_user(None)
    conn = _connection({"codelive_session": token})
    with capture_logs() as logs:
        found = await resolve_user(conn, session, _settings())
    assert found is None
    reasons = [e.get("reason") for e in logs if e.get("event") == "auth_rejected"]
    assert reasons == ["unknown_user"]
