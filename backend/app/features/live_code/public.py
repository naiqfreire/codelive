"""Cross-slice live_code contract — the ONLY module other slices may import."""
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.live_code.models import RoomCodeState

__all__ = ["list_current_states"]


async def list_current_states(session: AsyncSession) -> dict[uuid.UUID, str]:
    """Return ``{room_id: content}`` for every ``room_code_state`` row.

    Read-only and commit-free; the caller injects the session. A
    column-level select is deliberate: one bulk read, no joined SQL
    (D-19: the versions slice compares hashes in Python).
    """
    result = await session.execute(select(RoomCodeState.room_id, RoomCodeState.content))
    return {row.room_id: row.content for row in result.all()}
