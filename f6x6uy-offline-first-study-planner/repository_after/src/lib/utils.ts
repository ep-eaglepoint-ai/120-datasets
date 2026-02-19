/**
 * Utility Functions
 * 
 * Helper functions for data transformation, formatting, and common operations.
 */

import { ObjectId } from 'mongodb';
import {
  Subject,
  SubjectResponse,
  StudySession,
  StudySessionResponse,
  Reminder,
  ReminderResponse,
} from '@/types';

// ============================================================================
// Data Transformation Functions
// ============================================================================

/**
 * Convert MongoDB Subject document to API response format
 */
export function subjectToResponse(subject: Subject): SubjectResponse {
  return {
    id: subject._id.toString(),
    name: subject.name,
    description: subject.description ?? undefined,
    createdAt: subject.createdAt.toISOString(),
    updatedAt: subject.updatedAt.toISOString(),
  };
}

/**
 * Convert MongoDB StudySession document to API response format
 */
export function sessionToResponse(session: StudySession, subjectName?: string): StudySessionResponse {
  return {
    id: session._id.toString(),
    subjectId: session.subjectId.toString(),
    subjectName,
    duration: session.duration,
    timestamp: session.timestamp.toISOString(),
    notes: session.notes ?? undefined,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

/**
 * Convert MongoDB Reminder document to API response format
 */
export function reminderToResponse(reminder: Reminder, subjectName?: string): ReminderResponse {
  return {
    id: reminder._id.toString(),
    label: reminder.label,
    triggerTime: reminder.triggerTime.toISOString(),
    recurrence: reminder.recurrence,
    subjectId: reminder.subjectId?.toString(),
    subjectName,
    isActive: reminder.isActive,
    lastTriggered: reminder.lastTriggered?.toISOString(),
    createdAt: reminder.createdAt.toISOString(),
    updatedAt: reminder.updatedAt.toISOString(),
  };
}

// ============================================================================
// ObjectId Validation and Conversion
// ============================================================================

/**
 * Check if a string is a valid MongoDB ObjectId
 */
export function isValidObjectId(id: string): boolean {
  return ObjectId.isValid(id) && /^[0-9a-fA-F]{24}$/.test(id);
}

/**
 * Convert string to ObjectId with validation
 * Throws error if invalid
 */
export function toObjectId(id: string): ObjectId {
  if (!isValidObjectId(id)) {
    throw new Error(`Invalid ObjectId format: ${id}`);
  }
  return new ObjectId(id);
}

/**
 * Safely convert string to ObjectId
 * Returns null if invalid
 */
export function toObjectIdSafe(id: string): ObjectId | null {
  try {
    return toObjectId(id);
  } catch {
    return null;
  }
}

// ============================================================================
// Time and Date Utilities
// ============================================================================

/**
 * Format duration in seconds to human-readable string
 * Examples: "2h 30m", "45m", "1h 15m 30s"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 0) return '0s';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

/**
 * Get start of day in UTC
 */
export function getStartOfDay(date: Date): Date {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

/**
 * Get end of day in UTC
 */
export function getEndOfDay(date: Date): Date {
  const result = new Date(date);
  result.setUTCHours(23, 59, 59, 999);
  return result;
}

/**
 * Get start of week (Monday) in UTC
 */
export function getStartOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Adjust to Monday
  result.setUTCDate(result.getUTCDate() + diff);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

/**
 * Get start of month in UTC
 */
export function getStartOfMonth(date: Date): Date {
  const result = new Date(date);
  result.setUTCDate(1);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

/**
 * Get date string in YYYY-MM-DD format (UTC)
 */
export function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Calculate difference in days between two dates
 */
export function getDaysDifference(date1: Date, date2: Date): number {
  const start = getStartOfDay(date1);
  const end = getStartOfDay(date2);
  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Check if two dates are on the same day (UTC)
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return getDateString(date1) === getDateString(date2);
}

/**
 * Check if date is today (UTC)
 */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/**
 * Get array of dates between start and end (inclusive)
 */
export function getDateRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(start);
  
  while (current <= end) {
    dates.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  
  return dates;
}

// ============================================================================
// Array and Object Utilities
// ============================================================================

/**
 * Group array of items by a key function
 */
export function groupBy<T, K extends string | number>(
  items: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {} as Record<K, T[]>);
}

/**
 * Sum array of numbers
 */
export function sum(numbers: number[]): number {
  return numbers.reduce((total, num) => total + num, 0);
}

/**
 * Calculate average of array of numbers
 */
export function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return sum(numbers) / numbers.length;
}

/**
 * Sort array by key in descending order
 */
export function sortByDesc<T>(items: T[], keyFn: (item: T) => number): T[] {
  return [...items].sort((a, b) => keyFn(b) - keyFn(a));
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Check if duration is valid (between 1 minute and 24 hours)
 */
export function isValidDuration(seconds: number): boolean {
  return Number.isInteger(seconds) && seconds >= 60 && seconds <= 86400;
}

/**
 * Check if timestamp is valid (not in future, after year 2000)
 */
export function isValidTimestamp(date: Date): boolean {
  const now = new Date();
  const minDate = new Date('2000-01-01');
  return date <= now && date >= minDate;
}

/**
 * Sanitize string input (trim and limit length)
 */
export function sanitizeString(input: string, maxLength: number): string {
  return input.trim().substring(0, maxLength);
}

// ============================================================================
// Error Handling Utilities
// ============================================================================

/**
 * Create standardized error response
 */
export function createErrorResponse(error: unknown): { error: string; details?: Record<string, string[]> } {
  if (error instanceof Error) {
    return { error: error.message };
  }
  
  if (typeof error === 'string') {
    return { error };
  }
  
  return { error: 'An unexpected error occurred' };
}

/**
 * Check if error is a MongoDB duplicate key error
 */
export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}
