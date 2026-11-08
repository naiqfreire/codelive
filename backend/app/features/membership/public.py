"""Cross-slice membership contract — the ONLY module other slices may import."""
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.membership.models import RoomMember

__all__ = ["RoomMember", "create_owner_member"]


def create_owner_member(session: AsyncSession, room_id, user_id, role: str = "owner") -> RoomMember:
    """Add the owner's membership row to the caller's transaction. Does NOT commit."""
    member = RoomMember(room_id=room_id, user_id=user_id, role=role, is_anonymous=False, nickname=None)
    session.add(member)
    return member
