from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "file-processing-microservice"

    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@db:5432/postgres",
        alias="DATABASE_URL",
    )

    redis_url: str = Field(default="redis://redis:6379/0", alias="REDIS_URL")

    upload_dir: Path = Field(default=Path("/data/uploads"), alias="UPLOAD_DIR")

    max_upload_bytes: int = Field(default=500 * 1024 * 1024, alias="MAX_UPLOAD_BYTES")

    auto_create_db: bool = Field(default=True, alias="AUTO_CREATE_DB")

    # Celery
    celery_broker_url: str | None = Field(default=None, alias="CELERY_BROKER_URL")
    celery_result_backend: str | None = Field(default=None, alias="CELERY_RESULT_BACKEND")
    celery_task_always_eager: bool = Field(default=False, alias="CELERY_TASK_ALWAYS_EAGER")

    # Worker/task timing
    progress_update_interval_seconds: float = Field(default=5.0, alias="PROGRESS_UPDATE_INTERVAL_SECONDS")
    task_soft_time_limit_seconds: int = Field(default=3600, alias="TASK_SOFT_TIME_LIMIT_SECONDS")
    task_time_limit_seconds: int = Field(default=3700, alias="TASK_TIME_LIMIT_SECONDS")
    worker_shutdown_timeout_seconds: int = Field(default=60, alias="WORKER_SHUTDOWN_TIMEOUT_SECONDS")

    def resolved_broker_url(self) -> str:
        return self.celery_broker_url or self.redis_url

    def resolved_backend_url(self) -> str:
        return self.celery_result_backend or self.redis_url


settings = Settings()

FileType = Literal["csv", "xlsx", "xls"]
