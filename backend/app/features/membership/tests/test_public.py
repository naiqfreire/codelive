"""Unit: membership public contract. No database."""
import inspect
import uuid

from app.features import membership
from app.features.membership.models import RoomMember


def test_public_surface_is_exact():
    public = __import__("app.features.membership.public", fromlist=["x"])
    assert public.__all__ == ["RoomMember", "create_owner_member"]


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


def test_membership_does_not_import_other_slices():
    from app.features import membership as m

    assert "app.features.rooms" not in inspect.getsource(m.public)
    assert "app.features.auth" not in inspect.getsource(m.public)
    assert "app.features.rooms" not in inspect.getsource(m.models)
    assert "app.features.auth" not in inspect.getsource(m.models)
