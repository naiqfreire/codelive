"""Rooms business logic: access-code generation and room creation."""
import secrets

import structlog
from fastapi import HTTPException
from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.membership import public as membership
from app.features.rooms.models import Room
from app.shared.errors import ErrorCode

log = structlog.get_logger()

ACCESS_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
ACCESS_CODE_LENGTH = 6
MAX_CODE_ATTEMPTS = 5


def generate_access_code() -> str:
    return "".join(secrets.choice(ACCESS_CODE_ALPHABET) for _ in range(ACCESS_CODE_LENGTH))


async def create_room(session: AsyncSession, owner, language: str) -> Room:
    for attempt in range(1, MAX_CODE_ATTEMPTS + 1):
        code = generate_access_code()
        already_exists = (
            await session.execute(select(exists().where(Room.access_code == code)))
        ).scalar()
        # .scalar() on exists() returns bool-ish; coerce
        if bool(already_exists):
            log.info("access_code_collision", attempt=attempt)
            continue
        room = Room(owner_id=owner.id, access_code=code, language=language)
        try:
            async with session.begin_nested():
                session.add(room)
                await session.flush()
        except IntegrityError as exc:
            constraint = getattr(getattr(exc, "orig", None), "diag", None)
            name = getattr(constraint, "constraint_name", None) if constraint else None
            if name == "uq_rooms_access_code":
                log.info("access_code_collision", attempt=attempt)
                continue
            raise
        membership.create_owner_member(session, room.id, owner.id)
        await session.commit()
        return room
    log.error("access_code_exhausted", attempts=MAX_CODE_ATTEMPTS)
    raise HTTPException(status_code=500, detail=ErrorCode.INTERNAL_ERROR)
