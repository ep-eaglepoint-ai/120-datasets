from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import JSON, DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class FeatureDefinitionModel(Base):
    __tablename__ = "feature_definitions"
    __table_args__ = (UniqueConstraint("name", "version", name="uq_feature_name_version"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    version: Mapped[str] = mapped_column(String(64), nullable=False)

    description: Mapped[str] = mapped_column(Text, nullable=False)
    owner: Mapped[str] = mapped_column(String(255), nullable=False)
    tags: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    entity_keys: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    event_timestamp: Mapped[str] = mapped_column(String(255), nullable=False)

    source: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    transform: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    depends_on: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    schema: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    default_value: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class FeatureStatsModel(Base):
    __tablename__ = "feature_stats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    feature_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    feature_version: Mapped[str] = mapped_column(String(64), nullable=False)
    stats: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class FeatureLineageEdgeModel(Base):
    __tablename__ = "feature_lineage_edges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    upstream: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    downstream: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class FeatureProcessingStateModel(Base):
    """Per-feature processing state for batch/stream pipelines.

    Used for incremental processing watermarks and backfill checkpoints.
    """

    __tablename__ = "feature_processing_state"
    __table_args__ = (
        UniqueConstraint("feature_name", "feature_version", "state_key", name="uq_feature_state"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    feature_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    feature_version: Mapped[str] = mapped_column(String(64), nullable=False)
    state_key: Mapped[str] = mapped_column(String(128), nullable=False)
    state: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )
