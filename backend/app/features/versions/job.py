"""versions job: the 30-second snapshot tick loop (SPEC RNF06, Taiga #39).

D-01: in-process asyncio loop owned by the FastAPI lifespan — tick-first,
then sleep for ``SNAPSHOT_INTERVAL_SECONDS``; cancelled on shutdown.
D-02: the cadence is a module constant, never an env var.
D-03: the loop lives here; the diff/insert logic lives in ``service.py``.
D-12: one UUIDv7 ``request_id`` per tick, bound through structlog contextvars.
D-13/D-14: per-room try/except with a fresh session per room.
D-15: a failed diff SELECT logs one run-level ``snapshot_failed`` without
``room_id`` and the tick returns normally — the loop stays alive.
D-16: daily retention purge runs inside the same tick loop via an in-memory
``last_purge`` timestamp; ``None`` means stale so the first tick after startup
purges.
D-17: the purge call reuses the run's minted ``request_id`` so the tick's
``snapshot`` lines and the ``versions_purged`` line correlate under one id.
D-18: a failing purge is swallowed inside the tick (Phase 6's service already
logs ``versions_purge_failed`` and re-raises); the tick continues and
``last_purge`` is stamped only after a SUCCESSFUL call, so a swallowed
failure retries next tick.
"""
import asyncio
import time
import uuid
from datetime import datetime, timedelta, timezone

import structlog

from app.features.versions import service
from app.shared.database import get_sessionmaker  # module top level: conftest seam

SNAPSHOT_INTERVAL_SECONDS = 30  # D-02: module constant, not an env var
PURGE_INTERVAL = timedelta(days=1)  # D-16: 24h sliding window (Assumption A5)
log = structlog.get_logger()
last_purge: datetime | None = None  # D-16: staleness state; None = first tick purges


async def _maybe_run_purge(run_id: str, now: datetime) -> None:
    """Run the daily retention purge when ``last_purge`` is stale (D-16/D-17/D-18).

    Returns early when ``last_purge`` is not None and less than ``PURGE_INTERVAL``
    ago. Otherwise opens a fresh session, calls ``service.purge_expired_versions``
    inside its own try/except that swallows every Exception (D-18: the Phase 6
    service already logs ``versions_purge_failed`` at error and re-raises — do NOT
    log a second failure line here), and sets ``last_purge = now`` only after a
    SUCCESSFUL call — a swallowed failure leaves ``last_purge`` stale, so the next
    tick retries the purge.
    """
    global last_purge
    if last_purge is not None and now - last_purge < PURGE_INTERVAL:
        return
    try:
        async with get_sessionmaker()() as session:
            await service.purge_expired_versions(session, request_id=run_id, now=now)
    except Exception:
        # D-18: the Phase 6 service already logged versions_purge_failed and
        # re-raised; swallow here so the snapshot tick continues. Do NOT log a
        # second failure line — the service's line is the single source of truth.
        # Cadence state stays stale (no ``last_purge`` stamp) so the failed
        # purge is retried on the next tick.
        return
    else:
        last_purge = now


async def snapshot_tick(now: datetime | None = None) -> None:
    """One snapshot tick: diff via public surfaces, insert per changed room.

    ``now`` exists only for tests; production always passes None and the tick
    mints its own time base. The run-level request_id is bound before any SQL
    so every line of the tick correlates under one id (D-12).
    """
    now = now or datetime.now(timezone.utc)
    run_id = str(uuid.uuid7())  # D-12: never uuid4 (shared/middleware.new_request_id)
    with structlog.contextvars.bound_contextvars(request_id=run_id):
        started = time.perf_counter()
        try:
            async with get_sessionmaker()() as session:
                changed = await service.collect_changed_rooms(session)
        except Exception as exc:
            # D-15: run-level failure — one line, no room_id key, tick returns.
            log.error(
                "snapshot_failed",
                error_type=type(exc).__name__,
                duration_ms=round((time.perf_counter() - started) * 1000, 3),
            )
            return
        for room_id, content, language, content_hash in changed:
            started = time.perf_counter()
            try:
                # D-14: fresh session per room; a failure never contaminates
                # other rooms and no cross-room transaction exists.
                async with get_sessionmaker()() as session:
                    await service.create_version(session, room_id, content, language)
            except Exception as exc:
                # D-13/D-10: per-room failure isolation; log and continue.
                log.error(
                    "snapshot_failed",
                    room_id=str(room_id),
                    error_type=type(exc).__name__,
                    duration_ms=round((time.perf_counter() - started) * 1000, 3),
                )
                continue
            # D-09/D-11: exactly one snapshot info line per written version.
            log.info(
                "snapshot",
                room_id=str(room_id),
                content_hash=content_hash,
                duration_ms=round((time.perf_counter() - started) * 1000, 3),
            )
        # D-16/D-17/D-18: daily retention purge on the same scheduler, inside
        # the bound_contextvars block so the versions_purged line carries the
        # run's request_id.
        await _maybe_run_purge(run_id, now)


async def run_forever() -> None:
    """Tick-first loop: the first tick runs immediately at startup (D-01)."""
    while True:
        await snapshot_tick()
        await asyncio.sleep(SNAPSHOT_INTERVAL_SECONDS)
