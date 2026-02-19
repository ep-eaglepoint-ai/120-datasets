from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, HttpUrl

from .models import JobStatus


class JobCreate(BaseModel):
    filename: str = Field(..., max_length=255)
    file_size: int = Field(..., ge=0)
    file_type: Literal["csv", "xlsx", "xls"]
    webhook_url: HttpUrl | None = Field(default=None)


class JobUpdate(BaseModel):
    status: JobStatus | None = None
    progress: int | None = Field(default=None, ge=0, le=100)
    rows_processed: int | None = Field(default=None, ge=0)
    rows_failed: int | None = Field(default=None, ge=0)
    error_message: str | None = None
    webhook_url: HttpUrl | None = None


class JobResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    filename: str
    file_size: int
    file_type: str
    status: JobStatus
    progress: int
    rows_processed: int
    rows_failed: int
    error_message: str | None
    webhook_url: str | None
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None


class JobsListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    jobs: list[JobResponse]


class ProcessingErrorResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    job_id: uuid.UUID
    row_number: int
    column_name: str | None
    error_type: str
    error_message: str
    raw_value: str | None
    created_at: datetime


class ProcessingErrorCreate(BaseModel):
    job_id: uuid.UUID
    row_number: int = Field(..., ge=1)
    column_name: str | None = Field(default=None, max_length=255)
    error_type: str = Field(..., max_length=100)
    error_message: str
    raw_value: str | None = None


class ProcessingErrorUpdate(BaseModel):
    column_name: str | None = Field(default=None, max_length=255)
    error_type: str | None = Field(default=None, max_length=100)
    error_message: str | None = None
    raw_value: str | None = None


class ProcessingErrorsListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    errors: list[ProcessingErrorResponse]


class UploadResponse(BaseModel):
    job_id: uuid.UUID


class HealthResponse(BaseModel):
    status: Literal["healthy", "unhealthy"]
    db: bool
    redis: bool
    details: dict[str, Any] = Field(default_factory=dict)
