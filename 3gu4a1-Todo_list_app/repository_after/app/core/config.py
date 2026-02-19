"""Application configuration using pydantic-settings."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment-based configuration."""

    app_name: str = "FastAPI Todo API"
    app_version: str = "1.0.0"
    debug: bool = False

    # API settings
    api_title: str = "FastAPI Todo API"
    api_description: str = "High-performance in-memory Todo API with CRUD operations, optimized for 100k+ todos. Ready to migrate to SQLAlchemy later."
    api_version: str = "1.0.0"

    # Pagination defaults
    default_limit: int = 100
    max_limit: int = 1000

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
