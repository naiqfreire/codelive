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

__all__ = ["get_current_user", "get_user_by_id", "User", "require_authenticated", "require_role"]


async def get_current_user(
    request: Request,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> User:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        log.info("auth_rejected", reason="missing")
        raise HTTPException(status_code=401, detail=ErrorCode.NOT_AUTHENTICATED)
    try:
        payload = read_session(settings.SESSION_SECRET.get_secret_value(), token)
    except SignatureExpired:
        log.info("auth_rejected", reason="expired")
        raise HTTPException(status_code=401, detail=ErrorCode.NOT_AUTHENTICATED)
    except BadSignature:
        log.info("auth_rejected", reason="invalid")
        raise HTTPException(status_code=401, detail=ErrorCode.NOT_AUTHENTICATED)
    user = await get_user_by_id(session, payload.get("sub"))
    if user is None:
        log.info("auth_rejected", reason="unknown_user")
        raise HTTPException(status_code=401, detail=ErrorCode.NOT_AUTHENTICATED)
    return user


require_authenticated = get_current_user


def require_role(*allowed: str):
    """Dependency factory: 403 forbidden unless DB user's role is allowed."""

    async def _check(user: User = Depends(get_current_user)) -> User:
        if getattr(user, "role", None) not in allowed:
            raise HTTPException(status_code=403, detail=ErrorCode.FORBIDDEN)
        return user

    return _check
