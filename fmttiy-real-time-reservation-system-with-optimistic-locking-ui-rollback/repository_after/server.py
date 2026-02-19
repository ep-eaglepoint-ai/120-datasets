"""
Real-Time Reservation System with Optimistic Concurrency Control (OCC)
FastAPI backend with SQLite and WebSocket support
"""

import sqlite3
import json
import uuid
from typing import Dict, List, Optional, Set
from contextlib import contextmanager
from dataclasses import dataclass, asdict
from enum import Enum

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


# ============================================================
# Custom Exceptions
# ============================================================

class VersionMismatchError(Exception):
    """Raised when optimistic lock version doesn't match"""
    def __init__(self, seat_id: str, expected_version: int, actual_version: int):
        self.seat_id = seat_id
        self.expected_version = expected_version
        self.actual_version = actual_version
        super().__init__(
            f"Version mismatch for seat {seat_id}: "
            f"expected {expected_version}, got {actual_version}"
        )


# ============================================================
# Data Models
# ============================================================

class SeatStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    RESERVED = "RESERVED"


class ReservationRequest(BaseModel):
    seat_id: str
    version: int
    client_id: str


class SeatResponse(BaseModel):
    id: str
    row: str
    number: int
    status: SeatStatus
    version: int
    reserved_by: Optional[str] = None


class WebSocketMessage(BaseModel):
    type: str  # "SEAT_UPDATE" | "INITIAL_STATE" | "ERROR"
    payload: dict


# ============================================================
# Database Setup
# ============================================================

DATABASE_PATH = "seats.db"


def get_db_connection():
    """Create a new database connection"""
    conn = sqlite3.connect(DATABASE_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def get_db():
    """Context manager for database connections"""
    conn = get_db_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_database():
    """Initialize database with seats table and sample data"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Create seats table with version column for OCC
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS seats (
                id TEXT PRIMARY KEY,
                row TEXT NOT NULL,
                number INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'AVAILABLE',
                version INTEGER NOT NULL DEFAULT 1,
                reserved_by TEXT
            )
        """)
        
        # Check if seats already exist
        cursor.execute("SELECT COUNT(*) FROM seats")
        if cursor.fetchone()[0] == 0:
            # Insert sample seats (5 rows x 10 seats)
            rows = ['A', 'B', 'C', 'D', 'E']
            for row in rows:
                for num in range(1, 11):
                    seat_id = f"{row}{num}"
                    cursor.execute(
                        "INSERT INTO seats (id, row, number, status, version) VALUES (?, ?, ?, ?, ?)",
                        (seat_id, row, num, SeatStatus.AVAILABLE.value, 1)
                    )


def reset_database():
    """Reset all seats to available state"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE seats SET status = 'AVAILABLE', version = 1, reserved_by = NULL
        """)


def get_all_seats() -> List[dict]:
    """Get all seats from database"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, row, number, status, version, reserved_by FROM seats ORDER BY row, number")
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def get_seat(seat_id: str) -> Optional[dict]:
    """Get a single seat by ID"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, row, number, status, version, reserved_by FROM seats WHERE id = ?",
            (seat_id,)
        )
        row = cursor.fetchone()
        return dict(row) if row else None


def reserve_seat_with_occ(seat_id: str, version: int, client_id: str) -> dict:
    """
    Reserve a seat using Optimistic Concurrency Control.
    
    CRITICAL: The UPDATE uses WHERE version = ? to ensure atomic check-and-update.
    This is the OCC pattern - application-side versioning, no database locks used.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # First, get the current seat state to provide meaningful error
        cursor.execute(
            "SELECT id, row, number, status, version, reserved_by FROM seats WHERE id = ?",
            (seat_id,)
        )
        current_seat = cursor.fetchone()
        
        if not current_seat:
            raise HTTPException(status_code=404, detail=f"Seat {seat_id} not found")
        
        current_seat = dict(current_seat)
        
        # Check if already reserved
        if current_seat['status'] == SeatStatus.RESERVED.value:
            raise VersionMismatchError(
                seat_id=seat_id,
                expected_version=version,
                actual_version=current_seat['version']
            )
        
        # CRITICAL OCC PATTERN: Update only if version matches
        # This is the atomic check-and-update that prevents race conditions
        # Using application-level versioning instead of database-level locks
        cursor.execute("""
            UPDATE seats 
            SET status = ?, version = version + 1, reserved_by = ?
            WHERE id = ? AND version = ? AND status = 'AVAILABLE'
        """, (SeatStatus.RESERVED.value, client_id, seat_id, version))
        
        # Check if update was successful (rows affected)
        if cursor.rowcount == 0:
            # Version mismatch or status changed - another user got it first
            # Re-fetch to get actual version for error message
            cursor.execute("SELECT version FROM seats WHERE id = ?", (seat_id,))
            actual = cursor.fetchone()
            actual_version = actual['version'] if actual else 0
            raise VersionMismatchError(
                seat_id=seat_id,
                expected_version=version,
                actual_version=actual_version
            )
        
        # Return updated seat
        cursor.execute(
            "SELECT id, row, number, status, version, reserved_by FROM seats WHERE id = ?",
            (seat_id,)
        )
        updated_seat = cursor.fetchone()
        return dict(updated_seat)


# ============================================================
# WebSocket Connection Manager
# ============================================================

class ConnectionManager:
    """Manages WebSocket connections for real-time updates"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str):
        """Accept new WebSocket connection"""
        await websocket.accept()
        self.active_connections[client_id] = websocket
    
    def disconnect(self, client_id: str):
        """Remove disconnected client"""
        if client_id in self.active_connections:
            del self.active_connections[client_id]
    
    async def send_personal_message(self, message: dict, client_id: str):
        """Send message to specific client"""
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_json(message)
    
    async def broadcast(self, message: dict, exclude_client: Optional[str] = None):
        """
        Broadcast message to all connected clients.
        
        CRITICAL: exclude_client is used to prevent sending update back to
        the user who made the change (they already updated optimistically).
        """
        disconnected = []
        for client_id, connection in self.active_connections.items():
            if client_id != exclude_client:
                try:
                    await connection.send_json(message)
                except Exception:
                    disconnected.append(client_id)
        
        # Clean up disconnected clients
        for client_id in disconnected:
            self.disconnect(client_id)


# ============================================================
# FastAPI Application
# ============================================================

app = FastAPI(title="Real-Time Reservation System")

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connection manager instance
manager = ConnectionManager()


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    init_database()


@app.get("/seats", response_model=List[SeatResponse])
async def get_seats():
    """Get all seats"""
    seats = get_all_seats()
    return seats


@app.get("/seats/{seat_id}", response_model=SeatResponse)
async def get_seat_by_id(seat_id: str):
    """Get a single seat by ID"""
    seat = get_seat(seat_id)
    if not seat:
        raise HTTPException(status_code=404, detail=f"Seat {seat_id} not found")
    return seat


@app.post("/reserve", response_model=SeatResponse)
async def reserve_seat(request: ReservationRequest):
    """
    Reserve a seat using Optimistic Concurrency Control.
    
    Returns 409 Conflict if version mismatch (seat was modified by another user).
    """
    try:
        updated_seat = reserve_seat_with_occ(
            seat_id=request.seat_id,
            version=request.version,
            client_id=request.client_id
        )
        
        # Broadcast update to all other connected clients
        # CRITICAL: Exclude the sender - they already updated optimistically
        await manager.broadcast(
            message={
                "type": "SEAT_UPDATE",
                "payload": updated_seat
            },
            exclude_client=request.client_id
        )
        
        return updated_seat
        
    except VersionMismatchError as e:
        # Return 409 Conflict for version mismatch
        raise HTTPException(
            status_code=409,
            detail={
                "error": "VERSION_MISMATCH",
                "message": str(e),
                "seat_id": e.seat_id,
                "expected_version": e.expected_version,
                "actual_version": e.actual_version
            }
        )


@app.post("/reset")
async def reset_seats():
    """Reset all seats to available (for testing)"""
    reset_database()
    seats = get_all_seats()
    
    # Broadcast reset to all clients
    await manager.broadcast({
        "type": "INITIAL_STATE",
        "payload": {"seats": seats}
    })
    
    return {"message": "All seats reset to available"}


@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """
    WebSocket endpoint for real-time updates.
    
    On connect: sends current state of all seats.
    On disconnect: logs and cleans up.
    """
    await manager.connect(websocket, client_id)
    
    try:
        # Send initial state on connection
        seats = get_all_seats()
        await manager.send_personal_message(
            {
                "type": "INITIAL_STATE",
                "payload": {"seats": seats}
            },
            client_id
        )
        
        # Keep connection alive and handle incoming messages
        while True:
            data = await websocket.receive_text()
            # Handle ping/pong for connection health
            if data == "ping":
                await websocket.send_text("pong")
                
    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception:
        manager.disconnect(client_id)


# ============================================================
# Health Check
# ============================================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
