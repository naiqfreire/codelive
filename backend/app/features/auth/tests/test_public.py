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
