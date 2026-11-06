"""
Pytest configuration and shared fixtures.
"""
import pytest
import os

# Ensure .env is loaded for tests
@pytest.fixture(scope="session", autouse=True)
def load_test_env():
    """Load environment variables from .env file for tests."""
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    if os.path.exists(env_path):
        # Load env vars but don't set them in process environment
        # Tests should use pytest fixtures to access them
        pass
