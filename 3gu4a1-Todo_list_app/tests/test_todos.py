import sys
import os
import pytest
from fastapi.testclient import TestClient


# Filter repositories based on TEST_REPOSITORY environment variable
_test_repos = ["repository_before", "repository_after"]
if os.environ.get("TEST_REPOSITORY"):
    _test_repos = [os.environ.get("TEST_REPOSITORY")]


@pytest.fixture(params=_test_repos)
def client(request):
    """Fixture that provides a TestClient for both repositories."""
    repo_name = request.param
    repo_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), repo_name)

    # Add repository path to sys.path so 'app' module can be found
    if repo_path not in sys.path:
        sys.path.insert(0, repo_path)

    try:
        if repo_name == "repository_before":
            # repository_before may have main.py at root or app/main.py
            try:
                from repository_before.main import app
            except ImportError:
                try:
                    from app.main import app
                except ImportError:
                    # For repository_before, fail tests instead of skipping
                    raise ImportError(f"repository_before implementation not found - main.py or app/main.py missing")
        else:
            # repository_after has app/main.py
            from app.main import app
        return TestClient(app)
    except (ImportError, ModuleNotFoundError) as e:
        if repo_name == "repository_before":
            # For repository_before, raise to fail tests
            raise
        else:
            # For repository_after, skip if not implemented
            pytest.skip(f"Skipping {repo_name} - module not found or not implemented: {e}")


def test_health_check(client):
    """Test the health endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_todo(client):
    """Test creating a new todo."""
    response = client.post("/todos", json={"title": "Test Todo"})
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Test Todo"
    assert data["completed"] is False
    assert "id" in data
    assert "created_at" in data


def test_create_todo_empty_title(client):
    """Test that creating a todo with empty title fails."""
    response = client.post("/todos", json={"title": "   "})
    assert response.status_code == 422


def test_list_todos(client):
    """Test listing todos."""
    # Create a few todos first
    client.post("/todos", json={"title": "Todo 1"})
    client.post("/todos", json={"title": "Todo 2"})
    
    response = client.get("/todos")
    assert response.status_code == 200
    todos = response.json()
    assert isinstance(todos, list)
    assert len(todos) >= 2


def test_get_todo(client):
    """Test getting a specific todo."""
    # Create a todo
    create_response = client.post("/todos", json={"title": "Get Me"})
    todo_id = create_response.json()["id"]
    
    # Get it
    response = client.get(f"/todos/{todo_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == todo_id
    assert data["title"] == "Get Me"


def test_get_nonexistent_todo(client):
    """Test getting a todo that doesn't exist."""
    response = client.get("/todos/nonexistent-id")
    assert response.status_code == 404


def test_update_todo(client):
    """Test updating a todo with PUT."""
    # Create a todo
    create_response = client.post("/todos", json={"title": "Original"})
    todo_id = create_response.json()["id"]
    
    # Update it
    response = client.put(
        f"/todos/{todo_id}", json={"title": "Updated", "completed": True}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Updated"
    assert data["completed"] is True


def test_patch_todo(client):
    """Test partially updating a todo with PATCH."""
    # Create a todo
    create_response = client.post("/todos", json={"title": "Original"})
    todo_id = create_response.json()["id"]
    
    # Patch only completed
    response = client.patch(f"/todos/{todo_id}", json={"completed": True})
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Original"
    assert data["completed"] is True
    
    # Patch only title
    response = client.patch(f"/todos/{todo_id}", json={"title": "Patched Title"})
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Patched Title"
    assert data["completed"] is True


def test_patch_empty_body(client):
    """Test that PATCH with empty body fails."""
    create_response = client.post("/todos", json={"title": "Test"})
    todo_id = create_response.json()["id"]
    
    response = client.patch(f"/todos/{todo_id}", json={})
    assert response.status_code == 400


def test_delete_todo(client):
    """Test deleting a todo."""
    # Create a todo
    create_response = client.post("/todos", json={"title": "Delete Me"})
    todo_id = create_response.json()["id"]
    
    # Delete it
    response = client.delete(f"/todos/{todo_id}")
    assert response.status_code == 204
    
    # Verify it's gone
    get_response = client.get(f"/todos/{todo_id}")
    assert get_response.status_code == 404


def test_delete_nonexistent_todo(client):
    """Test deleting a todo that doesn't exist."""
    response = client.delete("/todos/nonexistent-id")
    assert response.status_code == 404


def test_list_todos_pagination(client):
    """Test pagination parameters."""
    # Create multiple todos
    for i in range(5):
        client.post("/todos", json={"title": f"Todo {i}"})
    
    # Test offset and limit
    response = client.get("/todos?offset=2&limit=2")
    assert response.status_code == 200
    todos = response.json()
    assert len(todos) <= 2


def test_title_trimming(client):
    """Test that titles are trimmed."""
    response = client.post("/todos", json={"title": "  Trimmed Title  "})
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Trimmed Title"


def test_put_nonexistent_todo(client):
    """Test PUT on nonexistent todo returns 404."""
    response = client.put(
        "/todos/nonexistent-id", json={"title": "Updated", "completed": True}
    )
    assert response.status_code == 404


def test_put_empty_title(client):
    """Test PUT with empty/whitespace title fails."""
    create_response = client.post("/todos", json={"title": "Original"})
    todo_id = create_response.json()["id"]
    
    response = client.put(
        f"/todos/{todo_id}", json={"title": "   ", "completed": True}
    )
    assert response.status_code == 422


def test_patch_nonexistent_todo(client):
    """Test PATCH on nonexistent todo returns 404."""
    response = client.patch("/todos/nonexistent-id", json={"title": "Updated"})
    assert response.status_code == 404


def test_patch_whitespace_title(client):
    """Test PATCH with whitespace-only title fails."""
    create_response = client.post("/todos", json={"title": "Original"})
    todo_id = create_response.json()["id"]
    
    response = client.patch(f"/todos/{todo_id}", json={"title": "   "})
    assert response.status_code == 422


def test_patch_both_fields(client):
    """Test PATCH with both title and completed."""
    create_response = client.post("/todos", json={"title": "Original"})
    todo_id = create_response.json()["id"]
    
    response = client.patch(
        f"/todos/{todo_id}", json={"title": "Updated", "completed": True}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Updated"
    assert data["completed"] is True


def test_toggle_complete(client):
    """Test PATCH /todos/{id}/complete endpoint."""
    create_response = client.post("/todos", json={"title": "Test"})
    todo_id = create_response.json()["id"]
    assert create_response.json()["completed"] is False
    
    # Toggle to completed
    response = client.patch(f"/todos/{todo_id}/complete")
    assert response.status_code == 200
    assert response.json()["completed"] is True
    
    # Toggle back to not completed
    response = client.patch(f"/todos/{todo_id}/complete")
    assert response.status_code == 200
    assert response.json()["completed"] is False


def test_toggle_complete_nonexistent(client):
    """Test toggle complete on nonexistent todo returns 404."""
    response = client.patch("/todos/nonexistent-id/complete")
    assert response.status_code == 404


def test_list_todos_ordering(client):
    """Test that todos are listed in newest-first order."""
    # Create todos with distinct titles
    todo1 = client.post("/todos", json={"title": "First"}).json()
    todo2 = client.post("/todos", json={"title": "Second"}).json()
    todo3 = client.post("/todos", json={"title": "Third"}).json()
    
    response = client.get("/todos")
    assert response.status_code == 200
    todos = response.json()
    
    # Find our todos in the list
    todo_map = {t["id"]: t for t in todos}
    assert todo1["id"] in todo_map
    assert todo2["id"] in todo_map
    assert todo3["id"] in todo_map
    
    # Verify newest first: Third should appear before Second, Second before First
    ids = [t["id"] for t in todos]
    assert ids.index(todo3["id"]) < ids.index(todo2["id"])
    assert ids.index(todo2["id"]) < ids.index(todo1["id"])


def test_duplicate_titles_allowed(client):
    """Test that duplicate titles are allowed."""
    response1 = client.post("/todos", json={"title": "Duplicate"})
    response2 = client.post("/todos", json={"title": "Duplicate"})
    
    assert response1.status_code == 201
    assert response2.status_code == 201
    assert response1.json()["id"] != response2.json()["id"]
    assert response1.json()["title"] == response2.json()["title"]


def test_client_provided_id_rejected(client):
    """Test that client-provided IDs are rejected (not used)."""
    response = client.post("/todos", json={"title": "Test", "id": "client-id"})
    assert response.status_code == 201
    data = response.json()
    # Server should generate its own UUID, not use client's ID
    assert data["id"] != "client-id"
    # Verify it's a valid UUID format (36 chars with hyphens)
    assert len(data["id"]) == 36
    assert data["id"].count("-") == 4


def test_created_at_immutable(client):
    """Test that created_at is immutable after creation."""
    create_response = client.post("/todos", json={"title": "Original"})
    todo_id = create_response.json()["id"]
    original_created_at = create_response.json()["created_at"]
    
    # Update the todo
    update_response = client.put(
        f"/todos/{todo_id}", json={"title": "Updated", "completed": True}
    )
    assert update_response.status_code == 200
    # created_at should remain unchanged
    assert update_response.json()["created_at"] == original_created_at
    
    # Patch the todo
    patch_response = client.patch(f"/todos/{todo_id}", json={"completed": False})
    assert patch_response.status_code == 200
    # created_at should still remain unchanged
    assert patch_response.json()["created_at"] == original_created_at


def test_pagination_offset_beyond_total(client):
    """Test pagination with offset beyond total items."""
    # Create 2 todos
    client.post("/todos", json={"title": "Todo 1"})
    client.post("/todos", json={"title": "Todo 2"})
    
    # Request with offset beyond total
    response = client.get("/todos?offset=100&limit=10")
    assert response.status_code == 200
    todos = response.json()
    assert len(todos) == 0


def test_pagination_limit_zero(client):
    """Test pagination with limit=0 returns empty list."""
    client.post("/todos", json={"title": "Todo 1"})
    
    response = client.get("/todos?limit=0")
    assert response.status_code == 200
    todos = response.json()
    assert len(todos) == 0


def test_pagination_limit_max(client):
    """Test pagination with max limit."""
    # Create more than default limit
    for i in range(150):
        client.post("/todos", json={"title": f"Todo {i}"})
    
    response = client.get("/todos?limit=1000")
    assert response.status_code == 200
    todos = response.json()
    assert len(todos) <= 1000


def test_pagination_offset_negative(client):
    """Test pagination with negative offset returns 422."""
    response = client.get("/todos?offset=-1")
    assert response.status_code == 422


def test_pagination_limit_negative(client):
    """Test pagination with negative limit returns 422."""
    response = client.get("/todos?limit=-1")
    assert response.status_code == 422


def test_pagination_limit_exceeds_max(client):
    """Test pagination with limit exceeding max returns 422."""
    response = client.get("/todos?limit=2000")
    assert response.status_code == 422


def test_create_todo_missing_title(client):
    """Test creating todo without title field fails."""
    response = client.post("/todos", json={})
    assert response.status_code == 422


def test_put_missing_fields(client):
    """Test PUT with missing fields fails."""
    create_response = client.post("/todos", json={"title": "Original"})
    todo_id = create_response.json()["id"]
    
    # Missing completed
    response = client.put(f"/todos/{todo_id}", json={"title": "Updated"})
    assert response.status_code == 422
    
    # Missing title
    response = client.put(f"/todos/{todo_id}", json={"completed": True})
    assert response.status_code == 422
