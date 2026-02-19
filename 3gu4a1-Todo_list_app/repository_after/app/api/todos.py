"""API layer: HTTP routing and request/response handling only."""
from typing import List

from fastapi import APIRouter, Query, status

from app.core.config import settings
from app.models.todo import TodoCreate, TodoOut, TodoUpdate, TodoPatch
from app.services import todo_service


router = APIRouter(prefix="/todos", tags=["todos"])


@router.post("", response_model=TodoOut, status_code=status.HTTP_201_CREATED)
async def create_todo(data: TodoCreate) -> TodoOut:
    """Create a new todo."""
    return todo_service.create_todo(data)


@router.get("", response_model=List[TodoOut])
async def list_todos(
    offset: int = Query(
        0, ge=0, description="Number of items to skip (newest first)"
    ),
    limit: int = Query(
        settings.default_limit, ge=0, le=settings.max_limit, description="Maximum number of items to return"
    ),
) -> List[TodoOut]:
    """List todos with pagination (newest first)."""
    return todo_service.list_todos(offset=offset, limit=limit)


@router.get("/{todo_id}", response_model=TodoOut)
async def get_todo(todo_id: str) -> TodoOut:
    """Retrieve a todo by ID."""
    return todo_service.get_todo(todo_id)


@router.put("/{todo_id}", response_model=TodoOut)
async def update_todo(todo_id: str, data: TodoUpdate) -> TodoOut:
    """Full update of a todo (title and completed)."""
    return todo_service.update_todo(todo_id, data)


@router.patch("/{todo_id}", response_model=TodoOut)
async def patch_todo(todo_id: str, data: TodoPatch) -> TodoOut:
    """Partially update a todo (title and/or completed)."""
    return todo_service.patch_todo(todo_id, data)


@router.patch("/{todo_id}/complete", response_model=TodoOut)
async def toggle_complete(todo_id: str) -> TodoOut:
    """Toggle the completed status of a todo."""
    return todo_service.toggle_complete(todo_id)


@router.delete("/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_todo(todo_id: str) -> None:
    """Delete a todo by ID."""
    todo_service.delete_todo(todo_id)
    return None
