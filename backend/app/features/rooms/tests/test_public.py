"""Unit: rooms public contract. No database."""
import inspect
import uuid

import pytest
from fastapi import HTTPException

from app.features.membership.models import RoomMember
from app.features.rooms.models import Room
from app.shared.errors import ErrorCode


class _User:
    def __init__(self, user_id):
        self.id = user_id


def _room(status="active", owner_id=None):
    return Room(
        id=uuid.uuid7(),
        owner_id=owner_id or uuid.uuid7(),
        access_code="ABC123",
        language="python",
        status=status,
    )


def _stub_session(room, member):
    class _Result:
        def scalars(self):
            return self

        def first(self):
            return member

    class _Session:
        def __init__(self):
            self.statements = []
            self.gets = []

        async def get(self, model, pk):
            self.gets.append((model, pk))
            return room

        async def execute(self, stmt):
            self.statements.append(stmt)
            return _Result()

    return _Session()


def _status_session(value):
    class _Result:
        def scalar_one_or_none(self):
            return value

    class _Session:
        def __init__(self):
            self.statements = []

        async def execute(self, stmt):
            self.statements.append(stmt)
            return _Result()

    return _Session()


def _viewer_row(room_id, user_id=None, anonymous_session_id=None):
    return RoomMember(
        room_id=room_id,
        user_id=user_id,
        anonymous_session_id=anonymous_session_id,
        role="viewer",
        is_anonymous=user_id is None,
        nickname=None if user_id is not None else "Anônimo",
    )


def test_public_surface_is_exact():
    public = __import__("app.features.rooms.public", fromlist=["x"])
    assert public.__all__ == ["authorize_room_identity", "get_room_status"]


def test_rooms_public_does_not_import_other_slices():
    from app.features import rooms as r

    source = inspect.getsource(r.public)
    assert "app.features.live_code" not in source
    assert "app.features.membership.models" not in source


def test_rooms_public_is_commit_free():
    from app.features import rooms as r

    source = inspect.getsource(r.public)
    assert ".commit(" not in source
    assert ".rollback(" not in source


async def test_room_status_returns_active():
    from app.features.rooms import public

    session = _status_session("active")
    room_id = uuid.uuid7()

    status = await public.get_room_status(session, room_id)

    assert status == "active"
    assert len(session.statements) == 1


async def test_room_status_returns_closed():
    from app.features.rooms import public

    session = _status_session("closed")
    room_id = uuid.uuid7()

    status = await public.get_room_status(session, room_id)

    assert status == "closed"
    assert len(session.statements) == 1


async def test_unknown_room_status_is_none():
    from app.features.rooms import public

    session = _status_session(None)
    room_id = uuid.uuid7()

    status = await public.get_room_status(session, room_id)

    assert status is None
    assert len(session.statements) == 1


async def test_unknown_room_raises_404_room_not_found():
    from app.features.rooms.public import authorize_room_identity

    session = _stub_session(room=None, member=None)
    with pytest.raises(HTTPException) as exc:
        await authorize_room_identity(session, uuid.uuid7(), _User(uuid.uuid7()), None)
    assert exc.value.status_code == 404
    assert exc.value.detail == ErrorCode.ROOM_NOT_FOUND
    assert session.statements == []


async def test_closed_room_raises_409_room_closed():
    from app.features.rooms.public import authorize_room_identity

    room = _room(status="closed")
    session = _stub_session(room=room, member=None)
    with pytest.raises(HTTPException) as exc:
        await authorize_room_identity(session, room.id, _User(room.owner_id), None)
    assert exc.value.status_code == 409
    assert exc.value.detail == ErrorCode.ROOM_CLOSED
    assert session.statements == []


async def test_owner_gets_owner_role():
    from app.features.rooms.public import authorize_room_identity

    owner_id = uuid.uuid7()
    room = _room(owner_id=owner_id)
    member = RoomMember(
        room_id=room.id, user_id=owner_id, role="owner", is_anonymous=False
    )
    session = _stub_session(room=room, member=member)

    found_room, role = await authorize_room_identity(
        session, room.id, _User(owner_id), None
    )

    assert found_room is room
    assert role == "owner"


async def test_authenticated_non_owner_with_viewer_row_gets_viewer():
    from app.features.rooms.public import authorize_room_identity

    room = _room()
    viewer_id = uuid.uuid7()
    member = _viewer_row(room.id, user_id=viewer_id)
    session = _stub_session(room=room, member=member)

    found_room, role = await authorize_room_identity(
        session, room.id, _User(viewer_id), None
    )

    assert found_room is room
    assert role == "viewer"


async def test_no_identity_at_all_raises_403_forbidden():
    from app.features.rooms.public import authorize_room_identity

    room = _room()
    session = _stub_session(room=room, member=None)

    with pytest.raises(HTTPException) as exc:
        await authorize_room_identity(session, room.id, None, None)

    assert exc.value.status_code == 403
    assert exc.value.detail == ErrorCode.FORBIDDEN
    assert session.statements == []


async def test_identity_without_membership_row_raises_403_forbidden():
    from app.features.rooms.public import authorize_room_identity

    room = _room()
    session = _stub_session(room=room, member=None)

    with pytest.raises(HTTPException) as exc:
        await authorize_room_identity(session, room.id, _User(uuid.uuid7()), None)

    assert exc.value.status_code == 403
    assert exc.value.detail == ErrorCode.FORBIDDEN


async def test_anonymous_identity_with_viewer_row_gets_viewer():
    from app.features.rooms.public import authorize_room_identity

    room = _room()
    member = _viewer_row(room.id, anonymous_session_id="anon-123")
    session = _stub_session(room=room, member=member)

    found_room, role = await authorize_room_identity(session, room.id, None, "anon-123")

    assert found_room is room
    assert role == "viewer"
