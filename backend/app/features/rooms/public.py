"""Cross-slice rooms contract — the ONLY module other slices may import."""
import uuid
from typing import TYPE_CHECKING

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.membership import public as membership
from app.features.rooms.models import Room
from app.shared.errors import ErrorCode

if TYPE_CHECKING:
    from app.features.auth.models import User

__all__ = ["authorize_room_identity"]


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
