"""Unit: CreateRoomRequest / RoomOut / JoinedRoomOut contract invariants. No database."""
import typing
import uuid
from datetime import datetime, timezone

import pydantic
import pytest

from app.features.rooms.schemas import CreateRoomRequest, JoinedRoomOut, Language, RoomOut


@pytest.mark.parametrize(
    "payload",
    [
        {"language": "rust"},
        {"language": "Python"},
        {"language": ""},
        {},
        {"language": "c", "title": "x"},
    ],
)
def test_invalid_languages_raise(payload):
    with pytest.raises(pydantic.ValidationError):
        CreateRoomRequest(**payload)


def test_all_five_languages_valid():
    for lang in ("python", "java", "c", "php", "javascript"):
        assert CreateRoomRequest(language=lang).language == lang
    assert typing.get_args(Language) == ("python", "java", "c", "php", "javascript")


def test_room_out_has_exactly_five_fields():
    assert set(RoomOut.model_fields) == {"id", "access_code", "language", "status", "created_at"}


def test_joined_room_out_is_room_out_plus_joined_at():
    assert set(JoinedRoomOut.model_fields) == {
        "id",
        "access_code",
        "language",
        "status",
        "created_at",
        "joined_at",
    }


def test_joined_room_out_serializes_id_as_string():
    now = datetime(2026, 11, 14, 12, 0, tzinfo=timezone.utc)
    item = JoinedRoomOut(
        id=uuid.uuid7(),
        access_code="K7M2QX",
        language="python",
        status="active",
        created_at=now,
        joined_at=now,
    )

    payload = item.model_dump(mode="json")

    assert isinstance(payload["id"], str)
    assert datetime.fromisoformat(payload["joined_at"]) == now
