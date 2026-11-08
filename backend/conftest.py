"""
Pytest configuration and shared fixtures.
"""
import pytest
import os

from app.shared.asyncio_policy import ensure_selector_event_loop

# psycopg (async) cannot use ProactorEventLoop on Windows; pytest-asyncio
# creates loops after this import, so the policy is effective for tests too.
ensure_selector_event_loop()

# Ensure .env is loaded for tests
@pytest.fixture(scope="session", autouse=True)
def load_test_env():
    """Load environment variables from .env file for tests."""
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    if os.path.exists(env_path):
        # Load env vars but don't set them in process environment
        # Tests should use pytest fixtures to access them
        pass
