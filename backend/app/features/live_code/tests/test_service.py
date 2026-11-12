"""Unit: content_hash, MAX_CODE_BYTES and validate_content_size. No database."""
import hashlib

from app.features.live_code.service import (
    MAX_CODE_BYTES,
    content_hash,
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
