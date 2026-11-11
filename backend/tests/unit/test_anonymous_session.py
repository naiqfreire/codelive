"""Unit: signed anonymous session tokens (no email, no registration)."""
import pytest
from itsdangerous import BadSignature, URLSafeTimedSerializer

from app.shared.security import (
    ANONYMOUS_COOKIE_NAME,
    ANONYMOUS_MAX_AGE,
    issue_anonymous_session,
    issue_session,
    read_anonymous_session,
)

SECRET = "unit-test-secret"


def test_cookie_name_and_max_age_are_defined():
    assert ANONYMOUS_COOKIE_NAME == "codelive_anon"
    assert ANONYMOUS_MAX_AGE > 0


def test_issue_and_read_roundtrip():
    token = issue_anonymous_session(SECRET, "anon-123")
    assert read_anonymous_session(SECRET, token) == "anon-123"


def test_session_token_is_not_accepted_as_anonymous():
    session_token = issue_session(SECRET, "user-123")
    with pytest.raises(BadSignature):
        read_anonymous_session(SECRET, session_token)


def test_invalid_signature_is_rejected():
    token = issue_anonymous_session(SECRET, "anon-123")
    with pytest.raises(BadSignature):
        read_anonymous_session("other-secret", token)


def test_token_without_sid_is_rejected():
    serializer = URLSafeTimedSerializer(SECRET, salt="codelive.anonymous")
    token = serializer.dumps({"sub": "anon-123"})
    with pytest.raises(BadSignature):
        read_anonymous_session(SECRET, token)