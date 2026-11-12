"""live_code business logic: current-code state service.

D-01: MAX_CODE_BYTES is a module-level constant (256 KiB, UTF-8 bytes).
D-09: content_hash is the SHA-256 hex of the UTF-8 bytes of `content`.
D-13: read-or-empty - no row yet means the snapshot carries content == "".
"""
import hashlib
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.live_code.models import RoomCodeState

MAX_CODE_BYTES = 262_144  # 256 KiB measured on the UTF-8 byte length of `content` (D-01)


def content_hash(content: str) -> str:
    """SHA-256 hex of the UTF-8 bytes of `content` (D-09)."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


async def read_current_state(
    session: AsyncSession, room_id: uuid.UUID
) -> RoomCodeState | None:
    """Return the room's current-state row, or None when no row exists yet (D-13)."""
    result = await session.execute(
        select(RoomCodeState).where(RoomCodeState.room_id == room_id)
    )
    return result.scalar_one_or_none()
