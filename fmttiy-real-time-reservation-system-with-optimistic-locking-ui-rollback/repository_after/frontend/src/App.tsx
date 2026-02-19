/**
 * Real-Time Reservation System - React Frontend
 * Implements Optimistic UI pattern with rollback on version mismatch
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SeatProvider, useSeatContext } from './context/SeatContext';
import { Seat, WebSocketMessage, Toast } from './types';
import axios from 'axios';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000';

// Generate unique client ID
const CLIENT_ID = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// ============================================================
// Toast Notification Component
// ============================================================

function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <span>{toast.message}</span>
          <button onClick={() => removeToast(toast.id)}>×</button>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Seat Component
// ============================================================

interface SeatComponentProps {
  seat: Seat;
  onReserve: (seat: Seat) => void;
  isLoading: boolean;
}

function SeatComponent({ seat, onReserve, isLoading }: SeatComponentProps) {
  const isReserved = seat.status === 'RESERVED';
  const isDisabled = isReserved || isLoading;

  const handleClick = () => {
    // Requirement #7: Prevent clicking while loading
    if (isDisabled) return;
    onReserve(seat);
  };

  return (
    <button
      className={`seat ${isReserved ? 'reserved' : 'available'} ${isLoading ? 'loading' : ''}`}
      onClick={handleClick}
      disabled={isDisabled}
      title={`Seat ${seat.id} - ${seat.status}${isLoading ? ' (Processing...)' : ''}`}
    >
      {seat.id}
    </button>
  );
}

// ============================================================
// Seat Grid Component
// ============================================================

function SeatGrid() {
  const { state, dispatch } = useSeatContext();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000;

  // Add toast notification
  const addToast = useCallback((message: string, type: Toast['type']) => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  // Remove toast
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Fetch initial seats state
  const fetchSeats = useCallback(async () => {
    try {
      const response = await axios.get<Seat[]>(`${API_URL}/seats`);
      dispatch({ type: 'SET_SEATS', payload: response.data });
    } catch (error) {
      console.error('Failed to fetch seats:', error);
      addToast('Failed to load seats. Please refresh.', 'error');
    }
  }, [dispatch, addToast]);

  // WebSocket connection with reconnection logic
  // Requirement #6: WebSocket must include reconnect logic on onclose
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    console.log(`Connecting to WebSocket... (Attempt ${reconnectAttemptsRef.current + 1})`);
    const ws = new WebSocket(`${WS_URL}/ws/${CLIENT_ID}`);

    ws.onopen = () => {
      console.log('WebSocket connected');
      reconnectAttemptsRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        
        switch (message.type) {
          case 'INITIAL_STATE':
            if (message.payload.seats) {
              dispatch({ type: 'SET_SEATS', payload: message.payload.seats });
            }
            break;
          
          case 'SEAT_UPDATE':
            // Requirement #4: Handle receiving updates from other clients
            // The sender is filtered out on backend, so we don't need to check here
            const seatUpdate: Seat = {
              id: message.payload.id!,
              row: message.payload.row!,
              number: message.payload.number!,
              status: message.payload.status!,
              version: message.payload.version!,
              reserved_by: message.payload.reserved_by || null,
            };
            dispatch({ type: 'UPDATE_SEAT', payload: seatUpdate });
            break;
          
          case 'ERROR':
            console.error('WebSocket error:', message.payload.error);
            break;
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      wsRef.current = null;

      // Requirement #6: Attempt reconnection on close
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current++;
        console.log(`Attempting to reconnect in ${RECONNECT_DELAY}ms...`);
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, RECONNECT_DELAY);
      } else {
        console.error('Max reconnection attempts reached. Please refresh the page.');
        addToast('Connection lost. Please refresh the page.', 'error');
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    wsRef.current = ws;
  }, [dispatch, addToast]);

  // Initialize connection
  useEffect(() => {
    fetchSeats();
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [fetchSeats, connectWebSocket]);

  // Reserve seat handler with Optimistic UI
  const handleReserve = useCallback(async (seat: Seat) => {
    const seatId = seat.id;
    
    // Requirement #7: Set loading to prevent double-clicks
    dispatch({ type: 'SET_LOADING', payload: { seatId, loading: true } });

    // Requirement #2: OPTIMISTIC UPDATE - Update UI BEFORE API call
    // This must happen BEFORE the await!
    dispatch({ type: 'OPTIMISTIC_RESERVE', payload: seat });

    try {
      // Now make the API call
      const response = await axios.post<Seat>(`${API_URL}/reserve`, {
        seat_id: seatId,
        version: seat.version,
        client_id: CLIENT_ID,
      });

      // Update with server-confirmed state (includes new version)
      dispatch({ type: 'UPDATE_SEAT', payload: response.data });
      addToast(`Seat ${seatId} reserved successfully!`, 'success');
      
    } catch (error: any) {
      // Requirement #3: ROLLBACK on version mismatch (409 error)
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        // Version mismatch - another user reserved it first
        dispatch({ type: 'ROLLBACK_SEAT', payload: seatId });
        addToast('Seat no longer available.', 'error');
        
        // Re-fetch to get current state
        fetchSeats();
      } else {
        // Other error - also rollback
        dispatch({ type: 'ROLLBACK_SEAT', payload: seatId });
        addToast('Failed to reserve seat. Please try again.', 'error');
      }
    } finally {
      // Clear loading state
      dispatch({ type: 'SET_LOADING', payload: { seatId, loading: false } });
    }
  }, [dispatch, addToast, fetchSeats]);

  // Organize seats by row
  const seatsByRow = new Map<string, Seat[]>();
  state.seats.forEach((seat) => {
    const row = seat.row;
    if (!seatsByRow.has(row)) {
      seatsByRow.set(row, []);
    }
    seatsByRow.get(row)!.push(seat);
  });

  // Sort rows and seats
  const sortedRows = Array.from(seatsByRow.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  sortedRows.forEach(([_, seats]) => seats.sort((a, b) => a.number - b.number));

  return (
    <div className="seat-grid-container">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <div className="legend">
        <div className="legend-item">
          <div className="seat available small"></div>
          <span>Available</span>
        </div>
        <div className="legend-item">
          <div className="seat reserved small"></div>
          <span>Reserved</span>
        </div>
      </div>

      <div className="screen">SCREEN</div>

      <div className="seat-grid">
        {sortedRows.map(([row, seats]) => (
          <div key={row} className="seat-row">
            <span className="row-label">{row}</span>
            <div className="seats">
              {seats.map((seat) => (
                <SeatComponent
                  key={seat.id}
                  seat={seat}
                  onReserve={handleReserve}
                  isLoading={state.loadingSeats.has(seat.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="client-info">
        <small>Client ID: {CLIENT_ID}</small>
      </div>
    </div>
  );
}

// ============================================================
// Main App Component
// ============================================================

function App() {
  return (
    <SeatProvider>
      <div className="app">
        <header className="app-header">
          <h1>🎭 Real-Time Seat Reservation</h1>
          <p>Click on an available seat to reserve it</p>
        </header>
        <main>
          <SeatGrid />
        </main>
      </div>
    </SeatProvider>
  );
}

export default App;
