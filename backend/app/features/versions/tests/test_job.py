"""Unit: versions job tick orchestration, log contract, failure isolation.

No database: stub sessions, monkeypatched public-surface readers and a
monkeypatched ``job.get_sessionmaker`` (the same seam the integration
conftest uses against the test cluster).
"""
import json
import uuid
from datetime import datetime, timezone

import pytest

from app.shared.logging import configure_logging

BASE_NOW = datetime(2026, 11, 13, 12, 0, 0, tzinfo=timezone.utc)


class _Row:
    def __init__(self, **kw):
        self.__dict__.update(kw)


class _StubResult:
    def __init__(self, rows=(), scalar=None):
        self._rows = list(rows)
        self._scalar = scalar
        self.rowcount = 0

    def all(self):
        return self._rows

    def scalar_one(self):
        return self._scalar


class _StubSession:
    """Minimal AsyncSession stand-in: canned rows, records calls."""

    def __init__(self, rows=(), scalar=None, fail_execute=False, fail_commit=False):
        self._rows = list(rows)
        self._scalar = scalar
        self._fail_execute = fail_execute
        self._fail_commit = fail_commit
        self.executed = []
        self.commit_calls = 0
        self.new = set()
        self.dirty = set()
        self.deleted = set()

    async def execute(self, statement):
        self.executed.append(statement)
        if self._fail_execute:
            raise RuntimeError("db gone")
        return _StubResult(self._rows, self._scalar)

    async def commit(self):
        self.commit_calls += 1
        if self._fail_commit:
            raise RuntimeError("boom")

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


def _ndjson_lines(capsys):
    out = capsys.readouterr().out
    return [json.loads(line) for line in out.splitlines() if line.strip()]


def _patch_readers(monkeypatch, service, states, languages):
    async def _states(session):
        return states

    async def _languages(session):
        return languages

    monkeypatch.setattr(service.live_code_public, "list_current_states", _states)
    monkeypatch.setattr(service.rooms_public, "list_room_languages", _languages)


def _diff_session(versions_rows):
    """Stub session for the tick's diff read (latest_version_hashes)."""
    return _StubSession(rows=versions_rows)


def _patch_sessionmaker(monkeypatch, job, sessions):
    it = iter(sessions)

    def _get_sessionmaker():
        return lambda: next(it)

    monkeypatch.setattr(job, "get_sessionmaker", _get_sessionmaker)


async def test_identical_content_writes_no_insert_and_no_snapshot_line(
    monkeypatch, capsys
):
    configure_logging("INFO")
    from app.features.versions import job, service

    room = uuid.uuid7()
    content = "print('same')\n"
    _patch_readers(
        monkeypatch, service, states={room: content}, languages={room: "python"}
    )
    diff_session = _diff_session([_Row(room_id=room, content=content)])
    _patch_sessionmaker(monkeypatch, job, [diff_session])
    capsys.readouterr()  # flush
    await job.snapshot_tick()

    assert diff_session.commit_calls == 0
    assert [l for l in _ndjson_lines(capsys) if l.get("event") == "snapshot"] == []


async def test_versionless_non_empty_room_produces_first_snapshot(monkeypatch, capsys):
    configure_logging("INFO")
    from app.features.versions import job, service

    room = uuid.uuid7()
    content = "print('first')\n"
    _patch_readers(
        monkeypatch, service, states={room: content}, languages={room: "python"}
    )
    diff_session = _diff_session([])  # no versions yet -> first snapshot (D-05)
    room_session = _StubSession(scalar=_Row(id=uuid.uuid7()))
    _patch_sessionmaker(monkeypatch, job, [diff_session, room_session])
    await job.snapshot_tick()

    assert len(room_session.executed) == 1  # exactly one INSERT
    assert room_session.commit_calls == 1
    lines = [l for l in _ndjson_lines(capsys) if l.get("event") == "snapshot"]
    assert len(lines) == 1
    assert lines[0]["room_id"] == str(room)


async def test_empty_content_is_skipped_and_closed_room_with_changes_inserts(
    monkeypatch, capsys
):
    configure_logging("INFO")
    from app.features.versions import service

    empty_room = uuid.uuid7()
    closed_room = uuid.uuid7()
    _patch_readers(
        monkeypatch,
        service,
        states={empty_room: "", closed_room: "changed in closed room"},
        languages={empty_room: "python", closed_room: "python"},
    )
    session = _StubSession(rows=[])
    changed = await service.collect_changed_rooms(session)

    assert [room_id for room_id, *_ in changed] == [closed_room]


async def test_one_failing_room_logs_snapshot_failed_and_the_next_room_still_inserts(
    monkeypatch, capsys
):
    configure_logging("INFO")
    from app.features.versions import job, service

    room_a = uuid.uuid7()
    room_b = uuid.uuid7()
    _patch_readers(
        monkeypatch,
        service,
        states={room_a: "content-a", room_b: "content-b"},
        languages={room_a: "python", room_b: "python"},
    )
    diff_session = _diff_session([])
    session_a = _StubSession(fail_execute=True)  # room A's INSERT raises
    session_b = _StubSession(scalar=_Row(id=uuid.uuid7()))
    _patch_sessionmaker(monkeypatch, job, [diff_session, session_a, session_b])
    capsys.readouterr()
    await job.snapshot_tick()

    lines = _ndjson_lines(capsys)
    failed = [l for l in lines if l.get("event") == "snapshot_failed"]
    assert len(failed) == 1
    assert failed[0]["room_id"] == str(room_a)
    assert failed[0]["error_type"] == "RuntimeError"
    assert failed[0]["duration_ms"] >= 0
    assert session_b.commit_calls == 1  # room B still inserted
    snapshot_lines = [l for l in lines if l.get("event") == "snapshot"]
    assert [l["room_id"] for l in snapshot_lines] == [str(room_b)]


async def test_diff_read_failure_logs_one_run_level_snapshot_failed_and_returns(
    monkeypatch, capsys
):
    configure_logging("INFO")
    from app.features.versions import job, service

    async def _boom(session):
        raise RuntimeError("db gone")

    monkeypatch.setattr(service.live_code_public, "list_current_states", _boom)
    diff_session = _StubSession()
    _patch_sessionmaker(monkeypatch, job, [diff_session])
    capsys.readouterr()
    await job.snapshot_tick()  # must return normally, not raise

    lines = _ndjson_lines(capsys)
    failed = [l for l in lines if l.get("event") == "snapshot_failed"]
    assert len(failed) == 1
    assert "room_id" not in failed[0]
    assert failed[0]["error_type"] == "RuntimeError"
    assert [l for l in lines if l.get("event") == "snapshot"] == []


async def test_snapshot_line_matches_the_five_key_contract_and_unwinds_contextvars(
    monkeypatch, capsys
):
    configure_logging("INFO")
    import structlog

    from app.features.versions import job, service

    room = uuid.uuid7()
    content = "contract"
    _patch_readers(
        monkeypatch, service, states={room: content}, languages={room: "python"}
    )
    diff_session = _diff_session([])
    room_session = _StubSession(scalar=_Row(id=uuid.uuid7()))
    _patch_sessionmaker(monkeypatch, job, [diff_session, room_session])
    capsys.readouterr()
    await job.snapshot_tick()

    lines = [l for l in _ndjson_lines(capsys) if l.get("event") == "snapshot"]
    assert len(lines) == 1
    line = lines[0]
    assert set(line) == {
        "event",
        "room_id",
        "content_hash",
        "duration_ms",
        "timestamp",
        "level",
        "request_id",
    }
    assert "user_id" not in line
    assert "content" not in line
    assert uuid.UUID(line["request_id"]).version == 7
    assert "request_id" not in structlog.contextvars.get_contextvars()


async def test_purge_runs_on_first_tick_then_skips_when_fresh(monkeypatch, capsys):
    """Test 1 (RED): last_purge is None -> tick calls purge_expired_versions once with the
    run's minted UUIDv7 request_id; a second tick with a fresh last_purge skips the purge."""
    configure_logging("INFO")
    from datetime import timedelta

    from app.features.versions import job, service

    job.last_purge = None  # module-level holder (D-16): reset for isolation
    calls = []

    async def _purge_stub(session, request_id=None, *, now=None):
        calls.append(request_id)
        return 0

    monkeypatch.setattr(service, "purge_expired_versions", _purge_stub)
    _patch_readers(monkeypatch, service, states={}, languages={})  # nothing changed
    diff_one = _diff_session([])
    purge_one = _StubSession()
    _patch_sessionmaker(monkeypatch, job, [diff_one, purge_one])

    capsys.readouterr()
    await job.snapshot_tick(now=BASE_NOW)

    assert len(calls) == 1
    first_request_id = calls[0]
    assert first_request_id is not None and first_request_id.strip()
    assert uuid.UUID(first_request_id).version == 7
    assert job.last_purge == BASE_NOW

    calls.clear()
    job.last_purge = BASE_NOW  # fresh -> next tick must skip the purge
    diff_two = _diff_session([])
    _patch_sessionmaker(monkeypatch, job, [diff_two])
    await job.snapshot_tick(now=BASE_NOW + timedelta(seconds=10))
    assert len(calls) == 0, "fresh last_purge must skip purge"


async def test_failed_purge_is_swallowed_and_tick_completes(monkeypatch, capsys):
    """Test 2 (RED): a purge that raises is swallowed inside the tick; no snapshot_failed line;
    the tick completes normally; last_purge stays None (D-18: a failed purge retries next tick)."""
    configure_logging("INFO")
    from app.features.versions import job, service

    job.last_purge = None  # force purge path
    purge_session = _StubSession()

    async def _raising_purge(session, request_id=None, *, now=None):
        raise RuntimeError("purge db gone")

    monkeypatch.setattr(service, "purge_expired_versions", _raising_purge)
    _patch_readers(monkeypatch, service, states={}, languages={})
    _patch_sessionmaker(monkeypatch, job, [_StubSession(), purge_session])
    capsys.readouterr()
    # must not raise: the failing purge is swallowed (D-18)
    await job.snapshot_tick(now=BASE_NOW)

    failed = [l for l in _ndjson_lines(capsys) if l.get("event") == "snapshot_failed"]
    assert failed == [], "failed purge must not emit snapshot_failed from the job"
    assert job.last_purge is None  # D-18: a swallowed failure must not count as fresh


async def test_failed_purge_retries_on_the_next_tick(monkeypatch, capsys):
    """D-18: a swallowed purge failure leaves last_purge stale, so the next tick calls
    purge_expired_versions again instead of waiting out the full PURGE_INTERVAL."""
    configure_logging("INFO")
    from datetime import timedelta

    from app.features.versions import job, service

    job.last_purge = None
    calls = []

    async def _flaky_purge(session, request_id=None, *, now=None):
        calls.append(request_id)
        if len(calls) == 1:
            raise RuntimeError("purge db gone")
        return 0

    monkeypatch.setattr(service, "purge_expired_versions", _flaky_purge)
    _patch_readers(monkeypatch, service, states={}, languages={})
    _patch_sessionmaker(
        monkeypatch, job, [_StubSession(), _StubSession(), _StubSession(), _StubSession()]
    )
    capsys.readouterr()
    await job.snapshot_tick(now=BASE_NOW)  # purge fails, swallowed

    assert len(calls) == 1
    assert job.last_purge is None  # failure must not stamp cadence state

    calls.clear()
    await job.snapshot_tick(now=BASE_NOW + timedelta(seconds=30))  # retry next tick
    assert len(calls) == 1, "failed purge must retry on the next tick"


async def test_purge_reuses_the_run_minted_request_id(monkeypatch, capsys):
    """Test 3 (RED): the purge call carries the run's minted UUIDv7 request_id (D-17)."""
    configure_logging("INFO")
    from app.features.versions import job, service

    job.last_purge = None
    seen = []

    async def _purge_stub(session, request_id=None, *, now=None):
        seen.append(request_id)
        return 0

    monkeypatch.setattr(service, "purge_expired_versions", _purge_stub)
    _patch_readers(monkeypatch, service, states={}, languages={})
    _patch_sessionmaker(monkeypatch, job, [_StubSession(), _StubSession()])
    await job.snapshot_tick(now=BASE_NOW)

    assert len(seen) == 1
    run_request_id = seen[0]
    assert run_request_id is not None and run_request_id.strip()
    assert uuid.UUID(run_request_id).version == 7
