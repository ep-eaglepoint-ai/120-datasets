from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./shortener.db"
    BASE_URL: str = "http://localhost:8000"
    API_BASE_URL: str = "http://localhost:8000"
    VALIDATE_URL_REACHABILITY: bool = True

    class Config:
        env_file = ".env"

settings = Settings()
