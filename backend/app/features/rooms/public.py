"""Cross-slice rooms contract — the ONLY module other slices may import."""
import uuid
from typing import TYPE_CHECKING

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.membership import public as membership
from app.features.rooms.models import Room
from app.shared.errors import ErrorCode

if TYPE_CHECKING:
    from app.features.auth.models import User

__all__ = [
    "authorize_room_identity",
    "get_room_owner_status_language",
    "get_room_status",
    "list_room_languages",
]


async def authorize_room_identity(
    session: AsyncSession,
    room_id: uuid.UUID,
    user: "User | None",
    anonymous_session_id: str | None,
) -> tuple[Room, str]:
    """Authorize a room identity for the live channel. Does NOT commit.

    Rule order: 404 unknown room, 409 closed room, 403 without a usable
    identity or membership row, else the role from the server-side owner rule
    ("owner" iff room.owner_id == user.id, else "viewer").
    """
    room = await session.get(Room, room_id)
    if room is None:
        raise HTTPException(status_code=404, detail=ErrorCode.ROOM_NOT_FOUND)
    if room.status == "closed":
        raise HTTPException(status_code=409, detail=ErrorCode.ROOM_CLOSED)
    if user is None and anonymous_session_id is None:
        raise HTTPException(status_code=403, detail=ErrorCode.FORBIDDEN)
    member = await membership.get_membership(
        session,
        room_id,
        user_id=(user.id if user is not None else None),
        anonymous_session_id=(None if user is not None else anonymous_session_id),
    )
    if member is None:
        raise HTTPException(status_code=403, detail=ErrorCode.FORBIDDEN)
    role = "owner" if (user is not None and room.owner_id == user.id) else "viewer"
    return room, role


async def get_room_owner_status_language(
    session: AsyncSession, room_id: uuid.UUID
) -> tuple[uuid.UUID, str, str] | None:
    """Return ``(owner_id, status, language)`` for a room, or None if absent.

    Read-only and commit-free. A column-level select is deliberate: it always
    issues SQL, so the owner rule, the closed-room refusal and the snapshot
    frame's language all read one fresh row (D-01/D-05 precedent: no
    identity-map answers for cross-slice reads).
    """
    result = await session.execute(
        select(Room.owner_id, Room.status, Room.language).where(Room.id == room_id)
    )
    row = result.one_or_none()
    if row is None:
        return None
    return row.owner_id, row.status, row.language


async def get_room_status(session: AsyncSession, room_id: uuid.UUID) -> str | None:
    """Return the room's current status, or None when the room does not exist.

    Read-only and commit-free. A column-level select is deliberate: it always
    issues SQL, so a fresh value is read on every frame instead of being
    answered from the identity map (D-01: re-read per ``code_update``).
    """
    result = await session.execute(select(Room.status).where(Room.id == room_id))
    return result.scalar_one_or_none()


async def list_room_languages(session: AsyncSession) -> dict[uuid.UUID, str]:
    """Return ``{room_id: language}`` for every rooms row.

    Read-only and commit-free; the caller injects the session. Used by the
    versions slice to source ``code_versions.language`` per changed room
    (D-19: bulk read through the owner's public surface, no joined SQL).
    """
    result = await session.execute(select(Room.id, Room.language))
    return {row.id: row.language for row in result.all()}
