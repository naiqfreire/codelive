"""Cross-slice membership contract — the ONLY module other slices may import."""
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.membership.models import RoomMember

__all__ = [
    "RoomMember",
    "create_member",
    "create_owner_member",
    "get_membership",
    "list_member_user_ids",
    "list_memberships_for_user",
]


def create_member(
    session: AsyncSession,
    room_id,
    user_id,
    role: str,
    nickname: str | None = None,
    is_anonymous: bool = False,
    anonymous_session_id: str | None = None,
) -> RoomMember:
    """Add a membership row to the caller's transaction. Does NOT commit."""
    member = RoomMember(
        room_id=room_id,
        user_id=user_id,
        anonymous_session_id=anonymous_session_id,
        nickname=nickname,
        role=role,
        is_anonymous=is_anonymous,
    )
    session.add(member)
    return member


def create_owner_member(session: AsyncSession, room_id, user_id, role: str = "owner") -> RoomMember:
    """Add the owner's membership row to the caller's transaction. Does NOT commit."""
    return create_member(session, room_id, user_id, role=role, nickname=None, is_anonymous=False)


async def get_membership(
    session: AsyncSession,
    room_id,
    *,
    user_id=None,
    anonymous_session_id: str | None = None,
) -> RoomMember | None:
    """Read-only cross-slice lookup by (room_id, identity). Does NOT commit.

    user_id wins when both identities are passed (D-15). Returns None without
    issuing any query when neither identity is given.
    """
    if user_id is not None:
        criterion = RoomMember.user_id == user_id
    elif anonymous_session_id is not None:
        criterion = RoomMember.anonymous_session_id == anonymous_session_id
    else:
        return None
    row = (
        (
            await session.execute(
                select(RoomMember).where(RoomMember.room_id == room_id, criterion)
            )
        )
        .scalars()
        .first()
    )
    return row


async def list_memberships_for_user(
    session: AsyncSession, user_id, *, role: str | None = None
) -> list[RoomMember]:
    """Return every membership row for the user, newest first.

    ``role`` narrows the result to one role (``"owner"`` or ``"viewer"``) when
    given. Read-only and commit-free.
    """
    statement = select(RoomMember).where(RoomMember.user_id == user_id)
    if role is not None:
        statement = statement.where(RoomMember.role == role)
    statement = statement.order_by(RoomMember.joined_at.desc(), RoomMember.id.desc())
    rows = (await session.execute(statement)).scalars().all()
    return list(rows)


async def list_member_user_ids(session: AsyncSession, room_id) -> list[uuid.UUID]:
    """Return the user ids of the room's authenticated members.

    Anonymous members have no ``user_id`` and are excluded. Read-only and
    commit-free; used to invalidate per-user caches after a room mutation.
    """
    rows = await session.execute(
        select(RoomMember.user_id).where(
            RoomMember.room_id == room_id,
            RoomMember.user_id.is_not(None),
        )
    )
    return list(rows.scalars().all())
