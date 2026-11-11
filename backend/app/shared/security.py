"""argon2id hashing + signed session token (itsdangerous)."""
from datetime import datetime, timezone

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from itsdangerous import BadSignature, URLSafeTimedSerializer

SESSION_COOKIE_NAME = "codelive_session"
TOKEN_MAX_AGE = 86400

ANONYMOUS_COOKIE_NAME = "codelive_anon"
ANONYMOUS_MAX_AGE = 7 * 24 * 60 * 60

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


def _anonymous_serializer(secret: str) -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(secret, salt="codelive.anonymous")


def issue_anonymous_session(secret: str, session_id: str) -> str:
    """Sign an anonymous spectator session id (no email, no user account)."""
    return _anonymous_serializer(secret).dumps({"sid": str(session_id)})


def read_anonymous_session(secret: str, token: str) -> str:
    payload = _anonymous_serializer(secret).loads(token, max_age=ANONYMOUS_MAX_AGE)
    session_id = payload.get("sid")
    if not session_id:
        raise BadSignature("missing sid")
    return session_id
