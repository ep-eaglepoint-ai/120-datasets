from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker


@dataclass(frozen=True)
class DatabaseSettings:
    database_url: str


def create_engine_and_session_factory(settings: DatabaseSettings) -> tuple[Engine, sessionmaker]:
    engine = create_engine(settings.database_url, pool_pre_ping=True)
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    return engine, SessionLocal
