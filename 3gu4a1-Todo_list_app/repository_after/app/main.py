"""FastAPI Todo API - Production-ready CRUD API optimized for 100k+ todos."""
from fastapi import FastAPI

from app.api.todos import router as todos_router
from app.core.config import settings

app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description=settings.api_description,
)

app.include_router(todos_router)


@app.get("/health", tags=["system"])
async def health():
    """Health check endpoint."""
    return {"status": "ok"}
