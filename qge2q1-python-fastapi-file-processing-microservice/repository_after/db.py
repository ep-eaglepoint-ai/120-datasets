from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from fastapi import Request

from .config import settings


def create_engine(database_url: str | None = None) -> AsyncEngine:
    url = database_url or settings.database_url
    if url.startswith("sqlite"):
        return create_async_engine(
            url,
            pool_pre_ping=True,
            future=True,
        )

    return create_async_engine(
        url,
        pool_size=20,
        max_overflow=40,
        pool_pre_ping=True,
        future=True,
    )


def create_sessionmaker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    session_factory: async_sessionmaker[AsyncSession] = request.app.state.sessionmaker
    async with session_factory() as session:
        yield session
