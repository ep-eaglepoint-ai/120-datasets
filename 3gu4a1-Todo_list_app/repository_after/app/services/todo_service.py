"""Service layer: Business logic and validation."""
from typing import List

from fastapi import HTTPException, status

from app.models.todo import TodoCreate, TodoOut, TodoUpdate, TodoPatch
from app.storage import todo_store


def create_todo(data: TodoCreate) -> TodoOut:
    """Create a new todo."""
    rec = todo_store.create_todo(title=data.title)
    return TodoOut.model_validate(rec)


def list_todos(offset: int = 0, limit: int = 100) -> List[TodoOut]:
    """List todos with pagination (newest first)."""
    records = todo_store.list_todos(offset=offset, limit=limit)
    return [TodoOut.model_validate(r) for r in records]


def get_todo(todo_id: str) -> TodoOut:
    """Retrieve a todo by ID. Raises 404 if not found."""
    rec = todo_store.get_todo(todo_id)
    if rec is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Todo with id '{todo_id}' not found",
        )
    return TodoOut.model_validate(rec)


def update_todo(todo_id: str, data: TodoUpdate) -> TodoOut:
    """Full update of a todo (title and completed). Raises 404 if not found."""
    rec = todo_store.update_todo(todo_id, title=data.title, completed=data.completed)
    if rec is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Todo with id '{todo_id}' not found",
        )
    return TodoOut.model_validate(rec)


def patch_todo(todo_id: str, data: TodoPatch) -> TodoOut:
    """Partially update a todo (title and/or completed). Raises 400 if empty, 404 if not found."""
    # Use model_dump(exclude_unset=True) to get only provided fields
    patch_data = data.model_dump(exclude_unset=True)
    
    # Reject empty PATCH payloads
    if not patch_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one field ('title' or 'completed') must be provided",
        )
    
    # Extract only provided fields
    title = patch_data.get("title")
    completed = patch_data.get("completed")
    
    updated_rec = todo_store.patch_todo(todo_id, title=title, completed=completed)
    if updated_rec is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Todo with id '{todo_id}' not found",
        )
    return TodoOut.model_validate(updated_rec)


def toggle_complete(todo_id: str) -> TodoOut:
    """Toggle the completed status of a todo. Raises 404 if not found."""
    rec = todo_store.get_todo(todo_id)
    if rec is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Todo with id '{todo_id}' not found",
        )
    new_completed = not rec.completed
    updated_rec = todo_store.patch_todo(todo_id, completed=new_completed)
    if updated_rec is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Todo with id '{todo_id}' not found",
        )
    return TodoOut.model_validate(updated_rec)


def delete_todo(todo_id: str) -> None:
    """Delete a todo by ID. Raises 404 if not found."""
    deleted = todo_store.delete_todo(todo_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Todo with id '{todo_id}' not found",
        )
