"""Pydantic v2 models for Todo API."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TodoCreate(BaseModel):
    """Request model for creating a new todo."""
    title: str = Field(..., description="Title of the todo item")

    @field_validator("title", mode="before")
    @classmethod
    def trim_and_validate_title(cls, v: str) -> str:
        if v is None:
            raise ValueError("title is required")
        if not isinstance(v, str):
            raise TypeError("title must be a string")
        t = v.strip()
        if not t:
            raise ValueError("title cannot be empty")
        return t


class TodoUpdate(BaseModel):
    """Request model for full todo update (PUT)."""
    title: str = Field(..., description="New title of the todo item")
    completed: bool = Field(..., description="Completion status")

    @field_validator("title", mode="before")
    @classmethod
    def trim_and_validate_title(cls, v: str) -> str:
        if v is None:
            raise ValueError("title is required")
        if not isinstance(v, str):
            raise TypeError("title must be a string")
        t = v.strip()
        if not t:
            raise ValueError("title cannot be empty")
        return t


class TodoPatch(BaseModel):
    """Request model for partial todo update (PATCH)."""
    title: str | None = Field(None, description="New title of the todo item")
    completed: bool | None = Field(None, description="Completion status")

    @field_validator("title", mode="before")
    @classmethod
    def trim_and_validate_title_optional(cls, v: str | None) -> str | None:
        if v is None:
            return None
        if not isinstance(v, str):
            raise TypeError("title must be a string")
        t = v.strip()
        if not t:
            raise ValueError("title cannot be empty")
        return t


class TodoOut(BaseModel):
    """Response model for todo output."""
    id: str = Field(..., description="UUID4 string identifier")
    title: str = Field(..., description="Todo title")
    completed: bool = Field(default=False, description="Completion status")
    created_at: datetime = Field(..., description="Creation timestamp in UTC")

    model_config = ConfigDict(from_attributes=True)
