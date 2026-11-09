"""In-memory cache for non-real-time rooms data (SPEC §10).

Per-process, TTL 30s, key prefix ``rooms:mine:{user_id}``. Only the owner's
room list is cached; the live code path never goes through this module.
Explicitly invalidated on create/close/regenerate.
"""
from cachetools import TTLCache

ROOMS_MINE_TTL_SECONDS = 30
ROOMS_MINE_MAXSIZE = 256

_rooms_mine_cache: TTLCache = TTLCache(maxsize=ROOMS_MINE_MAXSIZE, ttl=ROOMS_MINE_TTL_SECONDS)


def _key(user_id: str) -> str:
    return f"rooms:mine:{user_id}"


def get_cached_rooms_mine(user_id: str):
    return _rooms_mine_cache.get(_key(user_id))


def set_cached_rooms_mine(user_id: str, rooms: list) -> None:
    _rooms_mine_cache[_key(user_id)] = rooms


def invalidate_rooms_mine(user_id: str) -> None:
    _rooms_mine_cache.pop(_key(user_id), None)


def clear_rooms_cache() -> None:
    _rooms_mine_cache.clear()
