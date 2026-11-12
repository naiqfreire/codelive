"""Unit: content_hash, MAX_CODE_BYTES, validate_content_size and refusal_reason. No database."""
import hashlib

from app.features.live_code.service import (
    MAX_CODE_BYTES,
    content_hash,
    refusal_reason,
    validate_content_size,
)


def test_max_code_bytes_is_256_kib():
    assert MAX_CODE_BYTES == 262_144


def test_content_hash_is_sha256_of_utf8_bytes():
    assert content_hash("") == hashlib.sha256(b"").hexdigest()
    assert content_hash("print('x')") == hashlib.sha256(
        "print('x')".encode("utf-8")
    ).hexdigest()


def test_content_hash_handles_multibyte_utf8():
    assert content_hash("código 🐍") == hashlib.sha256(
        "código 🐍".encode("utf-8")
    ).hexdigest()


def test_content_hash_is_deterministic():
    assert content_hash("abc") == content_hash("abc")
    assert len(content_hash("abc")) == 64


def test_validate_content_size_returns_utf8_byte_length():
    assert validate_content_size("") == 0
    assert validate_content_size("abc") == 3
    assert validate_content_size("código 🐍") == len("código 🐍".encode("utf-8"))


def test_validate_content_size_boundary_at_max_code_bytes():
    assert validate_content_size("A" * MAX_CODE_BYTES) == MAX_CODE_BYTES
    assert validate_content_size("A" * (MAX_CODE_BYTES + 1)) == MAX_CODE_BYTES + 1
    assert validate_content_size("A" * (2 * MAX_CODE_BYTES)) == 2 * MAX_CODE_BYTES


def test_validate_content_size_counts_multibyte_bytes_not_chars():
    # 262_144 bytes of UTF-8; fewer characters than bytes
    content = "á" * (MAX_CODE_BYTES // 2)
    assert validate_content_size(content) == MAX_CODE_BYTES


def test_owner_of_active_room_may_write():
    assert refusal_reason("owner", "active") is None  # D-12


def test_owner_of_closed_room_is_room_closed():
    assert refusal_reason("owner", "closed") == "room_closed"


def test_viewer_of_active_room_is_not_owner():
    assert refusal_reason("viewer", "active") == "not_owner"


def test_role_is_decided_before_status():
    assert refusal_reason("viewer", "closed") == "not_owner"  # D-09 order


def test_non_owner_with_unread_status_is_still_not_owner():
    assert refusal_reason("viewer", None) == "not_owner"  # makes the conditional read safe


def test_owner_with_absent_status_fails_closed():
    assert refusal_reason("owner", None) == "room_closed"  # fail closed


def test_owner_with_unknown_status_fails_closed():
    assert refusal_reason("owner", "archived") == "room_closed"  # fail closed
