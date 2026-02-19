/**
 * React Context and useReducer for Seat State Management
 * Requirement: Use React Context and useReducer (no Redux)
 */

import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { Seat, SeatState, SeatAction } from '../types';

const initialState: SeatState = {
  seats: new Map<string, Seat>(),
  loadingSeats: new Set<string>(),
  error: null,
};

function seatReducer(state: SeatState, action: SeatAction): SeatState {
  switch (action.type) {
    case 'SET_SEATS': {
      const seats = action.payload as Seat[];
      const seatMap = new Map<string, Seat>();
      seats.forEach((seat) => seatMap.set(seat.id, seat));
      return { ...state, seats: seatMap };
    }

    case 'UPDATE_SEAT': {
      const seat = action.payload as Seat;
      const newSeats = new Map(state.seats);
      newSeats.set(seat.id, seat);
      return { ...state, seats: newSeats };
    }

    case 'OPTIMISTIC_RESERVE': {
      // Requirement #2: Update local state BEFORE API response
      const seat = action.payload as Seat;
      const newSeats = new Map(state.seats);
      const existingSeat = newSeats.get(seat.id);
      if (existingSeat) {
        newSeats.set(seat.id, {
          ...existingSeat,
          status: 'RESERVED',
        });
      }
      return { ...state, seats: newSeats };
    }

    case 'ROLLBACK_SEAT': {
      // Requirement #3: Revert seat to AVAILABLE on version error
      const seatId = action.payload as string;
      const newSeats = new Map(state.seats);
      const existingSeat = newSeats.get(seatId);
      if (existingSeat) {
        newSeats.set(seatId, {
          ...existingSeat,
          status: 'AVAILABLE',
        });
      }
      return { ...state, seats: newSeats };
    }

    case 'SET_LOADING': {
      // Requirement #7: Handle loading state to prevent double-clicks
      const { seatId, loading } = action.payload as { seatId: string; loading: boolean };
      const newLoadingSeats = new Set(state.loadingSeats);
      if (loading) {
        newLoadingSeats.add(seatId);
      } else {
        newLoadingSeats.delete(seatId);
      }
      return { ...state, loadingSeats: newLoadingSeats };
    }

    case 'SET_ERROR': {
      return { ...state, error: action.payload as string };
    }

    case 'CLEAR_ERROR': {
      return { ...state, error: null };
    }

    default:
      return state;
  }
}

interface SeatContextType {
  state: SeatState;
  dispatch: React.Dispatch<SeatAction>;
}

const SeatContext = createContext<SeatContextType | undefined>(undefined);

export function SeatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(seatReducer, initialState);

  return (
    <SeatContext.Provider value={{ state, dispatch }}>
      {children}
    </SeatContext.Provider>
  );
}

export function useSeatContext(): SeatContextType {
  const context = useContext(SeatContext);
  if (context === undefined) {
    throw new Error('useSeatContext must be used within a SeatProvider');
  }
  return context;
}
