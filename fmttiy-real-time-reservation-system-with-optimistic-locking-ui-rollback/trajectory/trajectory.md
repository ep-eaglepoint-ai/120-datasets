# Trajectory: Real-Time Reservation System with Optimistic Locking & UI Rollback

## 1. Requirements Analysis (Audit)

Analyzed the task requirements for a high-contention ticketing platform:
- **Core Challenge**: Orchestrate state consistency across async boundary under high contention without blocking database locks
- **Pattern Required**: Optimistic Concurrency Control (OCC) with version-based updates
- **UI Pattern**: Optimistic UI with automatic rollback on conflict
- **Constraints**: No SELECT FOR UPDATE, no LOCK TABLES - application-side logic only

### 8 Key Requirements Identified:
1. OCC version check in SQL UPDATE with WHERE clause
2. Optimistic UI update BEFORE await api.post()
3. Rollback to AVAILABLE on 409/Version Error
4. WebSocket broadcast excludes sender
5. No database-level locking (negative constraint)
6. WebSocket reconnection logic on onclose
7. Loading state prevents double-click
8. TypeScript interfaces strictly used (no `any`)

## 2. Design Contract Definition

### Backend Contract (FastAPI + SQLite):
- `/reserve` endpoint with OCC pattern
- WebSocket `/ws/{client_id}` for real-time updates
- `seats` table with `version` column for OCC
- `VersionMismatchError` custom exception → 409 response
- Broadcast updates excluding the sender

### Frontend Contract (React + TypeScript):
- React Context + useReducer for state (no Redux)
- Optimistic state update before API call
- Automatic rollback on version conflict
- WebSocket with reconnection on disconnect
- Loading state per seat to prevent double-clicks
- Strict TypeScript interfaces for Seat and WebSocketMessage

## 3. Implementation - Backend (server.py)

### OCC Implementation:
```python
# CRITICAL: Atomic check-and-update in single UPDATE statement
cursor.execute("""
    UPDATE seats 
    SET status = ?, version = version + 1, reserved_by = ?
    WHERE id = ? AND version = ? AND status = 'AVAILABLE'
""", (SeatStatus.RESERVED.value, client_id, seat_id, version))

if cursor.rowcount == 0:
    raise VersionMismatchError(...)
```

### WebSocket Broadcast:
```python
async def broadcast(self, message, exclude_client=None):
    for client_id, connection in self.active_connections.items():
        if client_id != exclude_client:  # Exclude sender
            await connection.send_json(message)
```

## 4. Implementation - Frontend (App.tsx)

### Optimistic UI Pattern:
```typescript
const handleReserve = async (seat: Seat) => {
  // 1. Set loading state (prevent double-click)
  dispatch({ type: 'SET_LOADING', payload: { seatId, loading: true } });
  
  // 2. OPTIMISTIC UPDATE - BEFORE await (Requirement #2)
  dispatch({ type: 'OPTIMISTIC_RESERVE', payload: seat });
  
  try {
    // 3. API call
    const response = await axios.post('/reserve', {...});
    dispatch({ type: 'UPDATE_SEAT', payload: response.data });
  } catch (error) {
    // 4. ROLLBACK on 409 (Requirement #3)
    if (error.response?.status === 409) {
      dispatch({ type: 'ROLLBACK_SEAT', payload: seatId });
      addToast('Seat no longer available.', 'error');
    }
  } finally {
    dispatch({ type: 'SET_LOADING', payload: { seatId, loading: false } });
  }
};
```

### WebSocket Reconnection (Requirement #6):
```typescript
ws.onclose = () => {
  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    setTimeout(() => connectWebSocket(), RECONNECT_DELAY);
  }
};
```

## 5. Testing Strategy

### Test Categories (by Requirement):
- **Requirement #1**: Verify OCC SQL pattern with version check in WHERE clause
- **Requirement #2**: Verify OPTIMISTIC_RESERVE dispatch before await axios
- **Requirement #3**: Verify ROLLBACK_SEAT dispatch on 409 error
- **Requirement #4**: Verify broadcast exclude_client parameter usage
- **Requirement #5**: Verify no FOR UPDATE or LOCK TABLES in code
- **Requirement #6**: Verify WebSocket onclose with reconnection logic
- **Requirement #7**: Verify SET_LOADING and button disabled state
- **Requirement #8**: Verify TypeScript interfaces, no `any` for seats

### Integration Tests:
- Concurrent reservation race condition handling
- Successful reservation flow
- Version mismatch detection

## 6. Verification Results

All 8 requirements validated through comprehensive test suite:
- Static code analysis for patterns (OCC, no locks)
- Source inspection for dispatch ordering
- Interface type checking
- Integration tests for API behavior

## Core Principle Applied

**Audit → Contract → Design → Execute → Verify**

The trajectory follows a systematic approach:
1. Audit requirements and constraints
2. Define API and state contracts
3. Design OCC and Optimistic UI patterns
4. Execute implementation in server.py and App.tsx
5. Verify through comprehensive tests

## Files Created

- `repository_after/server.py` - FastAPI backend with OCC
- `repository_after/frontend/src/types.ts` - TypeScript interfaces
- `repository_after/frontend/src/context/SeatContext.tsx` - React Context + useReducer
- `repository_after/frontend/src/App.tsx` - React frontend with Optimistic UI
- `repository_after/frontend/src/App.css` - Styling
- `tests/test_reservation_system.py` - Comprehensive test suite
- `evaluation/evaluation.py` - Evaluation runner with JSON report
