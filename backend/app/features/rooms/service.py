"""Rooms business logic: access-code generation and room management."""
import secrets

import structlog
from fastapi import HTTPException
from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.membership import public as membership
from app.features.rooms import cache
from app.features.rooms.models import Room
from app.features.rooms.schemas import RoomOut
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
