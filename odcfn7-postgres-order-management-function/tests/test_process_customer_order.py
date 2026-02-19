"""
Comprehensive tests for the process_customer_order PostgreSQL function.
Tests cover all requirements including validation, edge cases, and error handling.
"""
import pytest
import psycopg2
from psycopg2.extras import RealDictCursor
import psycopg2.extras
import uuid
from datetime import datetime, timezone
import os

# Register UUID adapter for psycopg2
psycopg2.extras.register_uuid()


@pytest.fixture(scope="module")
def db_connection():
    """Create database connection for testing."""
    conn = psycopg2.connect(
        host=os.environ.get("POSTGRES_HOST", "postgres"),
        port=os.environ.get("POSTGRES_PORT", "5432"),
        database=os.environ.get("POSTGRES_DB", "testdb"),
        user=os.environ.get("POSTGRES_USER", "testuser"),
        password=os.environ.get("POSTGRES_PASSWORD", "testpass")
    )
    conn.autocommit = False
    yield conn
    conn.close()


@pytest.fixture(scope="module")
def setup_database(db_connection):
    """Set up database schema and function."""
    cursor = db_connection.cursor()
    
    # Read and execute schema
    schema_path = os.path.join(os.path.dirname(__file__), "..", "repository_after", "schema.sql")
    with open(schema_path, "r") as f:
        schema_sql = f.read()
    cursor.execute(schema_sql)
    
    # Read and execute function
    function_path = os.path.join(os.path.dirname(__file__), "..", "repository_after", "process_customer_order.sql")
    with open(function_path, "r") as f:
        function_sql = f.read()
    cursor.execute(function_sql)
    
    db_connection.commit()
    yield cursor
    cursor.close()


@pytest.fixture(autouse=True)
def clean_tables(db_connection, setup_database):
    """Clean tables before each test."""
    cursor = db_connection.cursor()
    cursor.execute("DELETE FROM order_audit_log")
    cursor.execute("DELETE FROM orders")
    cursor.execute("DELETE FROM inventory")
    cursor.execute("DELETE FROM products")
    cursor.execute("DELETE FROM customers")
    db_connection.commit()
    yield
    db_connection.rollback()


@pytest.fixture
def active_customer(db_connection):
    """Create an active customer for testing."""
    cursor = db_connection.cursor()
    cursor.execute(
        "INSERT INTO customers (name, email, is_active) VALUES (%s, %s, %s) RETURNING customer_id",
        ("Test Customer", "test@example.com", True)
    )
    customer_id = cursor.fetchone()[0]
    db_connection.commit()
    return customer_id


@pytest.fixture
def inactive_customer(db_connection):
    """Create an inactive customer for testing."""
    cursor = db_connection.cursor()
    cursor.execute(
        "INSERT INTO customers (name, email, is_active) VALUES (%s, %s, %s) RETURNING customer_id",
        ("Inactive Customer", "inactive@example.com", False)
    )
    customer_id = cursor.fetchone()[0]
    db_connection.commit()
    return customer_id


@pytest.fixture
def available_product(db_connection):
    """Create an available product for testing."""
    cursor = db_connection.cursor()
    cursor.execute(
        "INSERT INTO products (name, description, unit_price, is_available) VALUES (%s, %s, %s, %s) RETURNING product_id",
        ("Test Product", "A test product", 29.99, True)
    )
    product_id = cursor.fetchone()[0]
    db_connection.commit()
    return product_id


@pytest.fixture
def unavailable_product(db_connection):
    """Create an unavailable product for testing."""
    cursor = db_connection.cursor()
    cursor.execute(
        "INSERT INTO products (name, description, unit_price, is_available) VALUES (%s, %s, %s, %s) RETURNING product_id",
        ("Unavailable Product", "Not for sale", 49.99, False)
    )
    product_id = cursor.fetchone()[0]
    db_connection.commit()
    return product_id


@pytest.fixture
def product_with_inventory(db_connection, available_product):
    """Create a product with inventory for testing."""
    cursor = db_connection.cursor()
    cursor.execute(
        "INSERT INTO inventory (product_id, quantity) VALUES (%s, %s)",
        (available_product, 100)
    )
    db_connection.commit()
    return available_product


@pytest.fixture
def product_with_low_inventory(db_connection, available_product):
    """Create a product with low inventory for testing."""
    cursor = db_connection.cursor()
    cursor.execute(
        "INSERT INTO inventory (product_id, quantity) VALUES (%s, %s)",
        (available_product, 5)
    )
    db_connection.commit()
    return available_product


def call_process_order(cursor, customer_id, product_id, quantity, timestamp, request_id):
    """Helper function to call the process_customer_order function."""
    cursor.execute(
        "SELECT * FROM process_customer_order(%s, %s, %s, %s, %s)",
        (customer_id, product_id, quantity, timestamp, request_id)
    )
    return cursor.fetchone()


class TestSuccessfulOrderProcessing:
    """Tests for successful order processing scenarios."""

    def test_successful_order_creation(self, db_connection, active_customer, product_with_inventory):
        """Test that a valid order is created successfully."""
        cursor = db_connection.cursor(cursor_factory=RealDictCursor)
        request_id = uuid.uuid4()
        timestamp = datetime.now(timezone.utc)
        
        result = call_process_order(cursor, active_customer, product_with_inventory, 5, timestamp, request_id)
        db_connection.commit()
        
        assert result["success"] is True
        assert result["order_id"] is not None
        assert result["error_code"] == "00000"
        assert "successfully" in result["message"].lower()

    def test_order_has_pending_status(self, db_connection, active_customer, product_with_inventory):
        """Test that a new order has PENDING status."""
        cursor = db_connection.cursor(cursor_factory=RealDictCursor)
        request_id = uuid.uuid4()
        timestamp = datetime.now(timezone.utc)
        
        result = call_process_order(cursor, active_customer, product_with_inventory, 3, timestamp, request_id)
        db_connection.commit()
        
        cursor.execute("SELECT status FROM orders WHERE order_id = %s", (result["order_id"],))
        order = cursor.fetchone()
        assert order["status"] == "PENDING"

    def test_inventory_is_deducted(self, db_connection, active_customer, product_with_inventory):
        """Test that inventory is properly deducted after order."""
        cursor = db_connection.cursor(cursor_factory=RealDictCursor)
        request_id = uuid.uuid4()
        timestamp = datetime.now(timezone.utc)
        
        cursor.execute("SELECT quantity FROM inventory WHERE product_id = %s", (product_with_inventory,))
        initial_quantity = cursor.fetchone()["quantity"]
        
        order_quantity = 10
        call_process_order(cursor, active_customer, product_with_inventory, order_quantity, timestamp, request_id)
        db_connection.commit()
        
        cursor.execute("SELECT quantity FROM inventory WHERE product_id = %s", (product_with_inventory,))
        final_quantity = cursor.fetchone()["quantity"]
        
        assert final_quantity == initial_quantity - order_quantity

    def test_total_price_calculation(self, db_connection, active_customer, product_with_inventory):
        """Test that total price is calculated correctly."""
        cursor = db_connection.cursor(cursor_factory=RealDictCursor)
        request_id = uuid.uuid4()
        timestamp = datetime.now(timezone.utc)
        
        cursor.execute("SELECT unit_price FROM products WHERE product_id = %s", (product_with_inventory,))
        unit_price = float(cursor.fetchone()["unit_price"])
        
        order_quantity = 7
        result = call_process_order(cursor, active_customer, product_with_inventory, order_quantity, timestamp, request_id)
        db_connection.commit()
        
        cursor.execute("SELECT total_price FROM orders WHERE order_id = %s", (result["order_id"],))
        total_price = float(cursor.fetchone()["total_price"])
        
        expected_price = round(unit_price * order_quantity, 2)
        assert abs(total_price - expected_price) < 0.01

    def test_audit_log_created_on_success(self, db_connection, active_customer, product_with_inventory):
        """Test that an audit log entry is created on successful order."""
        cursor = db_connection.cursor(cursor_factory=RealDictCursor)
        request_id = uuid.uuid4()
        timestamp = datetime.now(timezone.utc)
        
        result = call_process_order(cursor, active_customer, product_with_inventory, 2, timestamp, request_id)
        db_connection.commit()
        
        cursor.execute("SELECT * FROM order_audit_log WHERE request_id = %s", (str(request_id),))
        log_entry = cursor.fetchone()
        
        assert log_entry is not None
        assert log_entry["status"] == "SUCCESS"
        assert log_entry["order_id"] == result["order_id"]


class TestCustomerValidation:
    """Tests for customer validation."""

    def test_customer_not_found(self, db_connection, product_with_inventory):
        """Test error when customer does not exist."""
        cursor = db_connection.cursor(cursor_factory=RealDictCursor)
        request_id = uuid.uuid4()
        timestamp = datetime.now(timezone.utc)
        
        result = call_process_order(cursor, 99999, product_with_inventory, 1, timestamp, request_id)
        db_connection.commit()
        
        assert result["success"] is False
        assert result["error_code"] == "P0002"
        assert "customer" in result["message"].lower()

    def test_inactive_customer_rejected(self, db_connection, inactive_customer, product_with_inventory):
        """Test error when customer is inactive."""
        cursor = db_connection.cursor(cursor_factory=RealDictCursor)
        request_id = uuid.uuid4()
        timestamp = datetime.now(timezone.utc)
        
        result = call_process_order(cursor, inactive_customer, product_with_inventory, 1, timestamp, request_id)
        db_connection.commit()
        
        assert result["success"] is False
        assert result["error_code"] == "23514"
        assert "inactive" in result["message"].lower() or "not active" in result["message"].lower()


class TestProductValidation:
    """Tests for product validation."""

    def test_product_not_found(self, db_connection, active_customer):
        """Test error when product does not exist."""
        cursor = db_connection.cursor(cursor_factory=RealDictCursor)
        request_id = uuid.uuid4()
        timestamp = datetime.now(timezone.utc)
        
        # Create inventory for a non-existent product won't work, so just test without
        result = call_process_order(cursor, active_customer, 99999, 1, timestamp, request_id)
        db_connection.commit()
        
        assert result["success"] is False
        assert result["error_code"] == "P0002"
        assert "product" in result["message"].lower()

    def test_unavailable_product_rejected(self, db_connection, active_customer, unavailable_product):
        """Test error when product is not available for sale."""
        cursor = db_connection.cursor(cursor_factory=RealDictCursor)
        
        # Add inventory for the unavailable product
        cursor.execute("INSERT INTO inventory (product_id, quantity) VALUES (%s, %s)", (unavailable_product, 100))
        db_connection.commit()
        
        request_id = uuid.uuid4()
        timestamp = datetime.now(timezone.utc)
        
        result = call_process_order(cursor, active_customer, unavailable_product, 1, timestamp, request_id)
        db_connection.commit()
        
        assert result["success"] is False
        assert result["error_code"] == "23514"
        assert "unavailable" in result["message"].lower() or "not available" in result["message"].lower()


class TestInventoryValidation:
    """Tests for inventory validation."""

    def test_insufficient_inventory(self, db_connection, active_customer, product_with_low_inventory):
        """Test error when inventory is insufficient."""
        cursor = db_connection.cursor(cursor_factory=RealDictCursor)
        request_id = uuid.uuid4()
        timestamp = datetime.now(timezone.utc)
        
        result = call_process_order(cursor, active_customer, product_with_low_inventory, 50, timestamp, request_id)
        db_connection.commit()
        
        assert result["success"] is False
        assert result["error_code"] == "55000"
        assert "insufficient" in result["message"].lower() or "not enough" in result["message"].lower()

    def test_inventory_not_found(self, db_connection, active_customer, available_product):
        """Test error when no inventory record exists for product."""
        cursor = db_connection.cursor(cursor_factory=RealDictCursor)
        request_id = uuid.uuid4()
        timestamp = datetime.now(timezone.utc)
        
        # No inventory created for available_product
        result = call_process_order(cursor, active_customer, available_product, 1, timestamp, request_id)
        db_connection.commit()
        
        assert result["success"] is False
        assert result["error_code"] == "P0002"
        assert "inventory" in result["message"].lower()

    def test_exact_inventory_amount_succeeds(self, db_connection, active_customer, product_with_low_inventory):
        """Test ordering exactly the available inventory amount."""
        cursor = db_connection.cursor(cursor_factory=RealDictCursor)
        request_id = uuid.uuid4()
        timestamp = datetime.now(timezone.utc)
        
        # product_with_low_inventory has 5 items
        result = call_process_order(cursor, active_customer, product_with_low_inventory, 5, timestamp, request_id)
        db_connection.commit()
        
        assert result["success"] is True
        
        cursor.execute("SELECT quantity FROM inventory WHERE product_id = %s", (product_with_low_inventory,))
        remaining = cursor.fetchone()["quantity"]
        assert remaining == 0


class TestDuplicateRequestPrevention:
    """Tests for duplicate request prevention."""

    def test_duplicate_request_rejected(self, db_connection, active_customer, product_with_inventory):
        """Test that duplicate request_id is rejected."""
        cursor = db_connection.cursor(cursor_factory=RealDictCursor)
        request_id = uuid.uuid4()
        timestamp = datetime.now(timezone.utc)
        
        # First order succeeds
        result1 = call_process_order(cursor, active_customer, product_with_inventory, 1, timestamp, request_id)
        db_connection.commit()
        assert result1["success"] is True
        
        # Second order with same request_id fails
        result2 = call_process_order(cursor, active_customer, product_with_inventory, 1, timestamp, request_id)
        db_connection.commit()
        
        assert result2["success"] is False
        assert result2["error_code"] == "23505"
        assert "duplicate" in result2["message"].lower()

    def test_different_request_ids_succeed(self, db_connection, active_customer, product_with_inventory):
        """Test that different request_ids create separate orders."""
        cursor = db_connection.cursor(cursor_factory=RealDictCursor)
        timestamp = datetime.now(timezone.utc)
        
        result1 = call_process_order(cursor, active_customer, product_with_inventory, 1, timestamp, uuid.uuid4())
        db_connection.commit()
        
        result2 = call_process_order(cursor, active_customer, product_with_inventory, 1, timestamp, uuid.uuid4())
        db_connection.commit()
        
        assert result1["success"] is True
        assert result2["success"] is True
        assert result1["order_id"] != result2["order_id"]


class TestInputValidation:
    """Tests for input validation and edge cases."""

    def test_negative_quantity_rejected(self, db_connection, active_customer, product_with_inventory):
        """Test that negative quantity is rejected."""
        cursor = db_connection.cursor(cursor_factory=RealDictCursor)
        request_id = uuid.uuid4()
        timestamp = datetime.now(timezone.utc)
        
        result = call_process_order(cursor, active_customer, product_with_inventory, -5, timestamp, request_id)
        db_connection.commit()
        
        assert result["success"] is False
        assert result["error_code"] == "2201W"
        assert "quantity" in result["message"].lower()

    def test_zero_quantity_rejected(self, db_connection, active_customer, product_with_inventory):
        """Test that zero quantity is rejected."""
        cursor = db_connection.cursor(cursor_factory=RealDictCursor)
        request_id = uuid.uuid4()
        timestamp = datetime.now(timezone.utc)
        
        result = call_process_order(cursor, active_customer, product_with_inventory, 0, timestamp, request_id)
        db_connection.commit()
        
        assert result["success"] is False
        assert result["error_code"] == "2201W"

    def test_null_customer_id_rejected(self, db_connection, product_with_inventory):
        """Test that null customer_id is rejected."""
        cursor = db_connection.cursor(cursor_factory=RealDictCursor)
        request_id = uuid.uuid4()
        timestamp = datetime.now(timezone.utc)
        
        result = call_process_order(cursor, None, product_with_inventory, 1, timestamp, request_id)
        db_connection.commit()
        
        assert result["success"] is False
        assert result["error_code"] == "22023"

    def test_null_product_id_rejected(self, db_connection, active_customer):
        """Test that null product_id is rejected."""
        cursor = db_connection.cursor(cursor_factory=RealDictCursor)
        request_id = uuid.uuid4()
        timestamp = datetime.now(timezone.utc)
        
        result = call_process_order(cursor, active_customer, None, 1, timestamp, request_id)
        db_connection.commit()
        
        assert result["success"] is False
        assert result["error_code"] == "22023"

    def test_null_quantity_rejected(self, db_connection, active_customer, product_with_inventory):
        """Test that null quantity is rejected."""
        cursor = db_connection.cursor(cursor_factory=RealDictCursor)
        request_id = uuid.uuid4()
        timestamp = datetime.now(timezone.utc)
        
        result = call_process_order(cursor, active_customer, product_with_inventory, None, timestamp, request_id)
        db_connection.commit()
        
        assert result["success"] is False
        assert result["error_code"] == "22023"


class TestAuditLogging:
    """Tests for audit log functionality."""

    def test_audit_log_on_failure(self, db_connection, active_customer):
        """Test that audit log is created on failure."""
        cursor = db_connection.cursor(cursor_factory=RealDictCursor)
        request_id = uuid.uuid4()
        timestamp = datetime.now(timezone.utc)
        
        # This should fail (product not found)
        call_process_order(cursor, active_customer, 99999, 1, timestamp, request_id)
        db_connection.commit()
        
        cursor.execute("SELECT * FROM order_audit_log WHERE request_id = %s", (str(request_id),))
        log_entry = cursor.fetchone()
        
        assert log_entry is not None
        assert log_entry["status"] == "FAILED"
        assert log_entry["error_code"] is not None

    def test_audit_log_contains_details(self, db_connection, active_customer, product_with_inventory):
        """Test that audit log contains detailed information."""
        cursor = db_connection.cursor(cursor_factory=RealDictCursor)
        request_id = uuid.uuid4()
        timestamp = datetime.now(timezone.utc)
        
        call_process_order(cursor, active_customer, product_with_inventory, 3, timestamp, request_id)
        db_connection.commit()
        
        cursor.execute("SELECT * FROM order_audit_log WHERE request_id = %s", (str(request_id),))
        log_entry = cursor.fetchone()
        
        assert log_entry["customer_id"] == active_customer
        assert log_entry["product_id"] == product_with_inventory
        assert log_entry["action"] == "PROCESS_ORDER"
        assert log_entry["details"] is not None


class TestTransactionalBehavior:
    """Tests for transactional behavior."""

    def test_failed_order_does_not_affect_inventory(self, db_connection, active_customer, product_with_low_inventory):
        """Test that failed order does not deduct inventory."""
        cursor = db_connection.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("SELECT quantity FROM inventory WHERE product_id = %s", (product_with_low_inventory,))
        initial_quantity = cursor.fetchone()["quantity"]
        
        request_id = uuid.uuid4()
        timestamp = datetime.now(timezone.utc)
        
        # Try to order more than available (should fail)
        result = call_process_order(cursor, active_customer, product_with_low_inventory, 100, timestamp, request_id)
        db_connection.commit()
        
        assert result["success"] is False
        
        cursor.execute("SELECT quantity FROM inventory WHERE product_id = %s", (product_with_low_inventory,))
        final_quantity = cursor.fetchone()["quantity"]
        
        assert final_quantity == initial_quantity

    def test_multiple_orders_sequential(self, db_connection, active_customer, product_with_inventory):
        """Test multiple sequential orders work correctly."""
        cursor = db_connection.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("SELECT quantity FROM inventory WHERE product_id = %s", (product_with_inventory,))
        initial_quantity = cursor.fetchone()["quantity"]
        
        timestamp = datetime.now(timezone.utc)
        
        # Place multiple orders
        for i in range(5):
            result = call_process_order(cursor, active_customer, product_with_inventory, 10, timestamp, uuid.uuid4())
            db_connection.commit()
            assert result["success"] is True
        
        cursor.execute("SELECT quantity FROM inventory WHERE product_id = %s", (product_with_inventory,))
        final_quantity = cursor.fetchone()["quantity"]
        
        assert final_quantity == initial_quantity - 50
