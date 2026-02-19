import os

from feature_store.api import AppSettings, create_app


def _env(name: str, default: str) -> str:
    return os.environ.get(name, default)


settings = AppSettings(
    database_url=_env("DATABASE_URL", "postgresql+psycopg2://postgres:postgres@postgres:5432/feature_store"),
    redis_url=_env("REDIS_URL", "redis://redis:6379/0"),
)

app = create_app(settings)
