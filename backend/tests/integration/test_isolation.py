"""Isolation: every integration test starts from empty tables."""
import pytest
from sqlalchemy import text

pytestmark = pytest.mark.integration


async def test_a_writes_a_user(client, db_session):
    resp = await client.post(
        "/api/auth/register",
        json={"name": "Iso A", "email": "iso-a@example.com", "password": "correct-horse"},
    )
    assert resp.status_code == 201
    result = await db_session.execute(text("SELECT count(*) FROM users"))
    assert result.scalar() == 1


async def test_b_starts_from_an_empty_table(db_session):
    result = await db_session.execute(text("SELECT count(*) FROM users"))
    assert result.scalar() == 0
