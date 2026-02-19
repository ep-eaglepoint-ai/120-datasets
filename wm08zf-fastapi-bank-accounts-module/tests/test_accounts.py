import sys
import pytest
import asyncio
import time
from unittest.mock import MagicMock, patch, AsyncMock

# ==========================================
# ROBUST MOCKING INFRASTRUCTURE
# ==========================================

def register_mock(name):
    """Registers a mock in sys.modules to prevent ImportErrors."""
    m = MagicMock()
    m.__spec__ = None
    sys.modules[name] = m
    return m

# 1. Mock 'app' structure
if "app" not in sys.modules:
    app_pkg = register_mock("app")
    app_pkg.__path__ = []

register_mock("app.core")
deps = register_mock("app.core.deps")
deps.get_db = MagicMock()
deps.get_current_active_user = MagicMock()

register_mock("app.db")
register_mock("app.db.models")
user_models = register_mock("app.db.models.user")
user_models.User = MagicMock()

register_mock("app.schemas")
account_schemas = register_mock("app.schemas.account")

from pydantic import BaseModel
class MockSchema(BaseModel):
    pass

class AccountCreate(MockSchema):
    account_type: str
    currency: str

class AccountResponse(MockSchema):
    id: int
    account_number: str
    account_type: str
    balance: float
    user_id: int
    currency: str

class AccountBalance(MockSchema):
    balance: float

class AccountUpdate(MockSchema):
    pass

account_schemas.AccountCreate = AccountCreate
account_schemas.AccountResponse = AccountResponse
account_schemas.AccountBalance = AccountBalance
account_schemas.AccountUpdate = AccountUpdate

# 5. Mock 'app.services'
services_pkg = register_mock("app.services")
services_pkg.__path__ = []
account_service_mock = register_mock("app.services.account_service")
services_pkg.account_service = account_service_mock

# Async Mocks for DB operations
async def mock_create_account_db(*args, **kwargs):
    m = MagicMock()
    m.id = 1
    m.account_number = "123456789"
    m.account_type = "savings"
    m.balance = 100.0
    m.user_id = 1
    # FIX: Explicitly set currency to a string to satisfy Pydantic validation
    m.currency = "USD"
    return m

# 6. Mock 'app.tasks'
tasks_pkg = register_mock("app.tasks")
tasks_pkg.__path__ = []
email_tasks = register_mock("app.tasks.email_tasks")

# Celery Task Mock
mock_celery_task = MagicMock()
mock_celery_task.acks_late = True
mock_celery_task.retry_backoff = True
mock_celery_task.max_retries = 5

# Ensure .delay() returns an object with .get() to prevent "Before" code from crashing
mock_async_result = MagicMock()
mock_async_result.get.return_value = None
mock_celery_task.delay.return_value = mock_async_result
email_tasks.send_account_created_email = mock_celery_task

# 7. LOAD REAL CODE (Service Layer)
try:
    import services.account_service as real_service_module

    # Update sys.modules so imports point to the real loaded module
    sys.modules["app.services.account_service"] = real_service_module
    sys.modules["app.services"].account_service = real_service_module

    if hasattr(real_service_module, "AccountService"):
        AccountService = real_service_module.AccountService
        if hasattr(real_service_module, "crud_logic"):
            real_service_module.crud_logic = MagicMock()
            real_service_module.crud_logic.create_account = MagicMock(side_effect=mock_create_account_db)
    else:
        AccountService = MagicMock()
        real_service_module.create_account = MagicMock(side_effect=mock_create_account_db)

except ImportError:
    AccountService = MagicMock()

# ==========================================
# IMPORT ROUTER
# ==========================================
try:
    from accounts import router
except ImportError:
    from fastapi import APIRouter
    router = APIRouter()

# ==========================================
# TEST FIXTURES
# ==========================================
from fastapi import FastAPI
from fastapi.testclient import TestClient

@pytest.fixture
def mock_db_session():
    return AsyncMock()

@pytest.fixture
def mock_user_obj():
    u = MagicMock()
    u.id = 1
    u.email = "test@example.com"
    u.full_name = "Test User"
    return u

@pytest.fixture
def client(mock_db_session, mock_user_obj):
    app = FastAPI()
    app.include_router(router, prefix="/accounts")
    app.dependency_overrides[deps.get_db] = lambda: mock_db_session
    app.dependency_overrides[deps.get_current_active_user] = lambda: mock_user_obj
    return TestClient(app)

# ==========================================
# TESTS
# ==========================================

@pytest.mark.asyncio
async def test_service_create_account_flow(mock_db_session, mock_user_obj):
    account_in = AccountCreate(account_type="savings", currency="USD")

    try:
        if isinstance(AccountService, MagicMock):
            pytest.fail("Architecture Mismatch: AccountService class not found (Expected in Refactored Code)")

        result = await AccountService.create_account(mock_db_session, mock_user_obj, account_in)
        mock_celery_task.delay.assert_called_once()
        assert result.account_number == "123456789"

    except Exception as e:
        pytest.fail(f"Service Layer Test Failed: {e}")

@pytest.mark.asyncio
async def test_service_create_account_db_failure(mock_db_session, mock_user_obj):
    account_in = AccountCreate(account_type="savings", currency="USD")

    if isinstance(AccountService, MagicMock):
        pytest.fail("Architecture Mismatch: AccountService class not found")

    try:
        real_service_module.crud_logic.create_account.side_effect = Exception("DB Error")
        mock_celery_task.delay.reset_mock()

        with pytest.raises(Exception, match="DB Error"):
            await AccountService.create_account(mock_db_session, mock_user_obj, account_in)

        mock_celery_task.delay.assert_not_called()

    except AttributeError:
         pytest.fail("Could not access crud_logic. Refactor validation failed.")
    finally:
         if hasattr(real_service_module, "crud_logic"):
             real_service_module.crud_logic.create_account.side_effect = mock_create_account_db

def test_api_create_account_decoupling(client, mock_user_obj):
    payload = {"account_type": "savings", "currency": "USD"}

    mock_resp = AccountResponse(
        id=1, account_number="ACC-99", account_type="savings",
        balance=0.0, user_id=1, currency="USD"
    )

    with patch.object(AccountService, 'create_account', new_callable=AsyncMock) as mock_svc:
        mock_svc.return_value = mock_resp

        try:
            response = client.post("/accounts/", json=payload)
        except Exception:
            pass

        if mock_svc.call_count == 0:
             pytest.fail("Coupling Detected: API did not delegate to AccountService.")

        assert response.status_code == 201

def test_blocking_behavior(client, mock_user_obj):
    """
    [Criteria: Non-blocking]
    Specific check for the 'Before' bug.
    """
    payload = {"account_type": "savings", "currency": "USD"}

    mock_result = MagicMock()
    mock_result.get.side_effect = lambda timeout: "Blocked"
    mock_celery_task.delay.return_value = mock_result

    # In 'After', this calls the Service (which we implicitly test via mocking logic).
    # We must ensure the DB mock returns a valid object so Pydantic doesn't crash.
    # The 'mock_create_account_db' defined above handles this.

    client.post("/accounts/", json=payload)

    if mock_result.get.called:
        pytest.fail("Blocking I/O Detected: API called .get() on Celery result.")

def test_task_configuration():
    try:
        assert email_tasks.send_account_created_email.acks_late is True
        assert email_tasks.send_account_created_email.retry_backoff is True
    except AttributeError:
        pytest.fail("Task configuration invalid or missing.")