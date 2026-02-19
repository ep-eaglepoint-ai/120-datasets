"""
Tests for analytics API optimization.
Tests fail for repository_before (slow), pass for repository_after (fast).
"""
import pytest
import sys
import os
import time
import re

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def get_app():
    """Get the Flask app based on TEST_IMPLEMENTATION environment variable."""
    impl = os.environ.get("TEST_IMPLEMENTATION", "after")
    
    if impl == "before":
        from repository_before.analytics_api import app
    else:
        from repository_after.analytics_api import app
    
    return app


def get_source_path():
    """Get the source file path based on TEST_IMPLEMENTATION."""
    impl = os.environ.get("TEST_IMPLEMENTATION", "after")
    folder = "repository_before" if impl == "before" else "repository_after"
    return os.path.join(os.path.dirname(os.path.dirname(__file__)), folder, "analytics_api.py")


def read_source():
    """Read the source code of the implementation."""
    with open(get_source_path(), "r") as f:
        return f.read()


class TestRequirement1ResponseTime:
    """Requirement 1: Improve API response time."""

    def test_response_time_under_threshold(self):
        """API must respond in under 2 seconds (before has 2.5s+ delays)."""
        app = get_app()
        client = app.test_client()
        
        start = time.time()
        response = client.get("/api/v1/user-analytics/report?user_id=test123")
        elapsed = time.time() - start
        
        assert response.status_code == 200
        assert elapsed < 2.0, f"Response took {elapsed:.2f}s, must be under 2s"

    def test_response_time_under_100ms_for_optimized(self):
        """Optimized API should respond in under 100ms."""
        impl = os.environ.get("TEST_IMPLEMENTATION", "after")
        if impl == "before":
            pytest.skip("Only applies to optimized implementation")
        
        app = get_app()
        client = app.test_client()
        
        start = time.time()
        response = client.get("/api/v1/user-analytics/report?user_id=test123")
        elapsed = time.time() - start
        
        assert response.status_code == 200
        assert elapsed < 0.1, f"Optimized response took {elapsed:.3f}s, should be under 100ms"


class TestRequirement2NoDelays:
    """Requirement 2: Eliminate unnecessary delays."""

    def test_no_artificial_sleep_delays(self):
        """API must not have artificial time.sleep delays."""
        source = read_source()
        sleep_count = source.count("time.sleep")
        assert sleep_count == 0, f"Found {sleep_count} time.sleep calls, must have 0"


class TestRequirement3Complexity:
    """Requirement 3: Reduce computational complexity."""

    def test_no_nested_loop_counting(self):
        """Must not use O(n^2) nested loop for counting events."""
        source = read_source()
        has_nested_loop = "for event in user_events:" in source and "for compare_event in user_events:" in source
        assert not has_nested_loop, "Must not use O(n^2) nested loops for counting"

    def test_no_heavy_iteration_loops(self):
        """Must not have loops iterating 20000 times in request path."""
        impl = os.environ.get("TEST_IMPLEMENTATION", "after")
        if impl == "before":
            pytest.skip("Only applies to optimized implementation")
        
        source = read_source()
        has_20k_loop = "range(20000)" in source or "range(TOTAL_EVENTS)" in source
        has_for_in_loop = re.search(r'for\s+_\s+in\s+range\s*\(\s*(20000|TOTAL_EVENTS)', source)
        assert not has_20k_loop and not has_for_in_loop, "Must not iterate 20000 times per request"

    def test_no_nested_score_calculation(self):
        """Must not have nested loops for score calculation (50 iterations)."""
        impl = os.environ.get("TEST_IMPLEMENTATION", "after")
        if impl == "before":
            pytest.skip("Only applies to optimized implementation")
        
        source = read_source()
        has_nested_random = "for _ in range(50)" in source
        assert not has_nested_random, "Must not have 50-iteration nested loops"


class TestRequirement4MemoryUsage:
    """Requirement 4: Optimize memory usage."""

    def test_no_full_event_list_storage(self):
        """Must not store full 20000 event objects in memory."""
        source = read_source()
        stores_events = "user_events.append(" in source or "user_events = []" in source
        assert not stores_events, "Must not store full event list in memory"


class TestRequirement5ResponseStructure:
    """Requirement 5: Maintain the same API response structure."""

    def test_response_has_required_fields(self):
        """Response must have all required fields."""
        app = get_app()
        client = app.test_client()
        
        response = client.get("/api/v1/user-analytics/report?user_id=test123")
        data = response.get_json()
        
        required_fields = [
            "user_id",
            "report_generated_at",
            "event_counts",
            "total_events",
            "scores_generated",
            "processing_time_seconds",
            "status"
        ]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"

    def test_event_counts_structure(self):
        """Event counts must have click, view, purchase keys."""
        app = get_app()
        client = app.test_client()
        
        response = client.get("/api/v1/user-analytics/report?user_id=test123")
        data = response.get_json()
        
        assert "event_counts" in data
        for event_type in ["click", "view", "purchase"]:
            assert event_type in data["event_counts"], f"Missing event type: {event_type}"

    def test_user_id_preserved(self):
        """User ID from request must be in response."""
        app = get_app()
        client = app.test_client()
        
        response = client.get("/api/v1/user-analytics/report?user_id=myuser123")
        data = response.get_json()
        
        assert data["user_id"] == "myuser123"

    def test_status_completed(self):
        """Status must be 'completed'."""
        app = get_app()
        client = app.test_client()
        
        response = client.get("/api/v1/user-analytics/report?user_id=test")
        data = response.get_json()
        
        assert data["status"] == "completed"

    def test_default_user_id(self):
        """Default user_id should be 'unknown' when not provided."""
        app = get_app()
        client = app.test_client()
        
        response = client.get("/api/v1/user-analytics/report")
        data = response.get_json()
        
        assert data["user_id"] == "unknown"


class TestRequirement6Scalability:
    """Requirement 6: Ensure scalability for concurrent requests."""

    def test_total_events_correct(self):
        """Total events must be 20000."""
        app = get_app()
        client = app.test_client()
        
        response = client.get("/api/v1/user-analytics/report?user_id=test")
        data = response.get_json()
        
        assert data["total_events"] == 20000

    def test_event_counts_sum_to_total(self):
        """Event counts must sum to total events."""
        app = get_app()
        client = app.test_client()
        
        response = client.get("/api/v1/user-analytics/report?user_id=test")
        data = response.get_json()
        
        total_from_counts = sum(data["event_counts"].values())
        assert total_from_counts == data["total_events"], \
            f"Event counts sum ({total_from_counts}) != total_events ({data['total_events']})"

    def test_concurrent_requests_fast(self):
        """Multiple concurrent requests should complete quickly."""
        impl = os.environ.get("TEST_IMPLEMENTATION", "after")
        if impl == "before":
            pytest.skip("Only applies to optimized implementation")
        
        app = get_app()
        client = app.test_client()
        
        start = time.time()
        for _ in range(10):
            response = client.get("/api/v1/user-analytics/report?user_id=test")
            assert response.status_code == 200
        elapsed = time.time() - start
        
        assert elapsed < 1.0, f"10 requests took {elapsed:.2f}s, should be under 1s"


class TestRequirement7CleanCode:
    """Requirement 7: Use clean and efficient Python code."""

    def test_no_string_concatenation_loop(self):
        """Must not use inefficient string concatenation in loop."""
        source = read_source()
        has_audit_log_concat = 'audit_log += ' in source or 'audit_log = ""' in source
        assert not has_audit_log_concat, "Must not use inefficient string concatenation"

    def test_no_debug_mode_in_production(self):
        """Must not have debug=True in production code."""
        impl = os.environ.get("TEST_IMPLEMENTATION", "after")
        if impl == "before":
            pytest.skip("Only applies to optimized implementation")
        
        source = read_source()
        has_debug_true = "debug=True" in source
        assert not has_debug_true, "Must not have debug=True in production code"

    def test_uses_timezone_aware_datetime(self):
        """Must use timezone-aware datetimes."""
        impl = os.environ.get("TEST_IMPLEMENTATION", "after")
        if impl == "before":
            pytest.skip("Only applies to optimized implementation")
        
        source = read_source()
        uses_utcnow = "datetime.utcnow()" in source or "datetime.datetime.utcnow()" in source
        assert not uses_utcnow, "Must use timezone-aware datetime (not utcnow)"

    def test_no_magic_numbers(self):
        """Must not have unexplained magic numbers in request handler."""
        impl = os.environ.get("TEST_IMPLEMENTATION", "after")
        if impl == "before":
            pytest.skip("Only applies to optimized implementation")
        
        source = read_source()
        has_magic_50 = "range(50)" in source
        has_constant_defined = "TOTAL_EVENTS" in source
        
        assert has_constant_defined, "Magic number 20000 should be a named constant (TOTAL_EVENTS)"
        assert not has_magic_50, "Magic number 50 should not appear in loops"

    def test_separation_of_concerns(self):
        """Business logic should be separated from request handler."""
        impl = os.environ.get("TEST_IMPLEMENTATION", "after")
        if impl == "before":
            pytest.skip("Only applies to optimized implementation")
        
        source = read_source()
        has_service_class = "class " in source and "Service" in source
        has_function_separation = source.count("def ") >= 2
        
        assert has_service_class or has_function_separation, \
            "Business logic should be separated (use service class or helper functions)"

    def test_no_random_in_request_path(self):
        """Must not use random in the request path for analytics."""
        impl = os.environ.get("TEST_IMPLEMENTATION", "after")
        if impl == "before":
            pytest.skip("Only applies to optimized implementation")
        
        source = read_source()
        imports_random = "import random" in source
        uses_random = "random.choice" in source or "random.random()" in source
        
        assert not (imports_random and uses_random), \
            "Must not use random generation in request path"


class TestPerformanceMetrics:
    """Additional performance and scalability tests."""

    def test_processing_time_reported(self):
        """Processing time should be reported in response."""
        app = get_app()
        client = app.test_client()
        
        response = client.get("/api/v1/user-analytics/report?user_id=test")
        data = response.get_json()
        
        assert "processing_time_seconds" in data
        assert isinstance(data["processing_time_seconds"], (int, float))

    def test_scores_generated_is_integer(self):
        """scores_generated should be an integer."""
        app = get_app()
        client = app.test_client()
        
        response = client.get("/api/v1/user-analytics/report?user_id=test")
        data = response.get_json()
        
        assert "scores_generated" in data
        assert isinstance(data["scores_generated"], int)

    def test_report_generated_at_is_iso_format(self):
        """report_generated_at should be in ISO format."""
        app = get_app()
        client = app.test_client()
        
        response = client.get("/api/v1/user-analytics/report?user_id=test")
        data = response.get_json()
        
        from datetime import datetime
        timestamp = data["report_generated_at"]
        try:
            datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        except ValueError:
            pytest.fail(f"report_generated_at '{timestamp}' is not valid ISO format")
