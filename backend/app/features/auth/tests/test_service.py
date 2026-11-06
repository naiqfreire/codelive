"""Unit: normalize_email + hash_password. No database."""
import re

from app.features.auth.service import normalize_email
from app.shared.security import hash_password


def test_normalize_email_strips_and_casefolds():
    assert normalize_email("  Ana@X.COM ") == "ana@x.com"


def test_hash_password_is_argon2id_and_salted():
    h1 = hash_password("same-password-1")
    h2 = hash_password("same-password-1")
    assert re.match(r"^\$argon2id\$v=19\$", h1)
    assert re.match(r"^\$argon2id\$v=19\$", h2)
    assert h1 != h2
