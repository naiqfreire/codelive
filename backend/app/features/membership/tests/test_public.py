"""Unit: membership public contract. No database."""
import inspect
import uuid

from app.features import membership
from app.features.membership.models import RoomMember


def test_public_surface_is_exact():
    public = __import__("app.features.membership.public", fromlist=["x"])
    assert public.__all__ == [
        "RoomMember",
        "create_member",
        "create_owner_member",
        "get_membership",
        "list_memberships_for_user",
    ]


def test_create_owner_member_is_sync_and_commit_free():
    from app.features.membership import public

    assert inspect.iscoroutinefunction(public.create_owner_member) is False
    source = inspect.getsource(public)
    assert ".commit(" not in source
    assert ".rollback(" not in source


def test_create_owner_member_adds_owner_row():
    from app.features.membership.public import create_owner_member

    added = []

    class _Session:
        def add(self, obj):
            added.append(obj)

    room_id = uuid.uuid7()
    user_id = uuid.uuid7()
    member = create_owner_member(_Session(), room_id, user_id)
    assert added == [member]
    assert isinstance(member, RoomMember)
    assert member.room_id == room_id
    assert member.user_id == user_id
    assert member.role == "owner"
    assert member.is_anonymous is False
    assert member.nickname is None


def test_create_member_writes_viewer_row_with_nickname():
    from app.features.membership.public import create_member

    class _Session:
        def add(self, obj):
            pass

    room_id = uuid.uuid7()
    user_id = uuid.uuid7()
    member = create_member(_Session(), room_id, user_id, role="viewer", nickname="Espectador")
    assert member.role == "viewer"
    assert member.nickname == "Espectador"
    assert member.is_anonymous is False


def test_create_member_writes_anonymous_row():
    from app.features.membership.public import create_member

    added = []

    class _Session:
        def add(self, obj):
            added.append(obj)

    room_id = uuid.uuid7()
    member = create_member(
        _Session(),
        room_id,
        None,
        role="viewer",
        nickname="Anônimo",
        is_anonymous=True,
        anonymous_session_id="anon-123",
    )
    assert added == [member]
    assert isinstance(member, RoomMember)
    assert member.room_id == room_id
    assert member.user_id is None
    assert member.anonymous_session_id == "anon-123"
    assert member.is_anonymous is True
    assert member.nickname == "Anônimo"
    assert member.role == "viewer"


def test_list_memberships_for_user_is_async_and_query_only():
    from app.features.membership import public

    assert inspect.iscoroutinefunction(public.list_memberships_for_user) is True
    source = inspect.getsource(public)
    assert ".commit(" not in source
    assert ".rollback(" not in source


def _stub_session(member):
    class _Result:
        def scalars(self):
            return self

        def first(self):
            return member

    class _Session:
        def __init__(self):
            self.statements = []

        async def execute(self, stmt):
            self.statements.append(stmt)
            return _Result()

    return _Session()


async def test_get_membership_by_user_id_returns_row():
    from app.features.membership.public import get_membership

    room_id = uuid.uuid7()
    user_id = uuid.uuid7()
    row = RoomMember(room_id=room_id, user_id=user_id, role="viewer", is_anonymous=False)
    session = _stub_session(row)

    found = await get_membership(session, room_id, user_id=user_id)

    assert found is row
    assert len(session.statements) == 1
    assert "user_id" in str(session.statements[0])


async def test_get_membership_by_anonymous_session_id_returns_row():
    from app.features.membership.public import get_membership

    room_id = uuid.uuid7()
    row = RoomMember(
        room_id=room_id,
        anonymous_session_id="anon-123",
        role="viewer",
        is_anonymous=True,
        nickname="Anônimo",
    )
    session = _stub_session(row)

    found = await get_membership(session, room_id, anonymous_session_id="anon-123")

    assert found is row
    assert len(session.statements) == 1
    assert "anonymous_session_id" in str(session.statements[0])


async def test_get_membership_by_anonymous_session_id_returns_none_when_missing():
    from app.features.membership.public import get_membership

    session = _stub_session(None)

    found = await get_membership(session, uuid.uuid7(), anonymous_session_id="anon-missing")

    assert found is None
    assert len(session.statements) == 1


async def test_get_membership_user_id_wins_over_anonymous_session_id():
    from app.features.membership.public import get_membership

    room_id = uuid.uuid7()
    user_id = uuid.uuid7()
    row = RoomMember(room_id=room_id, user_id=user_id, role="viewer", is_anonymous=False)
    session = _stub_session(row)

    found = await get_membership(
        session, room_id, user_id=user_id, anonymous_session_id="anon-123"
    )

    assert found is row
    where_clause = str(session.statements[0]).split("WHERE", 1)[1]
    assert "user_id" in where_clause
    assert "anonymous_session_id" not in where_clause


async def test_get_membership_without_identity_returns_none_without_querying():
    from app.features.membership.public import get_membership

    class _ExplodingSession:
        async def execute(self, stmt):
            raise AssertionError("no query may be issued without an identity")

    found = await get_membership(_ExplodingSession(), uuid.uuid7())

    assert found is None


def test_get_membership_is_async_and_commit_free():
    from app.features.membership import public

    assert inspect.iscoroutinefunction(public.get_membership) is True
    source = inspect.getsource(public)
    assert ".commit(" not in source
    assert ".rollback(" not in source


def test_membership_does_not_import_other_slices():
    from app.features import membership as m

    assert "app.features.rooms" not in inspect.getsource(m.public)
    assert "app.features.auth" not in inspect.getsource(m.public)
    assert "app.features.rooms" not in inspect.getsource(m.models)
    assert "app.features.auth" not in inspect.getsource(m.models)