"""argon2id hashing + signed session token (itsdangerous)."""
from datetime import datetime, timezone

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from itsdangerous import URLSafeTimedSerializer

SESSION_COOKIE_NAME = "codelive_session"
TOKEN_MAX_AGE = 86400

_hasher = PasswordHasher()

DUMMY_HASH = ""


def hash_password(raw: str) -> str:
    return _hasher.hash(raw)


def verify_password(stored_hash: str, raw: str) -> bool:
    try:
        return _hasher.verify(stored_hash, raw)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(stored_hash: str) -> bool:
    return _hasher.check_needs_rehash(stored_hash)


def _serializer(secret: str) -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(secret, salt="codelive.session")


def issue_session(secret: str, user_id) -> str:
    payload = {"sub": str(user_id), "exp": datetime.now(timezone.utc).isoformat()}
    return _serializer(secret).dumps(payload)


def read_session(secret: str, token: str) -> dict:
    return _serializer(secret).loads(token, max_age=TOKEN_MAX_AGE)
