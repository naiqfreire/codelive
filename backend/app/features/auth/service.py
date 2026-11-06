"""Auth business logic: email normalization, registration, lookup."""
import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.auth.models import User
from app.shared.errors import ErrorCode
from app.shared.security import DUMMY_HASH, hash_password, needs_rehash, verify_password


def normalize_email(value: str) -> str:
    return value.strip().casefold()


async def _precheck_existing(session: AsyncSession, data) -> User | None:
    normalized = normalize_email(data.email)
    return (
        await session.execute(select(User).where(User.email == normalized))
    ).scalar_one_or_none()


async def register(session: AsyncSession, data) -> User:
    normalized = normalize_email(data.email)
    if await _precheck_existing(session, data) is not None:
        raise HTTPException(status_code=409, detail=ErrorCode.EMAIL_ALREADY_EXISTS)
    user = User(
        name=data.name,
        email=normalized,
        password_hash=hash_password(data.password),
    )
    session.add(user)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail=ErrorCode.EMAIL_ALREADY_EXISTS)
    await session.refresh(user)
    return user


async def get_user_by_id(session: AsyncSession, user_id) -> User | None:
    return await session.get(User, user_id)


async def authenticate(session: AsyncSession, email: str, password: str) -> User | None:
    """Return User on success, None otherwise. Unknown email still verifies DUMMY_HASH."""
    normalized = normalize_email(email)
    user = (
        await session.execute(select(User).where(User.email == normalized))
    ).scalar_one_or_none()
    if user is None:
        verify_password(DUMMY_HASH, password)
        return None
    if not verify_password(user.password_hash, password):
        return None
    try:
        if needs_rehash(user.password_hash):
            user.password_hash = hash_password(password)
            await session.commit()
    except Exception:
        await session.rollback()
    return user
