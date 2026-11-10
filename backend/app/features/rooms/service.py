"""Rooms business logic: access-code generation and room management."""
import secrets
import uuid

import structlog
from fastapi import HTTPException
from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.membership import public as membership
from app.features.rooms import cache
from app.features.rooms.models import Room
from app.features.rooms.schemas import JoinInfo, ListJoinedResponse, RoomOut
from app.shared.errors import ErrorCode

log = structlog.get_logger()

ACCESS_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
ACCESS_CODE_LENGTH = 6
MAX_CODE_ATTEMPTS = 5


def generate_access_code() -> str:
    return "".join(secrets.choice(ACCESS_CODE_ALPHABET) for _ in range(ACCESS_CODE_LENGTH))


async def _code_taken(session: AsyncSession, code: str) -> bool:
    already_exists = (
        await session.execute(select(exists().where(Room.access_code == code)))
    ).scalar()
    return bool(already_exists)


def _is_code_collision(exc: IntegrityError) -> bool:
    constraint = getattr(getattr(exc, "orig", None), "diag", None)
    name = getattr(constraint, "constraint_name", None) if constraint else None
    return name == "uq_rooms_access_code"


async def create_room(session: AsyncSession, owner, language: str) -> Room:
    for attempt in range(1, MAX_CODE_ATTEMPTS + 1):
        code = generate_access_code()
        if await _code_taken(session, code):
            log.info("access_code_collision", attempt=attempt)
            continue
        room = Room(owner_id=owner.id, access_code=code, language=language)
        try:
            async with session.begin_nested():
                session.add(room)
                await session.flush()
        except IntegrityError as exc:
            if _is_code_collision(exc):
                log.info("access_code_collision", attempt=attempt)
                continue
            raise
        membership.create_owner_member(session, room.id, owner.id)
        await session.commit()
        cache.invalidate_rooms_mine(str(owner.id))
        cache.invalidate_rooms_joined(str(owner.id))
        return room
    log.error("access_code_exhausted", attempts=MAX_CODE_ATTEMPTS)
    raise HTTPException(status_code=500, detail=ErrorCode.INTERNAL_ERROR)


async def list_rooms_for_owner(session: AsyncSession, owner):
    user_key = str(owner.id)
    cached = cache.get_cached_rooms_mine(user_key)
    if cached is not None:
        return cached
    rows = (
        (
            await session.execute(
                select(Room)
                .where(Room.owner_id == owner.id)
                .order_by(Room.created_at.desc(), Room.id.desc())
            )
        )
        .scalars()
        .all()
    )
    payload = [RoomOut.model_validate(room).model_dump(mode="json") for room in rows]
    cache.set_cached_rooms_mine(user_key, payload)
    return payload


async def _get_owned_room(session: AsyncSession, room_id, user) -> Room:
    room = await session.get(Room, room_id)
    if room is None:
        raise HTTPException(status_code=404, detail=ErrorCode.ROOM_NOT_FOUND)
    if room.owner_id != user.id:
        raise HTTPException(status_code=403, detail=ErrorCode.FORBIDDEN)
    return room


async def close_room(session: AsyncSession, room_id, user) -> Room:
    room = await _get_owned_room(session, room_id, user)
    if room.status != "closed":
        room.status = "closed"
        await session.commit()
    cache.invalidate_rooms_mine(str(user.id))
    return room


async def regenerate_room_code(session: AsyncSession, room_id, user) -> Room:
    room = await _get_owned_room(session, room_id, user)
    if room.status == "closed":
        raise HTTPException(status_code=409, detail=ErrorCode.ROOM_CLOSED)
    for attempt in range(1, MAX_CODE_ATTEMPTS + 1):
        code = generate_access_code()
        if await _code_taken(session, code):
            log.info("access_code_collision", attempt=attempt)
            continue
        try:
            async with session.begin_nested():
                room.access_code = code
                await session.flush()
        except IntegrityError as exc:
            if _is_code_collision(exc):
                log.info("access_code_collision", attempt=attempt)
                continue
            raise
        await session.commit()
        cache.invalidate_rooms_mine(str(user.id))
        return room
    log.error("access_code_exhausted", attempts=MAX_CODE_ATTEMPTS)
    raise HTTPException(status_code=500, detail=ErrorCode.INTERNAL_ERROR)


_MEMBER_COLLISION = "uq_room_members_room_user"


def _is_member_collision(exc: IntegrityError) -> bool:
    constraint = getattr(getattr(exc, "orig", None), "diag", None)
    name = getattr(constraint, "constraint_name", None) if constraint else None
    return name == _MEMBER_COLLISION


async def get_room_by_code(session: AsyncSession, codigo: str) -> Room:
    """Return room metadata only when the access code matches it (otherwise 404).

    Unlike the route form ``GET /api/rooms/{room_id}/by-code`` this lookup is by
    code alone, so an unknown code resolves to ``ROOM_NOT_FOUND`` either way.
    """
    room = (
        await session.execute(select(Room).where(Room.access_code == codigo))
    ).scalars().first()
    if room is None:
        raise HTTPException(status_code=404, detail=ErrorCode.ROOM_NOT_FOUND)
    return room


async def join_room(
    session: AsyncSession,
    room_id: uuid.UUID,
    user,
    code: str,
    anonymous: bool = False,
    nickname: str | None = None,
) -> Room:
    """Make the user a member of the room after validating the access code.

    - owner joining their own room keeps role ``"owner"``.
    - anyone else joins as role ``"viewer"``.
    - re-join on the same ``(room, user)`` is idempotent (the unique constraint
      breach is treated as an existing membership, never an error).
    - anonymous mode is not yet supported here — the signed anonymous session
      lives in US3, where this endpoint returns 422 for ``anonymous=True``.

    The caller can derive authorization later via these ``room_members`` rows;
    the service never trusts ``role`` supplied by the client (§8).
    """
    room = await session.get(Room, room_id)
    if room is None:
        raise HTTPException(status_code=404, detail=ErrorCode.ROOM_NOT_FOUND)
    if room.access_code != code:
        raise HTTPException(status_code=404, detail=ErrorCode.ROOM_NOT_FOUND)
    if room.status == "closed":
        raise HTTPException(status_code=409, detail=ErrorCode.ROOM_CLOSED)
    if anonymous:
        raise HTTPException(status_code=422, detail=ErrorCode.VALIDATION_ERROR)

    normalized_nickname = nickname.strip() if nickname else None
    if normalized_nickname == "":
        normalized_nickname = None

    role = "owner" if room.owner_id == user.id else "viewer"
    try:
        async with session.begin_nested():
            membership.create_member(
                session, room.id, user.id, role=role, nickname=normalized_nickname
            )
    except IntegrityError as exc:
        if not _is_member_collision(exc):
            raise
        log.info("room_rejoin", room_id=str(room.id), user_id=str(user.id))
    else:
        await session.commit()
        cache.invalidate_rooms_joined(str(user.id))
    return room


async def list_rooms_joined(session: AsyncSession, user) -> ListJoinedResponse:
    """List every membership the user holds, newest first.

    Cached under ``rooms:joined:{user_id}`` (SPEC §10, TTL 30s); invalidated
    on room creation and on join. The live code path never goes through it.
    """
    user_key = str(user.id)
    cached = cache.get_cached_rooms_joined(user_key)
    if cached is not None:
        return ListJoinedResponse(items=[JoinInfo(**item) for item in cached])
    memberships = await membership.list_memberships_for_user(session, user.id)
    payload = [
        JoinInfo(
            room_id=m.room_id,
            user_id=str(m.user_id),
            role=m.role,
            is_anonymous=bool(m.is_anonymous),
            nickname=m.nickname,
            joined_at=m.joined_at,
        )
        for m in memberships
    ]
    cache.set_cached_rooms_joined(user_key, [item.model_dump(mode="json") for item in payload])
    return ListJoinedResponse(items=payload)
