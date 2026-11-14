"""versions business logic: 30-day retention (SPEC §6, VERS-06).

D-01: retention is a plain callable — no scheduler, no CLI, no HTTP route.
D-03: every committed run emits exactly one ``versions_purged`` line at info;
runs that fail before the commit emit exactly one ``versions_purge_failed``
error line instead, so a crashing run is never indistinguishable from a
never-scheduled one. D-12: the run mints its own UUIDv7 ``request_id``.

Session-ownership contract: the caller must pass a dedicated session that
holds no other pending state. ``purge_expired_versions`` commits that session,
so callers stage nothing else on it (Phase 7's job constructs a fresh session
per run). A session with pending inserts/updates/deletes is rejected with
``ValueError`` before any SQL executes.
"""
import time
import uuid
from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import Delete, delete, select
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.versions.models import CodeVersion

RETENTION_DAYS = 30  # D-08: strictly older than 30 days
log = structlog.get_logger()


def retention_cutoff(now: datetime | None = None) -> datetime:
    """Rows with created_at strictly before this instant are expired (D-08)."""
    return (now or datetime.now(timezone.utc)) - timedelta(days=RETENTION_DAYS)


def retention_statement(cutoff: datetime) -> Delete:
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


def _pending_state(session: AsyncSession) -> bool:
    """True when the session holds ORM objects pending persistence."""
    return any(
        len(getattr(session, attr, ()) or ()) > 0
        for attr in ("new", "dirty", "deleted")
    )


async def purge_expired_versions(
    session: AsyncSession,
    request_id: str | None = None,
    *,
    now: datetime | None = None,
) -> int:
    """Delete expired versions, keep the newest per room, log once, commit once.

    The caller must pass a dedicated session with no other pending state;
    such sessions are rejected with ``ValueError`` before any SQL runs.
    Commits before logging (D-03): a failed commit emits no success line.
    """
    started = time.perf_counter()
    if _pending_state(session):
        raise ValueError(
            "purge_expired_versions requires a dedicated session with no pending state"
        )
    if request_id is None:
        run_id = str(uuid.uuid7())  # D-12
    elif not request_id.strip():
        raise ValueError("request_id must be a non-empty string or None")
    else:
        run_id = request_id
    cutoff = retention_cutoff(now)
    with structlog.contextvars.bound_contextvars(request_id=run_id):
        try:
            result = await session.execute(retention_statement(cutoff))
            deleted_count = result.rowcount
            await session.commit()
        except Exception as exc:
            duration_ms = round((time.perf_counter() - started) * 1000, 3)
            log.error(
                "versions_purge_failed",
                duration_ms=duration_ms,
                error_type=type(exc).__name__,
            )
            raise
        duration_ms = round((time.perf_counter() - started) * 1000, 3)
        log.info(
            "versions_purged",
            deleted_count=deleted_count,
            duration_ms=duration_ms,
        )
    return deleted_count
