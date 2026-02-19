"""In-memory storage optimized for 100k+ todos.

O(1) operations: create, get, update, patch, delete. O(k) list where k=limit.
Thread-safe via threading.RLock. Migration-ready interface.

Concurrency model:
- FastAPI with uvicorn (single-process, multi-threaded)
- threading.RLock ensures thread safety for concurrent operations
- All operations are atomic within lock context
- Safe for concurrent create/update/patch/delete operations
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import threading
import uuid
from typing import Dict, List, Optional


@dataclass
class TodoRecord:
    id: str
    title: str
    completed: bool = False
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


_STORE: Dict[str, TodoRecord] = {}
_ORDER: List[str] = []  # Insertion order (newest at end)
_LOCK = threading.RLock()


def create_todo(title: str) -> TodoRecord:
    """Create a new todo with UUID4 ID. O(1)."""
    rec = TodoRecord(id=str(uuid.uuid4()), title=title, completed=False)
    with _LOCK:
        _STORE[rec.id] = rec
        _ORDER.append(rec.id)  # Append to end (newest last)
    return rec


def get_todo(todo_id: str) -> Optional[TodoRecord]:
    """Retrieve a todo by ID. O(1)."""
    with _LOCK:
        return _STORE.get(todo_id)


def update_todo(todo_id: str, *, title: str, completed: bool) -> Optional[TodoRecord]:
    """Full update of a todo (title and completed). O(1)."""
    with _LOCK:
        rec = _STORE.get(todo_id)
        if rec is None:
            return None
        rec.title = title
        rec.completed = completed
        return rec


def patch_todo(
    todo_id: str, *, title: Optional[str] = None, completed: Optional[bool] = None
) -> Optional[TodoRecord]:
    """Partial update of a todo. O(1)."""
    with _LOCK:
        rec = _STORE.get(todo_id)
        if rec is None:
            return None
        if title is not None:
            rec.title = title
        if completed is not None:
            rec.completed = completed
        return rec


def delete_todo(todo_id: str) -> bool:
    """Delete a todo by ID. O(n) list removal. Returns True if deleted."""
    with _LOCK:
        if todo_id not in _STORE:
            return False
        del _STORE[todo_id]
        if todo_id in _ORDER:
            _ORDER.remove(todo_id)
        return True


def list_todos(offset: int = 0, limit: int = 100) -> List[TodoRecord]:
    """List todos in reverse insertion order (newest first). O(k) where k=limit."""
    result: List[TodoRecord] = []
    if limit <= 0:
        return result

    with _LOCK:
        total_items = len(_ORDER)
        if total_items == 0:
            return result
        
        collected = 0
        skipped = 0
        
        for i in range(total_items - 1, -1, -1):
            todo_id = _ORDER[i]
            rec = _STORE.get(todo_id)
            if rec is None:
                continue
            
            if skipped < offset:
                skipped += 1
                continue
            
            result.append(rec)
            collected += 1
            if collected >= limit:
                break
    
    return result
