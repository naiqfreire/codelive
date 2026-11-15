"""Unit: joined-rooms service logic and participant cache invalidation.

No database and no HTTP: the membership contract is stubbed and the session is
a recording fake, so these tests run everywhere (the integration suite covers
the same behavior against Postgres).
"""
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from app.features.membership.models import RoomMember
from app.features.rooms import cache, service
from app.features.rooms.models import Room

NOW = datetime(2026, 11, 14, 12, 0, tzinfo=timezone.utc)


class _User:
    def __init__(self, user_id):
        self.id = user_id


class _Scalars:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return self

    def all(self):
        return self._rows


class _ScalarResult:
    def __init__(self, value):
        self.value = value

    def scalar(self):
        return self.value


class _ListSession:
    def __init__(self, rows):
        self.rows = rows
        self.statements = []

    async def execute(self, stmt):
        self.statements.append(stmt)
        return _Scalars(self.rows)


class _Nested:
    async def __aenter__(self):
        return None

    async def __aexit__(self, *exc):
        return False


def _room(owner_id, code="K7M2QX", language="python", status="active"):
    return Room(
        id=uuid.uuid7(),
        owner_id=owner_id,
        access_code=code,
        language=language,
        status=status,
        created_at=NOW,
        updated_at=NOW,
    )


def _viewer(room_id, user_id, joined_at=NOW):
    return RoomMember(
        id=uuid.uuid7(),
        room_id=room_id,
        user_id=user_id,
        role="viewer",
        is_anonymous=False,
        joined_at=joined_at,
    )


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear_rooms_cache()
    yield
    cache.clear_rooms_cache()


async def test_list_rooms_joined_maps_room_metadata_in_membership_order(monkeypatch):
    user = _User(uuid.uuid7())
    first = _room(uuid.uuid7(), code="AAA111")
    second = _room(uuid.uuid7(), code="BBB222", language="java", status="closed")
    memberships = [_viewer(second.id, user.id), _viewer(first.id, user.id)]
    session = _ListSession([first, second])

    async def fake_memberships(_session, user_id, *, role=None):
        assert user_id == user.id
        assert role == "viewer"
        return memberships

    monkeypatch.setattr(service.membership, "list_memberships_for_user", fake_memberships)

    result = await service.list_rooms_joined(session, user)

    assert [item.id for item in result.items] == [second.id, first.id]
    assert result.items[0].access_code == "BBB222"
    assert result.items[0].language == "java"
    assert result.items[0].status == "closed"
    assert result.items[0].joined_at == NOW
    assert len(session.statements) == 1
    assert "rooms.id IN" in str(session.statements[0])


async def test_list_rooms_joined_returns_cached_payload_without_querying(monkeypatch):
    user = _User(uuid.uuid7())
    room_id = uuid.uuid7()
    cache.set_cached_rooms_joined(
        str(user.id),
        [
            {
                "id": str(room_id),
                "access_code": "K7M2QX",
                "language": "python",
                "status": "active",
                "created_at": NOW.isoformat(),
                "joined_at": NOW.isoformat(),
            }
        ],
    )

    async def exploding(*_args, **_kwargs):
        raise AssertionError("a cache hit must not query memberships")

    monkeypatch.setattr(service.membership, "list_memberships_for_user", exploding)

    result = await service.list_rooms_joined(_ListSession([]), user)

    assert result.items[0].id == room_id
    assert result.items[0].access_code == "K7M2QX"


async def test_list_rooms_joined_skips_memberships_whose_room_is_missing(monkeypatch):
    user = _User(uuid.uuid7())
    memberships = [_viewer(uuid.uuid7(), user.id)]
    session = _ListSession([])

    async def fake_memberships(_session, user_id, *, role=None):
        return memberships

    monkeypatch.setattr(service.membership, "list_memberships_for_user", fake_memberships)

    result = await service.list_rooms_joined(session, user)

    assert result.items == []


async def test_list_rooms_joined_without_memberships_skips_the_room_query(monkeypatch):
    user = _User(uuid.uuid7())
    session = _ListSession([])

    async def fake_memberships(_session, user_id, *, role=None):
        return []

    monkeypatch.setattr(service.membership, "list_memberships_for_user", fake_memberships)

    result = await service.list_rooms_joined(session, user)

    assert result.items == []
    assert session.statements == []


class _CloseSession:
    def __init__(self, room, member_ids):
        self.room = room
        self.member_ids = member_ids
        self.commits = 0
        self.statements = []

    async def get(self, _model, _pk):
        return self.room

    async def commit(self):
        self.commits += 1

    async def execute(self, stmt):
        self.statements.append(stmt)
        return _Scalars(self.member_ids)


async def test_close_room_invalidates_every_participant_cache():
    owner = _User(uuid.uuid7())
    room = _room(owner.id)
    viewer_ids = [uuid.uuid7(), uuid.uuid7()]
    session = _CloseSession(room, viewer_ids)
    for viewer_id in viewer_ids:
        cache.set_cached_rooms_joined(str(viewer_id), [{"id": str(uuid.uuid7())}])

    await service.close_room(session, room.id, owner)

    assert room.status == "closed"
    assert session.commits == 1
    for viewer_id in viewer_ids:
        assert cache.get_cached_rooms_joined(str(viewer_id)) is None
    sql = str(session.statements[0])
    assert "room_members.user_id" in sql
    assert "IS NOT NULL" in sql.upper()


class _RegenerateSession:
    def __init__(self, room):
        self.room = room
        self.commits = 0

    async def get(self, _model, _pk):
        return self.room

    async def execute(self, _stmt):
        return _ScalarResult(False)

    def begin_nested(self):
        return _Nested()

    async def flush(self):
        pass

    async def commit(self):
        self.commits += 1


async def test_regenerate_room_code_invalidates_participant_cache(monkeypatch):
    owner = _User(uuid.uuid7())
    room = _room(owner.id)
    session = _RegenerateSession(room)
    invalidated = AsyncMock()
    monkeypatch.setattr(service, "_invalidate_participants", invalidated)

    await service.regenerate_room_code(session, room.id, owner)

    invalidated.assert_awaited_once_with(session, room.id)
    assert session.commits == 1
    assert len(room.access_code) == 6
