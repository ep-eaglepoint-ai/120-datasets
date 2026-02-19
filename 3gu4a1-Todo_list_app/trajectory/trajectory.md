# Trajectory (Thinking Process for FastAPI Todo API)

1. Define Performance Requirements and Architecture Contract
I started by defining the performance contract: the API must handle 100k+ todos efficiently, all CRUD operations must be O(1) where possible, listing must be O(k) where k=limit (not O(n)), and the system must remain thread-safe for concurrent FastAPI requests. The architecture would use a layered approach (API, Service, Storage, Core) to separate concerns and enable future migration to SQLAlchemy.

2. Design the Data Model for Scalability
I chose UUID4 strings for IDs to avoid collision risks and enable distributed systems. The TodoRecord dataclass stores id, title, completed, and created_at with UTC timestamps. Pydantic v2 models (TodoCreate, TodoUpdate, TodoPatch, TodoOut) handle validation at the API boundary, automatically trimming whitespace and rejecting empty titles before they reach storage.

3. Optimize Storage with Dual Data Structures
Instead of a single list or dict, I used two complementary structures: `_STORE: Dict[str, TodoRecord]` for O(1) lookups by ID, and `_ORDER: List[str]` to preserve insertion order for newest-first listing. This prevents the need to sort the entire dataset on every list request. Dictionary lookups are O(1), and maintaining order in a list allows efficient reverse iteration.

4. Implement O(k) Pagination Without Full Dataset Copying
The `list_todos()` function iterates backwards through `_ORDER` starting from the newest items, skipping `offset` items and collecting up to `limit` items without copying the entire dataset. This achieves O(k) complexity where k=limit, not O(n) where n=total todos. For 100k todos with limit=100, only 100 items are processed regardless of total size.

5. Ensure Thread Safety with RLock
FastAPI with uvicorn runs in a single-process, multi-threaded environment where concurrent requests can modify the same in-memory data structures simultaneously. I wrapped all storage operations with `threading.RLock()` to ensure atomic operations. The lock protects both `_STORE` dict updates and `_ORDER` list modifications, preventing race conditions during concurrent create/update/delete operations.

6. Separate PUT and PATCH Semantics
I implemented PUT for full updates (both `title` and `completed` required) and PATCH for partial updates (optional fields). The PATCH endpoint validates that at least one field is provided using `model_dump(exclude_unset=True)` to detect empty payloads, returning 400 Bad Request rather than silently doing nothing. This follows RESTful conventions and provides clear API contracts.

7. Build a Layered Architecture for Maintainability
I separated concerns into four layers: API (routing only, in `app/api/todos.py`), Service (business logic and HTTP exceptions, in `app/services/todo_service.py`), Storage (data access with performance guarantees, in `app/storage/todo_store.py`), and Core (configuration via `pydantic-settings`, in `app/core/config.py`). Each layer has a single responsibility, making the code easier to test, modify, and migrate to a database later.

8. Use Pydantic v2 for Type Safety and Validation
Pydantic v2 models use `field_validator` for automatic title trimming and empty string rejection, ensuring invalid data never reaches storage. `TodoOut` uses `ConfigDict(from_attributes=True)` to convert storage dataclasses to Pydantic models without manual mapping. This provides runtime validation, type safety, and clear error messages for invalid requests.

9. Design Tests to Validate Both Implementations
I used pytest parametrization with `@pytest.fixture(params=["repository_before", "repository_after"])` to run the same test suite against both repositories. The `TEST_REPOSITORY` environment variable allows filtering to a single repository for focused testing. For `repository_before`, tests fail (not skip) if implementation is missing, providing clear feedback that the baseline is empty.

10. Handle Import Paths Correctly for Test Isolation
Tests need to import from `repository_after/app/main.py` but Python's module resolution varies between local and Docker environments. I added repository paths to `sys.path` in the test fixture and used environment-specific `PYTHONPATH` settings. This ensures tests work both locally (`PYTHONPATH=.`) and in Docker (`PYTHONPATH=/app/repository_after`).

11. Build Evaluation System for Comparison
The evaluation script checks for implementation existence before running tests, runs pytest with `TEST_REPOSITORY` environment variable to filter tests, and detects skipped vs passed tests to ensure `repository_after` actually passes rather than skipping. It generates nested reports (`evaluation/reports/YYYY-MM-DD/HH-MM-SS/report.json`) for tracking improvement over time.

12. Result: Production-Ready API with Measurable Performance
The final implementation achieves O(1) create/get/update/patch operations, O(k) listing where k=limit, thread-safe concurrency, and a clean architecture ready for database migration. All endpoints use proper HTTP status codes (201, 200, 204, 400, 404, 422), comprehensive validation, and consistent error handling. The system scales efficiently to 100k+ todos without performance degradation.
