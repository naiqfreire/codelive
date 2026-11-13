"""Unit: versions slice service contract without a database."""
import json
import uuid
from datetime import datetime, timezone

import pytest

from app.shared.logging import configure_logging

BASE_NOW = datetime(2026, 11, 13, 12, 0, 0, tzinfo=timezone.utc)


class _StubResult:
    def __init__(self, rowcount: int):
        self.rowcount = rowcount


class _StubSession:
    """Minimal AsyncSession stand-in: returns a fixed rowcount, records calls."""

    def __init__(self, rowcount: int = 0, fail_commit: bool = False):
        self._rowcount = rowcount
        self._fail_commit = fail_commit
        self.executed = []
        self.commit_calls = 0

    async def execute(self, statement):
        self.executed.append(statement)
        return _StubResult(self._rowcount)

    async def commit(self):
        self.commit_calls += 1
        if self._fail_commit:
            raise RuntimeError("boom")


def _ndjson_lines(capsys):
    out = capsys.readouterr().out
    return [json.loads(line) for line in out.splitlines() if line.strip()]


async def test_purge_tracer_path(capsys):
    configure_logging("INFO")
    from app.features.versions import service

    session = _StubSession(rowcount=0)
    deleted = await service.purge_expired_versions(session, now=BASE_NOW)

    assert deleted == 0
    lines = [l for l in _ndjson_lines(capsys) if l.get("event") == "versions_purged"]
    assert len(lines) == 1
    line = lines[0]
    assert line["deleted_count"] == 0
    assert line["duration_ms"] >= 0
    assert uuid.UUID(line["request_id"]).version == 7
    assert "content" not in line
    assert "room_id" not in line
    assert "user_id" not in line


def test_slice_has_no_update_path():
    """D-04: no code path in the slice updates a version row."""
    from pathlib import Path

    from app.features.versions.models import CodeVersion

    slice_dir = Path(__file__).resolve().parent.parent
    for name in ("service.py", "models.py"):
        source = (slice_dir / name).read_text(encoding="utf-8")
        assert "update(" not in source, f"{name} contains an update statement"
        assert "onupdate=" not in source, f"{name} declares onupdate"
    for column in CodeVersion.__mapper__.columns:
        assert column.onupdate is None


async def test_purge_logs_once_with_counts(capsys):
    configure_logging("INFO")
    from app.features.versions import service

    session = _StubSession(rowcount=5)
    deleted = await service.purge_expired_versions(session, now=BASE_NOW)

    assert deleted == 5
    lines = [l for l in _ndjson_lines(capsys) if l.get("event") == "versions_purged"]
    assert len(lines) == 1
    assert lines[0]["deleted_count"] == 5
    assert lines[0]["duration_ms"] >= 0
    assert uuid.UUID(lines[0]["request_id"]).version == 7


async def test_purge_binds_and_releases_request_id(capsys):
    configure_logging("INFO")
    import structlog

    from app.features.versions import service

    seen = []

    class _ContextProbeSession(_StubSession):
        async def execute(self, statement):
            seen.append(structlog.contextvars.get_contextvars().get("request_id"))
            return await super().execute(statement)

    session = _ContextProbeSession(rowcount=0)
    await service.purge_expired_versions(session, request_id="caller-rid-123", now=BASE_NOW)

    assert seen == ["caller-rid-123"]
    lines = [l for l in _ndjson_lines(capsys) if l.get("event") == "versions_purged"]
    assert lines[0]["request_id"] == "caller-rid-123"
    assert "request_id" not in structlog.contextvars.get_contextvars()


async def test_purge_returns_rowcount(capsys):
    configure_logging("INFO")
    from app.features.versions import service

    session = _StubSession(rowcount=7)
    assert await service.purge_expired_versions(session, now=BASE_NOW) == 7
    assert session.commit_calls == 1


async def test_no_log_when_commit_fails(capsys):
    configure_logging("INFO")
    from app.features.versions import service

    session = _StubSession(rowcount=3, fail_commit=True)
    with pytest.raises(RuntimeError):
        await service.purge_expired_versions(session, now=BASE_NOW)

    lines = [l for l in _ndjson_lines(capsys) if l.get("event") == "versions_purged"]
    assert lines == []
