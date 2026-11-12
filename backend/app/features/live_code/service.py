"""live_code business logic: current-code state service.

D-01: MAX_CODE_BYTES is a module-level constant (256 KiB, UTF-8 bytes).
D-10: persist_code_update commits before returning; the router broadcasts
only after the commit.
D-13: get-or-create on write — no row yet means the INSERT branch runs.
"""
import hashlib
import uuid
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.live_code.models import RoomCodeState

MAX_CODE_BYTES = 262_144  # 256 KiB measured on the UTF-8 byte length of `content` (D-01)


def content_hash(content: str) -> str:
    """SHA-256 hex of the UTF-8 bytes of `content` (D-09)."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def validate_content_size(content: str) -> int:
    """Return the UTF-8 byte length of `content` (D-01).

    The refusal decision lives in the router (QUAL-03): the service never
    raises for size, it only measures.
    """
    return len(content.encode("utf-8"))


RefusalReason = Literal["not_owner", "room_closed"]


def refusal_reason(role: str, room_status: str | None) -> RefusalReason | None:
    """Authorization decision for an inbound ``code_update`` (D-09/D-12).

    Pure and I/O-free: role and room status in, a reason (or None) out.
    Order (D-09): role is decided before status, so a non-owner never gets
    role-independent feedback. The comparison is ``!= "active"`` rather than
    ``== "closed"`` on purpose: the column is constrained to ``active|closed``,
    so the only other reachable input is ``None`` — a vanished row — which
    must fail closed as ``room_closed``; likewise any unknown value fails
    closed instead of being writable.
    """
    if role != "owner":
        return "not_owner"
    if room_status != "active":
        return "room_closed"
    return None


async def read_current_state(
    session: AsyncSession, room_id: uuid.UUID
) -> RoomCodeState | None:
    """Return the room's current-state row, or None when no row exists yet (D-13)."""
    result = await session.execute(
        select(RoomCodeState).where(RoomCodeState.room_id == room_id)
    )
    return result.scalar_one_or_none()


async def persist_code_update(
    session: AsyncSession, room_id: uuid.UUID, content: str
) -> RoomCodeState:
    """Upsert the room's current state (D-08/D-13) and commit.

    `INSERT ... ON CONFLICT (room_id) DO UPDATE SET content, updated_at` is
    the single source of truth for writes: atomic, one round-trip, safe for
    the single owner. Commits before returning so the caller can broadcast
    only after the commit (D-10).
    """
    stmt = (
        insert(RoomCodeState)
        .values(room_id=room_id, content=content)
        .on_conflict_do_update(
            index_elements=["room_id"],
            set_={"content": content, "updated_at": func.now()},
        )
        .returning(RoomCodeState)
    )
    result = await session.execute(stmt)
    state = result.scalar_one()
    await session.commit()
    # The identity map may hand back a stale instance for the ON CONFLICT
    # UPDATE branch; reload it so callers always see the committed row.
    await session.refresh(state)
    return state
