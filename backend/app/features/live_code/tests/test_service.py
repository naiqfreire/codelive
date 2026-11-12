"""Unit: content_hash and MAX_CODE_BYTES. No database."""
import hashlib

from app.features.live_code.service import (
    MAX_CODE_BYTES,
    content_hash,
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
