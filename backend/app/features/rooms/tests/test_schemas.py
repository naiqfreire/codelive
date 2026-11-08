"""Unit: CreateRoomRequest / RoomOut contract invariants. No database."""
import typing

import pydantic
import pytest

from app.features.rooms.schemas import CreateRoomRequest, Language, RoomOut


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
