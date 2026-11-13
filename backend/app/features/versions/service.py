"""versions business logic: 30-day retention (SPEC §6, VERS-06).

D-01: retention is a plain callable — no scheduler, no CLI, no HTTP route.
D-03: every run emits exactly one ``versions_purged`` line at info, including
zero-deletion runs. D-12: the run mints its own UUIDv7 ``request_id``.
"""
import time
import uuid
from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.versions.models import CodeVersion

RETENTION_DAYS = 30  # D-08: strictly older than 30 days
log = structlog.get_logger()


def retention_cutoff(now: datetime | None = None) -> datetime:
    """Rows with created_at strictly before this instant are expired (D-08)."""
    return (now or datetime.now(timezone.utc)) - timedelta(days=RETENTION_DAYS)


def retention_statement(cutoff: datetime):
    """DELETE expired rows except the newest (created_at, id) of each room (D-07)."""
    newest_per_room = (
        select(CodeVersion.id)
        .ext(distinct_on(CodeVersion.room_id))
        .order_by(
            CodeVersion.room_id,
            CodeVersion.created_at.desc(),
            CodeVersion.id.desc(),
        )
    )
    return delete(CodeVersion).where(
        CodeVersion.created_at < cutoff,
        CodeVersion.id.not_in(newest_per_room),
    )


async def purge_expired_versions(
    session: AsyncSession,
    request_id: str | None = None,
    *,
    now: datetime | None = None,
) -> int:
    """Delete expired versions, keep the newest per room, log once, commit once.

    Commits before logging (D-03): a failed commit emits no success line.
    """
    started = time.perf_counter()
    run_id = request_id or str(uuid.uuid7())  # D-12
    cutoff = retention_cutoff(now)
    with structlog.contextvars.bound_contextvars(request_id=run_id):
        result = await session.execute(retention_statement(cutoff))
        deleted_count = result.rowcount
        await session.commit()
        duration_ms = round((time.perf_counter() - started) * 1000, 3)
        log.info(
            "versions_purged",
            deleted_count=deleted_count,
            duration_ms=duration_ms,
        )
    return deleted_count
