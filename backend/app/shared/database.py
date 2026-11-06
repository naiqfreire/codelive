"""Database engine / sessionmaker / single DeclarativeBase metadata owner."""
from collections.abc import AsyncIterator
from functools import lru_cache

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    metadata = MetaData(
        naming_convention={
            "pk": "pk_%(table_name)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "ix": "ix_%(table_name)s_%(column_0_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "ck": "ck_%(table_name)s_%(constraint_name)s",
        }
    )


@lru_cache
def get_engine() -> AsyncEngine:
    from app.shared.config import get_settings

    return create_async_engine(
        get_settings().DATABASE_URL,
        pool_pre_ping=True,
        connect_args={"connect_timeout": 2},
    )


@lru_cache
def get_sessionmaker():
    return async_sessionmaker(get_engine(), expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with get_sessionmaker()() as session:
        yield session
