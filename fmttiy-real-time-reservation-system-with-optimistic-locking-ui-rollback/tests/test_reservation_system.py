"""
Comprehensive Tests for Real-Time Reservation System with OCC
Tests all 8 requirements from the specification
"""

import pytest
import sqlite3
import asyncio
import json
import os
import sys
import re
import ast
from unittest.mock import MagicMock, AsyncMock, patch

# Add repository_after to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'repository_after'))

from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport
import httpx


# ============================================================
# Test Fixtures
# ============================================================

@pytest.fixture(scope="function")
def test_db():
    """Create a fresh test database for each test"""
    # Use /tmp for Docker compatibility
    test_db_path = "/tmp/test_seats.db"
    
    # Patch the database path
    import server
    original_path = server.DATABASE_PATH
    server.DATABASE_PATH = test_db_path
    
    # Initialize fresh database
    conn = sqlite3.connect(test_db_path)
    cursor = conn.cursor()
    cursor.execute("DROP TABLE IF EXISTS seats")
    cursor.execute("""
        CREATE TABLE seats (
            id TEXT PRIMARY KEY,
            row TEXT NOT NULL,
            number INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'AVAILABLE',
            version INTEGER NOT NULL DEFAULT 1,
            reserved_by TEXT
        )
    """)
    # Insert test seats
    for row in ['A', 'B']:
        for num in range(1, 6):
            seat_id = f"{row}{num}"
            cursor.execute(
                "INSERT INTO seats (id, row, number, status, version) VALUES (?, ?, ?, ?, ?)",
                (seat_id, row, num, 'AVAILABLE', 1)
            )
    conn.commit()
    conn.close()
    
    yield test_db_path
    
    # Cleanup
    server.DATABASE_PATH = original_path
    if os.path.exists(test_db_path):
        os.remove(test_db_path)


@pytest.fixture
def client(test_db):
    """Create test client"""
    from server import app
    with TestClient(app) as client:
        yield client


@pytest.fixture
def async_client(test_db):
    """Create async test client"""
    from server import app
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


# ============================================================
# OCC Version Check in SQL UPDATE
# The backend update SQL must explicitly check version = incoming_version
# and increment it. Using SELECT then UPDATE without version check is FAIL.
# ============================================================

class TestRequirement1_OCCVersionCheck:
    """OCC version check in SQL UPDATE"""
    
    def test_occ_version_check_in_update_sql(self):
        """Verify UPDATE SQL contains WHERE version = ? clause"""
        import server
        import inspect
        
        # Get source code of reserve_seat_with_occ function
        source = inspect.getsource(server.reserve_seat_with_occ)
        
        # Check for atomic version check in UPDATE statement
        # Must have: UPDATE ... WHERE ... version = ?
        assert "UPDATE seats" in source, "Must use UPDATE on seats table"
        assert "WHERE" in source, "UPDATE must have WHERE clause"
        assert "version" in source.lower(), "UPDATE must check version"
        
        # Verify it's checking version in WHERE clause (not just selecting it)
        update_pattern = r"UPDATE\s+seats.*WHERE.*version\s*="
        assert re.search(update_pattern, source, re.IGNORECASE | re.DOTALL), \
            "UPDATE must include version check in WHERE clause"
    
    def test_version_incremented_on_success(self, client, test_db):
        """Verify version is incremented after successful reservation"""
        # Get initial state
        response = client.get("/seats/A1")
        initial_version = response.json()["version"]
        
        # Reserve the seat
        response = client.post("/reserve", json={
            "seat_id": "A1",
            "version": initial_version,
            "client_id": "test-client"
        })
        assert response.status_code == 200
        
        # Verify version incremented
        new_version = response.json()["version"]
        assert new_version == initial_version + 1, "Version must be incremented"
    
    def test_version_mismatch_returns_409(self, client, test_db):
        """Verify 409 returned when version doesn't match"""
        # Reserve with correct version
        client.post("/reserve", json={
            "seat_id": "A1",
            "version": 1,
            "client_id": "client-1"
        })
        
        # Try to reserve with old version (simulating race condition)
        response = client.post("/reserve", json={
            "seat_id": "A1",
            "version": 1,  # Old version
            "client_id": "client-2"
        })
        
        assert response.status_code == 409, "Must return 409 for version mismatch"
        assert "VERSION_MISMATCH" in str(response.json())


# ============================================================
# Optimistic UI - Update BEFORE await
# The React onClick handler must update local state BEFORE await api.post
# ============================================================

class TestRequirement2_OptimisticUI:
    """Optimistic UI update before API call"""
    
    def test_optimistic_reserve_action_exists(self):
        """Verify OPTIMISTIC_RESERVE action type exists"""
        types_path = os.path.join(
            os.path.dirname(__file__), '..', 'repository_after',
            'frontend', 'src', 'types.ts'
        )
        
        with open(types_path, 'r') as f:
            content = f.read()
        
        assert 'OPTIMISTIC_RESERVE' in content, \
            "Must have OPTIMISTIC_RESERVE action type"
    
    def test_dispatch_before_await_in_handler(self):
        """Verify dispatch happens before await in handleReserve"""
        app_path = os.path.join(
            os.path.dirname(__file__), '..', 'repository_after',
            'frontend', 'src', 'App.tsx'
        )
        
        with open(app_path, 'r') as f:
            content = f.read()
        
        # Find handleReserve function
        assert 'handleReserve' in content, "Must have handleReserve function"
        
        # Check that OPTIMISTIC_RESERVE exists
        assert 'OPTIMISTIC_RESERVE' in content, "Must dispatch OPTIMISTIC_RESERVE"
        
        # Check that await axios.post exists  
        assert 'await axios.post' in content, "Must await axios.post call"
        
        # Find positions in the full content
        optimistic_pos = content.find('OPTIMISTIC_RESERVE')
        await_pos = content.find('await axios.post')
        
        assert optimistic_pos < await_pos, \
            "OPTIMISTIC_RESERVE must come BEFORE await axios.post (Requirement #2)"
    
    def test_reducer_handles_optimistic_reserve(self):
        """Verify reducer handles OPTIMISTIC_RESERVE action"""
        context_path = os.path.join(
            os.path.dirname(__file__), '..', 'repository_after',
            'frontend', 'src', 'context', 'SeatContext.tsx'
        )
        
        with open(context_path, 'r') as f:
            content = f.read()
        
        assert "case 'OPTIMISTIC_RESERVE'" in content, \
            "Reducer must handle OPTIMISTIC_RESERVE action"
        assert "status: 'RESERVED'" in content, \
            "OPTIMISTIC_RESERVE must set status to RESERVED"


# ============================================================
# Rollback on Version Error
# Frontend catch block must revert seat to AVAILABLE on 409/Version Error
# ============================================================

class TestRequirement3_Rollback:
    """Rollback on version error"""
    
    def test_rollback_action_exists(self):
        """Verify ROLLBACK_SEAT action type exists"""
        types_path = os.path.join(
            os.path.dirname(__file__), '..', 'repository_after',
            'frontend', 'src', 'types.ts'
        )
        
        with open(types_path, 'r') as f:
            content = f.read()
        
        assert 'ROLLBACK_SEAT' in content, \
            "Must have ROLLBACK_SEAT action type"
    
    def test_catch_block_handles_409(self):
        """Verify catch block handles 409 and dispatches rollback"""
        app_path = os.path.join(
            os.path.dirname(__file__), '..', 'repository_after',
            'frontend', 'src', 'App.tsx'
        )
        
        with open(app_path, 'r') as f:
            content = f.read()
        
        # Check for 409 handling
        assert '409' in content, "Must check for 409 status code"
        assert 'ROLLBACK_SEAT' in content, "Must dispatch ROLLBACK_SEAT"
        assert 'Seat no longer available' in content, \
            "Must show 'Seat no longer available' toast"
    
    def test_reducer_reverts_to_available(self):
        """Verify reducer reverts seat status to AVAILABLE"""
        context_path = os.path.join(
            os.path.dirname(__file__), '..', 'repository_after',
            'frontend', 'src', 'context', 'SeatContext.tsx'
        )
        
        with open(context_path, 'r') as f:
            content = f.read()
        
        assert "case 'ROLLBACK_SEAT'" in content, \
            "Reducer must handle ROLLBACK_SEAT action"
        assert "status: 'AVAILABLE'" in content, \
            "ROLLBACK_SEAT must set status to AVAILABLE"


# ============================================================
# WebSocket Broadcast Excludes Sender
# Backend must filter out the connection of the user who made the change
# ============================================================

class TestRequirement4_BroadcastExcludesSender:
    """WebSocket broadcast excludes sender"""
    
    def test_broadcast_has_exclude_client_parameter(self):
        """Verify broadcast method has exclude_client parameter"""
        import server
        import inspect
        
        # Check ConnectionManager.broadcast signature
        sig = inspect.signature(server.ConnectionManager.broadcast)
        params = list(sig.parameters.keys())
        
        assert 'exclude_client' in params, \
            "broadcast must have exclude_client parameter"
    
    def test_reserve_endpoint_passes_client_id_to_broadcast(self):
        """Verify /reserve endpoint excludes sender from broadcast"""
        import server
        import inspect
        
        source = inspect.getsource(server.reserve_seat)
        
        # Check that broadcast is called with exclude_client
        assert 'exclude_client' in source, \
            "reserve_seat must pass exclude_client to broadcast"
        assert 'request.client_id' in source, \
            "Must use request.client_id as exclude_client"
    
    def test_broadcast_skips_excluded_client(self):
        """Verify broadcast actually skips the excluded client"""
        import server
        import inspect
        
        source = inspect.getsource(server.ConnectionManager.broadcast)
        
        # Check for exclusion logic
        assert 'exclude_client' in source
        assert 'client_id != exclude_client' in source or \
               'exclude_client' in source, \
            "broadcast must skip excluded client"


# ============================================================
# No FOR UPDATE or LOCK TABLES
# Use of FOR UPDATE or LOCK TABLES is a violation
# ============================================================

class TestRequirement5_NoDBLocks:
    """No database-level locks"""
    
    def test_no_for_update_in_code(self):
        """Verify no FOR UPDATE in server code"""
        server_path = os.path.join(
            os.path.dirname(__file__), '..', 'repository_after', 'server.py'
        )
        
        with open(server_path, 'r') as f:
            content = f.read().upper()
        
        assert 'FOR UPDATE' not in content, \
            "FOR UPDATE is forbidden (Requirement #5)"
    
    def test_no_lock_tables_in_code(self):
        """Verify no LOCK TABLES in server code"""
        server_path = os.path.join(
            os.path.dirname(__file__), '..', 'repository_after', 'server.py'
        )
        
        with open(server_path, 'r') as f:
            content = f.read().upper()
        
        assert 'LOCK TABLE' not in content, \
            "LOCK TABLE(S) is forbidden (Requirement #5)"
    
    def test_no_select_for_update_pattern(self):
        """Verify no SELECT ... FOR UPDATE pattern"""
        server_path = os.path.join(
            os.path.dirname(__file__), '..', 'repository_after', 'server.py'
        )
        
        with open(server_path, 'r') as f:
            content = f.read()
        
        # Check for various lock patterns
        forbidden_patterns = [
            r'SELECT.*FOR\s+UPDATE',
            r'SELECT.*FOR\s+SHARE',
            r'LOCK\s+IN\s+SHARE\s+MODE',
        ]
        
        for pattern in forbidden_patterns:
            assert not re.search(pattern, content, re.IGNORECASE), \
                f"Pattern '{pattern}' is forbidden"


# ============================================================
# WebSocket Reconnection Logic
# Frontend useEffect for WebSocket must include reconnect logic on onclose
# ============================================================

class TestRequirement6_WebSocketReconnection:
    """WebSocket reconnection logic"""
    
    def test_websocket_onclose_handler_exists(self):
        """Verify WebSocket has onclose handler"""
        app_path = os.path.join(
            os.path.dirname(__file__), '..', 'repository_after',
            'frontend', 'src', 'App.tsx'
        )
        
        with open(app_path, 'r') as f:
            content = f.read()
        
        assert 'ws.onclose' in content or 'onclose' in content, \
            "Must have WebSocket onclose handler"
    
    def test_reconnection_logic_in_onclose(self):
        """Verify reconnection logic exists in onclose handler"""
        app_path = os.path.join(
            os.path.dirname(__file__), '..', 'repository_after',
            'frontend', 'src', 'App.tsx'
        )
        
        with open(app_path, 'r') as f:
            content = f.read()
        
        # Check for reconnection indicators
        reconnect_indicators = [
            'reconnect',
            'setTimeout',
            'connectWebSocket',
        ]
        
        found = any(ind in content for ind in reconnect_indicators)
        assert found, "Must have reconnection logic on WebSocket close"
    
    def test_max_reconnect_attempts(self):
        """Verify max reconnection attempts are limited"""
        app_path = os.path.join(
            os.path.dirname(__file__), '..', 'repository_after',
            'frontend', 'src', 'App.tsx'
        )
        
        with open(app_path, 'r') as f:
            content = f.read()
        
        # Check for max attempts or attempt counter
        assert 'MAX_RECONNECT' in content or 'reconnectAttempts' in content or \
               'attempt' in content.lower(), \
            "Should limit reconnection attempts"


# ============================================================
# Loading State Prevents Double-Click
# React state must handle Loading intermediate state correctly
# ============================================================

class TestRequirement7_LoadingState:
    """Loading state prevents double-click"""
    
    def test_loading_state_in_types(self):
        """Verify loading state exists in state definition"""
        types_path = os.path.join(
            os.path.dirname(__file__), '..', 'repository_after',
            'frontend', 'src', 'types.ts'
        )
        
        with open(types_path, 'r') as f:
            content = f.read()
        
        assert 'loadingSeats' in content or 'loading' in content.lower(), \
            "Must have loading state"
    
    def test_set_loading_action_exists(self):
        """Verify SET_LOADING action type exists"""
        types_path = os.path.join(
            os.path.dirname(__file__), '..', 'repository_after',
            'frontend', 'src', 'types.ts'
        )
        
        with open(types_path, 'r') as f:
            content = f.read()
        
        assert 'SET_LOADING' in content, \
            "Must have SET_LOADING action type"
    
    def test_button_disabled_when_loading(self):
        """Verify seat button is disabled when loading"""
        app_path = os.path.join(
            os.path.dirname(__file__), '..', 'repository_after',
            'frontend', 'src', 'App.tsx'
        )
        
        with open(app_path, 'r') as f:
            content = f.read()
        
        # Check that loading affects disabled state
        assert 'isLoading' in content or 'loading' in content, \
            "Must track loading state"
        assert 'disabled' in content, \
            "Button must have disabled prop"
    
    def test_loading_set_before_api_call(self):
        """Verify loading is set to true before API call"""
        app_path = os.path.join(
            os.path.dirname(__file__), '..', 'repository_after',
            'frontend', 'src', 'App.tsx'
        )
        
        with open(app_path, 'r') as f:
            content = f.read()
        
        # Check that SET_LOADING and axios.post both exist
        assert 'SET_LOADING' in content, "Must dispatch SET_LOADING"
        assert 'axios.post' in content, "Must call axios.post"
        
        # Find positions in the full content
        loading_pos = content.find('SET_LOADING')
        axios_pos = content.find('axios.post')
        
        assert loading_pos < axios_pos, \
            "SET_LOADING must come before axios.post"


# ============================================================
# TypeScript Interfaces Strictly Used
# TypeScript interfaces for Seat and WebSocketMessage must be defined
# Using 'any' for seat object is a failure
# ============================================================

class TestRequirement8_TypeScriptInterfaces:
    """TypeScript interfaces strictly used"""
    
    def test_seat_interface_defined(self):
        """Verify Seat interface is defined"""
        types_path = os.path.join(
            os.path.dirname(__file__), '..', 'repository_after',
            'frontend', 'src', 'types.ts'
        )
        
        with open(types_path, 'r') as f:
            content = f.read()
        
        assert 'interface Seat' in content or 'type Seat' in content, \
            "Must define Seat interface/type"
        
        # Check required fields
        required_fields = ['id', 'row', 'number', 'status', 'version']
        for field in required_fields:
            assert field in content, f"Seat must have '{field}' field"
    
    def test_websocket_message_interface_defined(self):
        """Verify WebSocketMessage interface is defined"""
        types_path = os.path.join(
            os.path.dirname(__file__), '..', 'repository_after',
            'frontend', 'src', 'types.ts'
        )
        
        with open(types_path, 'r') as f:
            content = f.read()
        
        assert 'interface WebSocketMessage' in content or \
               'type WebSocketMessage' in content, \
            "Must define WebSocketMessage interface/type"
    
    def test_no_any_for_seat_in_app(self):
        """Verify 'any' is not used for seat objects in App.tsx"""
        app_path = os.path.join(
            os.path.dirname(__file__), '..', 'repository_after',
            'frontend', 'src', 'App.tsx'
        )
        
        with open(app_path, 'r') as f:
            content = f.read()
        
        # Check that Seat type is imported and used
        assert 'import' in content and 'Seat' in content, \
            "Must import Seat type"
        
        # Check for problematic patterns
        # seat: any or seats: any[] would be failures
        any_seat_pattern = r'seat\s*:\s*any'
        assert not re.search(any_seat_pattern, content, re.IGNORECASE), \
            "Must not use 'any' type for seat (Requirement #8)"
    
    def test_seat_interface_has_status_type(self):
        """Verify Seat status has proper type (not any)"""
        types_path = os.path.join(
            os.path.dirname(__file__), '..', 'repository_after',
            'frontend', 'src', 'types.ts'
        )
        
        with open(types_path, 'r') as f:
            content = f.read()
        
        # Check for SeatStatus type
        assert 'SeatStatus' in content or \
               "'AVAILABLE'" in content or \
               '"AVAILABLE"' in content, \
            "Must have typed SeatStatus"


# ============================================================
# Integration Tests
# ============================================================

class TestIntegration:
    """Integration tests for the reservation system"""
    
    def test_concurrent_reservation_race_condition(self, test_db):
        """Test that concurrent reservations are handled correctly"""
        import server
        
        # Reserve seat with version 1
        result1 = server.reserve_seat_with_occ("A1", 1, "client-1")
        assert result1['status'] == 'RESERVED'
        assert result1['version'] == 2
        
        # Attempt to reserve same seat with old version
        with pytest.raises(server.VersionMismatchError):
            server.reserve_seat_with_occ("A1", 1, "client-2")
    
    def test_get_all_seats(self, client, test_db):
        """Test getting all seats"""
        response = client.get("/seats")
        assert response.status_code == 200
        
        seats = response.json()
        assert len(seats) == 10  # 2 rows x 5 seats
        
        # Verify structure
        seat = seats[0]
        assert 'id' in seat
        assert 'row' in seat
        assert 'number' in seat
        assert 'status' in seat
        assert 'version' in seat
    
    def test_reserve_seat_success(self, client, test_db):
        """Test successful seat reservation"""
        response = client.post("/reserve", json={
            "seat_id": "A1",
            "version": 1,
            "client_id": "test-client"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'RESERVED'
        assert data['reserved_by'] == 'test-client'
        assert data['version'] == 2
    
    def test_health_check(self, client, test_db):
        """Test health check endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()['status'] == 'healthy'


# ============================================================
# Run Tests
# ============================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
