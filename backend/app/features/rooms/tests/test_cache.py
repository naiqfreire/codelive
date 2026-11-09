"""Unit: in-memory cache for non-real-time rooms data (SPEC §10). No database."""
from app.features.rooms import cache


def setup_function():
    cache.clear_rooms_cache()


def teardown_function():
    cache.clear_rooms_cache()


def test_get_returns_none_when_missing():
    assert cache.get_cached_rooms_mine("user-1") is None


def test_set_then_get_roundtrip():
    payload = [{"id": "1", "access_code": "ABC123"}]
    cache.set_cached_rooms_mine("user-1", payload)
    assert cache.get_cached_rooms_mine("user-1") == payload


def test_invalidate_removes_only_target_key():
    cache.set_cached_rooms_mine("user-1", [{"id": "1"}])
    cache.set_cached_rooms_mine("user-2", [{"id": "2"}])
    cache.invalidate_rooms_mine("user-1")
    assert cache.get_cached_rooms_mine("user-1") is None
    assert cache.get_cached_rooms_mine("user-2") == [{"id": "2"}]


def test_clear_removes_everything():
    cache.set_cached_rooms_mine("user-1", [{"id": "1"}])
    cache.set_cached_rooms_mine("user-2", [{"id": "2"}])
    cache.clear_rooms_cache()
    assert cache.get_cached_rooms_mine("user-1") is None
    assert cache.get_cached_rooms_mine("user-2") is None
