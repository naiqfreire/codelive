"""Cross-slice membership contract — the ONLY module other slices may import."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.membership.models import RoomMember

__all__ = ["RoomMember", "create_member", "create_owner_member", "list_memberships_for_user"]


def create_member(
    session: AsyncSession,
    room_id,
    user_id,
    role: str,
    nickname: str | None = None,
    is_anonymous: bool = False,
) -> RoomMember:
    """Add a membership row to the caller's transaction. Does NOT commit."""
    member = RoomMember(
        room_id=room_id,
        user_id=user_id,
        role=role,
        is_anonymous=is_anonymous,
        nickname=nickname,
    )
    session.add(member)
    return member


def create_owner_member(session: AsyncSession, room_id, user_id, role: str = "owner") -> RoomMember:
    """Add the owner's membership row to the caller's transaction. Does NOT commit."""
    return create_member(session, room_id, user_id, role=role, nickname=None, is_anonymous=False)


async def list_memberships_for_user(session: AsyncSession, user_id) -> list[RoomMember]:
    """Return every membership row for the user, newest first."""
    rows = (
        (
            await session.execute(
                select(RoomMember)
                .where(RoomMember.user_id == user_id)
                .order_by(RoomMember.joined_at.desc(), RoomMember.id.desc())
            )
        )
        .scalars()
        .all()
    )
    return list(rows)
