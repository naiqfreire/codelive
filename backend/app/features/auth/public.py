"""Cross-slice auth contract — the ONLY module other slices may import."""
import structlog
from fastapi import Depends, HTTPException, Request
from itsdangerous import BadSignature, SignatureExpired
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.auth.models import User
from app.features.auth.service import get_user_by_id
from app.shared.config import Settings, get_settings
from app.shared.database import get_session
from app.shared.errors import ErrorCode
from app.shared.security import SESSION_COOKIE_NAME, read_session

log = structlog.get_logger()

__all__ = [
    "get_current_user",
    "get_current_user_optional",
    "get_user_by_id",
    "User",
    "require_authenticated",
    "require_role",
]


async def _resolve_user(
    request: Request,
    session: AsyncSession,
    settings: Settings,
    *,
    log_rejections: bool = True,
) -> User | None:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        if log_rejections:
            log.info("auth_rejected", reason="missing")
        return None
    try:
        payload = read_session(settings.SESSION_SECRET.get_secret_value(), token)
    except SignatureExpired:
        if log_rejections:
            log.info("auth_rejected", reason="expired")
        return None
    except BadSignature:
        if log_rejections:
            log.info("auth_rejected", reason="invalid")
        return None
    user = await get_user_by_id(session, payload.get("sub"))
    if user is None:
        if log_rejections:
            log.info("auth_rejected", reason="unknown_user")
        return None
    return user


async def get_current_user(
    request: Request,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> User:
    user = await _resolve_user(request, session, settings)
    if user is None:
        raise HTTPException(status_code=401, detail=ErrorCode.NOT_AUTHENTICATED)
    return user


async def get_current_user_optional(
    request: Request,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> User | None:
    """Like get_current_user, but returns None instead of raising 401.

    Used by the spectator join route, where an anonymous visitor is allowed.
    """
    return await _resolve_user(request, session, settings, log_rejections=False)


require_authenticated = get_current_user


def require_role(*allowed: str):
    """Dependency factory: 403 forbidden unless DB user's role is allowed."""

    async def _check(user: User = Depends(get_current_user)) -> User:
        if getattr(user, "role", None) not in allowed:
            raise HTTPException(status_code=403, detail=ErrorCode.FORBIDDEN)
        return user

    return _check
