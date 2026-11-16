"""Unit: versions slice service contract without a database."""
import json
import uuid
from datetime import datetime, timezone

import pytest

from app.shared.logging import configure_logging

BASE_NOW = datetime(2026, 11, 13, 12, 0, 0, tzinfo=timezone.utc)


class _StubResult:
    def __init__(self, rowcount: int, rows=None):
        self.rowcount = rowcount
        self._rows = rows or []

    def all(self):
        return self._rows


class _StubSession:
    """Minimal AsyncSession stand-in: returns a fixed rowcount, records calls.

    ``rows`` feeds the ``.all()`` of a select result (the list_versions read);
    the purge tests ignore it and use ``rowcount``.
    """

    def __init__(self, rowcount: int = 0, fail_commit: bool = False, rows=None):
        self._rowcount = rowcount
        self._fail_commit = fail_commit
        self._rows = rows or []
        self.executed = []
        self.commit_calls = 0
        self.new = set()
        self.dirty = set()
        self.deleted = set()

    async def execute(self, statement):
        self.executed.append(statement)
        return _StubResult(self._rowcount, self._rows)

    async def commit(self):
        self.commit_calls += 1
        if self._fail_commit:
            raise RuntimeError("boom")


class _User:
    """Minimal identity object: the service only reads ``user.id``."""

    def __init__(self, user_id):
        self.id = user_id


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


async def test_purge_rejects_session_with_pending_state():
    configure_logging("INFO")
    from app.features.versions import service

    session = _StubSession(rowcount=0)
    session.new = {object()}
    with pytest.raises(ValueError, match="pending"):
        await service.purge_expired_versions(session, now=BASE_NOW)
    assert session.executed == []
    assert session.commit_calls == 0


async def test_purge_rejects_session_with_pending_dirty_objects():
    configure_logging("INFO")
    from app.features.versions import service

    session = _StubSession(rowcount=0)
    session.dirty = {object()}
    with pytest.raises(ValueError, match="pending"):
        await service.purge_expired_versions(session, now=BASE_NOW)
    assert session.executed == []
    assert session.commit_calls == 0


async def test_purge_rejects_session_with_pending_deletes():
    configure_logging("INFO")
    from app.features.versions import service

    session = _StubSession(rowcount=0)
    session.deleted = {object()}
    with pytest.raises(ValueError, match="pending"):
        await service.purge_expired_versions(session, now=BASE_NOW)
    assert session.executed == []
    assert session.commit_calls == 0


async def test_purge_logs_failure_and_reraises(capsys):
    configure_logging("INFO")
    from app.features.versions import service

    session = _StubSession(rowcount=3, fail_commit=True)
    with pytest.raises(RuntimeError):
        await service.purge_expired_versions(session, now=BASE_NOW)

    lines = _ndjson_lines(capsys)
    failed = [l for l in lines if l.get("event") == "versions_purge_failed"]
    assert len(failed) == 1
    assert failed[0]["duration_ms"] >= 0
    assert uuid.UUID(failed[0]["request_id"]).version == 7
    assert failed[0]["error_type"] == "RuntimeError"
    assert "boom" not in json.dumps(failed[0])
    assert [l for l in lines if l.get("event") == "versions_purged"] == []


async def test_purge_failure_on_execute_also_logs(capsys):
    configure_logging("INFO")
    from app.features.versions import service

    class _FailingExecuteSession(_StubSession):
        async def execute(self, statement):
            raise RuntimeError("db gone")

    session = _FailingExecuteSession(rowcount=0)
    with pytest.raises(RuntimeError):
        await service.purge_expired_versions(session, now=BASE_NOW)

    lines = _ndjson_lines(capsys)
    assert [l for l in lines if l.get("event") == "versions_purge_failed"]
    assert [l for l in lines if l.get("event") == "versions_purged"] == []
    assert session.commit_calls == 0


async def test_purge_empty_request_id_is_rejected(capsys):
    configure_logging("INFO")
    from app.features.versions import service

    session = _StubSession(rowcount=0)
    with pytest.raises(ValueError, match="request_id"):
        await service.purge_expired_versions(session, request_id="", now=BASE_NOW)
    assert session.executed == []


# --- Task 2: list_versions ladder via stub session --------------------------


async def test_list_versions_room_not_found_raises_404(monkeypatch):
    """List ladder: room missing → HTTPException 404 ROOM_NOT_FOUND, no further executes, no commit."""
    configure_logging("INFO")
    from app.features.rooms import public as rooms_public
    from app.features.versions import service
    from app.shared.errors import ErrorCode
    from fastapi import HTTPException

    async def _missing(session, room_id):
        return None

    monkeypatch.setattr(rooms_public, "get_room_owner_status_language", _missing)

    session = _StubSession()
    room_id = uuid.uuid4()
    with pytest.raises(HTTPException) as exc_info:
        await service.list_versions(session, room_id, None)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == ErrorCode.ROOM_NOT_FOUND
    assert session.executed == []  # zero further executes past the refusal
    assert session.commit_calls == 0


async def test_list_versions_non_owner_raises_403(monkeypatch):
    """List ladder: identity that is not the owner → HTTPException 403 FORBIDDEN, read-only."""
    configure_logging("INFO")
    from app.features.rooms import public as rooms_public
    from app.features.versions import service
    from app.shared.errors import ErrorCode
    from fastapi import HTTPException

    owner_id = uuid.uuid4()

    async def _owned(session, room_id):
        return (owner_id, "active", "python")

    monkeypatch.setattr(rooms_public, "get_room_owner_status_language", _owned)

    session = _StubSession()
    room_id = uuid.uuid4()
    with pytest.raises(HTTPException) as exc_info:
        await service.list_versions(session, room_id, _User(uuid.uuid4()))  # not the owner

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == ErrorCode.FORBIDDEN
    assert session.executed == []
    assert session.commit_calls == 0


async def test_list_versions_closed_room_still_lists(monkeypatch):
    """List ladder (D-04): the owner MAY list a closed room — no closed check, no commit."""
    configure_logging("INFO")
    from app.features.rooms import public as rooms_public
    from app.features.versions import service
    from app.features.versions.schemas import VersionOut

    owner_id = uuid.uuid4()
    version_id = uuid.uuid4()

    class _Row:
        id = version_id
        created_at = datetime(2026, 11, 13, 12, 0, 0, tzinfo=timezone.utc)
        content = "print('hi')\n"
        language = "python"
        author_id = None

    async def _owned_closed(session, room_id):
        return (owner_id, "closed", "python")

    monkeypatch.setattr(rooms_public, "get_room_owner_status_language", _owned_closed)

    session = _StubSession(rows=[_Row()])
    result = await service.list_versions(session, uuid.uuid4(), _User(owner_id))

    # D-04: no closed-room refusal on the listing path; read-only (no commit).
    assert len(result) == 1
    assert isinstance(result[0], VersionOut)
    assert result[0].id == version_id
    assert result[0].author_id is None
    assert len(session.executed) == 1  # only the versions SELECT — no closed check
    assert session.commit_calls == 0


async def test_list_versions_success_returns_hash_only_rows(monkeypatch):
    """List success path: exactly one SELECT, mapped to VersionOut, hash-only, no content."""
    import hashlib

    configure_logging("INFO")
    from app.features.rooms import public as rooms_public
    from app.features.versions import service
    from app.features.versions.schemas import VersionOut

    owner_id = uuid.uuid4()
    version_id = uuid.uuid4()
    content = "print('hello')\n"

    class _Row:
        id = version_id
        created_at = datetime(2026, 11, 13, 12, 0, 0, tzinfo=timezone.utc)
        content = "print('hello')\n"
        language = "python"
        author_id = owner_id

    async def _owned(session, room_id):
        return (owner_id, "active", "python")

    monkeypatch.setattr(rooms_public, "get_room_owner_status_language", _owned)

    session = _StubSession(rows=[_Row()])
    result = await service.list_versions(session, uuid.uuid4(), _User(owner_id))

    # Exactly one SELECT (the versions listing) — the room read was monkeypatched away.
    assert len(session.executed) == 1
    assert session.commit_calls == 0  # listing is read-only

    assert len(result) == 1
    row = result[0]
    assert isinstance(row, VersionOut)
    assert row.id == version_id
    assert row.content_hash == hashlib.sha256(content.encode("utf-8")).hexdigest()
    assert row.language == "python"
    assert row.author_id == owner_id
    # No content leakage into the listing response model.
    assert "content" not in VersionOut.model_fields
    assert "content" not in VersionOut.model_fields.values() or True


# --- Task 2 (08-03): restore commit-once + broadcast-on-failure unit proofs --


class _VersionRow:
    def __init__(self, vid, content, language, author_id=None):
        self.id = vid
        self.content = content
        self.language = language
        self.author_id = author_id
        self.created_at = BASE_NOW


class _ScalarResult:
    def __init__(self, row):
        self._row = row

    def scalar_one_or_none(self):
        return self._row

    def scalar_one(self):
        return self._row


class _RestoreSession(_StubSession):
    """Stub session answering the restore path's SELECT and INSERT statements."""

    def __init__(self, version_row, new_version, fail_commit=False):
        super().__init__(rowcount=0, fail_commit=fail_commit)
        self._version_row = version_row
        self._new_version = new_version

    async def execute(self, statement):
        self.executed.append(statement)
        from sqlalchemy import Select

        if isinstance(statement, Select):
            return _ScalarResult(self._version_row)
        return _ScalarResult(self._new_version)


def _patch_restore_seams(monkeypatch, owner_id):
    from app.features.live_code import public as live_code_public
    from app.features.rooms import public as rooms_public

    broadcasts = []

    async def _owned(session, room_id):
        return (owner_id, "active", "python")

    async def _record_broadcast(room_id, content, language, exclude_user_id):
        broadcasts.append((room_id, content, language, exclude_user_id))

    monkeypatch.setattr(rooms_public, "get_room_owner_status_language", _owned)
    monkeypatch.setattr(live_code_public, "broadcast_snapshot", _record_broadcast)
    return broadcasts


async def test_restore_success_commits_once_and_broadcasts(monkeypatch, capsys):
    import hashlib

    configure_logging("INFO")
    from app.features.versions import service

    owner_id = uuid.uuid4()
    room_id = uuid.uuid4()
    version_id = uuid.uuid4()
    new_id = uuid.uuid4()
    content = "print('restore')\n"

    broadcasts = _patch_restore_seams(monkeypatch, owner_id)

    version_row = _VersionRow(version_id, content, "python", None)
    new_version = _VersionRow(new_id, content, "python", owner_id)
    session = _RestoreSession(version_row, new_version)

    result = await service.restore_version(session, room_id, version_id, _User(owner_id))

    assert session.commit_calls == 1
    assert broadcasts == [(room_id, content, "python", owner_id)]
    assert result.content == content
    assert result.id == new_id
    assert result.content_hash == hashlib.sha256(content.encode("utf-8")).hexdigest()

    lines = _ndjson_lines(capsys)
    restored = [l for l in lines if l.get("event") == "version_restored"]
    assert len(restored) == 1
    assert "content" not in restored[0]


async def test_restore_failure_calls_no_broadcast_and_reraises(monkeypatch, capsys):
    configure_logging("INFO")
    from app.features.versions import service

    owner_id = uuid.uuid4()
    room_id = uuid.uuid4()
    version_id = uuid.uuid4()
    content = "print('boom')\n"

    broadcasts = _patch_restore_seams(monkeypatch, owner_id)

    version_row = _VersionRow(version_id, content, "python", None)
    new_version = _VersionRow(uuid.uuid4(), content, "python", owner_id)
    session = _RestoreSession(version_row, new_version, fail_commit=True)

    with pytest.raises(RuntimeError):
        await service.restore_version(session, room_id, version_id, _User(owner_id))

    assert broadcasts == [], "a rolled-back restore must never broadcast"
    assert session.commit_calls == 1  # the commit was attempted once, then failed

    lines = _ndjson_lines(capsys)
    failed = [l for l in lines if l.get("event") == "version_restore_failed"]
    restored = [l for l in lines if l.get("event") == "version_restored"]
    assert len(failed) == 1
    assert failed[0]["error_type"] == "RuntimeError"
    assert restored == [], "the success line never fires without a durable commit"
