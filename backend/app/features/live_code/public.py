"""Cross-slice live_code contract — the ONLY module other slices may import."""
import hashlib
import uuid

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.live_code import protocol
from app.features.live_code.hub import hub
from app.features.live_code.models import RoomCodeState

__all__ = ["broadcast_snapshot", "list_current_states", "write_current_state"]


async def list_current_states(session: AsyncSession) -> dict[uuid.UUID, str]:
    """Return ``{room_id: content}`` for every ``room_code_state`` row.

    Read-only and commit-free; the caller injects the session. A
    column-level select is deliberate: one bulk read, no joined SQL
    (D-19: the versions slice compares hashes in Python).
    """
    result = await session.execute(select(RoomCodeState.room_id, RoomCodeState.content))
    return {row.room_id: row.content for row in result.all()}


async def write_current_state(
    session: AsyncSession, room_id: uuid.UUID, content: str
) -> RoomCodeState:
    """Upsert the room's current state WITHOUT committing (VERS-05).

    No-commit sibling of ``live_code.service.persist_code_update``: the
    restore path runs this upsert and the version insert on ONE session and
    commits once, so the caller owns the transaction boundary. The
    ``INSERT ... ON CONFLICT (room_id) DO UPDATE`` idiom is identical to the
    service's writer — the same atomic upsert, just not committed here.
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
    return result.scalar_one()


async def broadcast_snapshot(room_id: uuid.UUID, content: str, language: str) -> None:
    """Broadcast the existing ``snapshot`` frame to every joined socket.

    Session-free on purpose (D-06): the hub is process memory, and the frame
    is built per recipient from its own ``request_id``. Called only AFTER the
    restore's commit — a rolled-back write must never be promised on the wire.
    """
    content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
    await hub.broadcast(
        room_id,
        lambda recipient: protocol.snapshot_frame(
            room_id, content, language, content_hash, recipient.request_id
        ),
    )
