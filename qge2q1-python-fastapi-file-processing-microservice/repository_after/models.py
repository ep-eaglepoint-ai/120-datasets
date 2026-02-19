from __future__ import annotations

import enum
import uuid

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.types import Enum as SAEnum
from sqlalchemy import Uuid
from sqlalchemy.types import JSON


class Base(DeclarativeBase):
    pass


class JobStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[JobStatus] = mapped_column(SAEnum(JobStatus, name="job_status"), nullable=False, default=JobStatus.QUEUED)

    progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rows_processed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rows_failed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    webhook_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    started_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)

    errors: Mapped[list[ProcessingError]] = relationship(
        "ProcessingError",
        back_populates="job",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    loaded_rows: Mapped[list[LoadedRow]] = relationship(
        "LoadedRow",
        back_populates="job",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


Index("ix_jobs_created_at", Job.created_at)


class ProcessingError(Base):
    __tablename__ = "processing_errors"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    column_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    error_type: Mapped[str] = mapped_column(String(100), nullable=False)
    error_message: Mapped[str] = mapped_column(Text, nullable=False)
    raw_value: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    job: Mapped[Job] = relationship("Job", back_populates="errors")


class LoadedRow(Base):
    __tablename__ = "loaded_rows"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    data: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    job: Mapped[Job] = relationship("Job", back_populates="loaded_rows")
