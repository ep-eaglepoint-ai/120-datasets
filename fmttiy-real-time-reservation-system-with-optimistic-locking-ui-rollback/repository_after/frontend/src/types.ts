/**
 * TypeScript interfaces for the Real-Time Reservation System
 * Requirement #8: TypeScript interfaces must be defined and strictly used
 */

export type SeatStatus = 'AVAILABLE' | 'RESERVED';

export interface Seat {
  id: string;
  row: string;
  number: number;
  status: SeatStatus;
  version: number;
  reserved_by: string | null;
}

export interface WebSocketMessage {
  type: 'SEAT_UPDATE' | 'INITIAL_STATE' | 'ERROR';
  payload: {
    seats?: Seat[];
    id?: string;
    row?: string;
    number?: number;
    status?: SeatStatus;
    version?: number;
    reserved_by?: string | null;
    error?: string;
  };
}

export interface ReservationRequest {
  seat_id: string;
  version: number;
  client_id: string;
}

export interface ApiError {
  error: string;
  message: string;
  seat_id: string;
  expected_version: number;
  actual_version: number;
}

export type SeatActionType =
  | 'SET_SEATS'
  | 'UPDATE_SEAT'
  | 'OPTIMISTIC_RESERVE'
  | 'ROLLBACK_SEAT'
  | 'SET_LOADING'
  | 'SET_ERROR'
  | 'CLEAR_ERROR';

export interface SeatAction {
  type: SeatActionType;
  payload?: Seat | Seat[] | string | { seatId: string; loading: boolean };
}

export interface SeatState {
  seats: Map<string, Seat>;
  loadingSeats: Set<string>;
  error: string | null;
}

export interface Toast {
  id: string;
  message: string;
  type: 'error' | 'success' | 'info';
}
