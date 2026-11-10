"""In-memory cache for non-real-time rooms data (SPEC §10).

Per-process, TTL 30s, keys ``rooms:mine:{user_id}`` and
``rooms:joined:{user_id}``. Only the room lists are cached; the live code path
never goes through this module. Explicitly invalidated on create/close/
regenerate/join.
"""
from cachetools import TTLCache

ROOMS_MINE_TTL_SECONDS = 30
ROOMS_MINE_MAXSIZE = 256
ROOMS_JOINED_TTL_SECONDS = 30
ROOMS_JOINED_MAXSIZE = 256

_rooms_mine_cache: TTLCache = TTLCache(maxsize=ROOMS_MINE_MAXSIZE, ttl=ROOMS_MINE_TTL_SECONDS)
_rooms_joined_cache: TTLCache = TTLCache(
    maxsize=ROOMS_JOINED_MAXSIZE, ttl=ROOMS_JOINED_TTL_SECONDS
)


def _key(user_id: str) -> str:
    return f"rooms:mine:{user_id}"


def _joined_key(user_id: str) -> str:
    return f"rooms:joined:{user_id}"


def get_cached_rooms_mine(user_id: str):
    return _rooms_mine_cache.get(_key(user_id))


def set_cached_rooms_mine(user_id: str, rooms: list) -> None:
    _rooms_mine_cache[_key(user_id)] = rooms


def invalidate_rooms_mine(user_id: str) -> None:
    _rooms_mine_cache.pop(_key(user_id), None)


def get_cached_rooms_joined(user_id: str):
    return _rooms_joined_cache.get(_joined_key(user_id))


def set_cached_rooms_joined(user_id: str, rooms: list) -> None:
    _rooms_joined_cache[_joined_key(user_id)] = rooms


def invalidate_rooms_joined(user_id: str) -> None:
    _rooms_joined_cache.pop(_joined_key(user_id), None)


def clear_rooms_cache() -> None:
    _rooms_mine_cache.clear()
    _rooms_joined_cache.clear()
