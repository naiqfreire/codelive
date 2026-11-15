"""Versions REST routes — thin; business rules live in service.py (D-03)."""
import uuid
from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends, HTTPException, Request
from itsdangerous import BadSignature, SignatureExpired
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.auth import public as auth
from app.features.versions import service
from app.features.versions.schemas import RestoreResponse, VersionOut
from app.shared.config import Settings, get_settings
from app.shared.database import get_session
from app.shared.errors import ErrorCode
from app.shared.security import ANONYMOUS_COOKIE_NAME, read_anonymous_session

if TYPE_CHECKING:
    from app.features.auth.models import User

router = APIRouter()


async def require_room_identity(
    request: Request,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> "User | None":
    """Optional identity: session user, else a valid ``codelive_anon`` cookie.

    Mirrors the WS ``admit`` fallback (live_code/router.py): the session
    user wins; otherwise the anonymous cookie is verified; neither means
    401 ``not_authenticated``. A valid anonymous member is a real identity
    that can only ever be non-owner — the service ladder turns it into
    403 ``forbidden``. Forged or expired anonymous cookies are treated as
    absent. ``require_authenticated`` is deliberately not used here: it
    could never yield 403 for a valid anonymous member (D-01, plan-time
    user decision 1).
    """
    user = await auth.resolve_user(request, session, settings)
    if user is not None:
        return user
    token = request.cookies.get(ANONYMOUS_COOKIE_NAME)
    anonymous_ok = False
    if token:
        try:
            read_anonymous_session(settings.SESSION_SECRET.get_secret_value(), token)
            anonymous_ok = True
        except (BadSignature, SignatureExpired):
            anonymous_ok = False
    if not anonymous_ok:
        raise HTTPException(status_code=401, detail=ErrorCode.NOT_AUTHENTICATED)
    return None


@router.get(
    "/{room_id}/versions", response_model=list[VersionOut]
)
async def list_versions(
    room_id: uuid.UUID,
    identity: "User | None" = Depends(require_room_identity),
    session: AsyncSession = Depends(get_session),
):
    return await service.list_versions(session, room_id, identity)


@router.post(
    "/{room_id}/versions/{version_id}/restore", response_model=RestoreResponse
)
async def restore_version(
    room_id: uuid.UUID,
    version_id: uuid.UUID,
    identity: "User | None" = Depends(require_room_identity),
    session: AsyncSession = Depends(get_session),
):
    return await service.restore_version(session, room_id, version_id, identity)
