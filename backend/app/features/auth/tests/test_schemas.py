"""Unit: RegisterRequest bounds + UserOut fields. No database."""
import pydantic
import pytest

from app.features.auth.schemas import RegisterRequest, UserOut


@pytest.mark.parametrize(
    "payload",
    [
        {"name": "", "email": "a@b.com", "password": "correct-horse"},
        {"name": "   ", "email": "a@b.com", "password": "correct-horse"},
        {"name": "x" * 121, "email": "a@b.com", "password": "correct-horse"},
        {"name": "Ana", "email": "a@b.com", "password": "1234567"},
        {"name": "Ana", "email": "a@b.com", "password": "x" * 129},
        {"name": "Ana", "email": "a@b.com", "password": "correct-horse", "extra": "nope"},
    ],
)
def test_invalid_payloads_raise(payload):
    with pytest.raises(pydantic.ValidationError):
        RegisterRequest(**payload)


def test_valid_payload_round_trips():
    data = RegisterRequest(name="Ana", email="ana@example.com", password="correct-horse")
    assert data.name == "Ana"
    assert data.password == "correct-horse"


def test_user_out_has_exactly_four_fields():
    assert set(UserOut.model_fields) == {"id", "name", "email", "created_at"}
