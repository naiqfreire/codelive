"""Boot test: app exposes /api/health under /api prefix."""
import pytest

pytestmark = pytest.mark.integration


async def test_openapi_contains_health(raw_client):
    resp = await raw_client.get("/openapi.json")
    assert resp.status_code == 200
    data = resp.json()
    assert "/api/health" in data["paths"]
