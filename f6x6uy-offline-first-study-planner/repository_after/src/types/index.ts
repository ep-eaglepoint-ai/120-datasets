/**
 * TypeScript Type Definitions
 * 
 * Defines all data models and types for the study planner application.
 * Ensures type safety across the entire codebase.
 */

import { ObjectId } from 'mongodb';

// ============================================================================
// Subject Types
// ============================================================================

/**
 * Subject document stored in MongoDB
 */
export interface Subject {
  _id: ObjectId;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Subject response for API
 */
export interface SubjectResponse {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  totalStudyTime?: number; // Total study time in seconds
  sessionCount?: number; // Number of study sessions
}

// ============================================================================
// Study Session Types
// ============================================================================

/**
 * Study session document stored in MongoDB
 */
export interface StudySession {
  _id: ObjectId;
  subjectId: ObjectId;
  duration: number; // Duration in seconds
  timestamp: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Study session response for API
 */
export interface StudySessionResponse {
  id: string;
  subjectId: string;
  subjectName?: string;
  duration: number;
  timestamp: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Reminder Types
// ============================================================================

/**
 * Reminder recurrence pattern
 */
export type RecurrencePattern = 'none' | 'daily' | 'weekly' | 'monthly';

/**
 * Reminder document stored in MongoDB
 */
export interface Reminder {
  _id: ObjectId;
  label: string;
  triggerTime: Date;
  recurrence: RecurrencePattern;
  subjectId?: ObjectId;
  isActive: boolean;
  lastTriggered?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Reminder response for API
 */
export interface ReminderResponse {
  id: string;
  label: string;
  triggerTime: string;
  recurrence: RecurrencePattern;
  subjectId?: string;
  subjectName?: string;
  isActive: boolean;
  lastTriggered?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Analytics Types
// ============================================================================

/**
 * Study statistics for a specific time period
 */
export interface StudyStatistics {
  totalStudyTime: number; // Total time in seconds
  sessionCount: number;
  averageSessionDuration: number;
  subjectBreakdown: SubjectStudyBreakdown[];
}

/**
 * Per-subject study breakdown
 */
export interface SubjectStudyBreakdown {
  subjectId: string;
  subjectName: string;
  totalTime: number;
  sessionCount: number;
  percentage: number; // Percentage of total study time
}

/**
 * Daily study summary
 */
export interface DailyStudySummary {
  date: string; // ISO date string (YYYY-MM-DD)
  totalStudyTime: number;
  sessionCount: number;
  subjectsStudied: string[]; // Array of subject IDs
}

/**
 * Weekly study summary
 */
export interface WeeklyStudySummary {
  weekStart: string; // ISO date string
  weekEnd: string;
  totalStudyTime: number;
  sessionCount: number;
  dailySummaries: DailyStudySummary[];
}

/**
 * Monthly study summary
 */
export interface MonthlyStudySummary {
  month: string; // Format: YYYY-MM
  totalStudyTime: number;
  sessionCount: number;
  weeklySummaries: WeeklyStudySummary[];
}

/**
 * Study streak information
 */
export interface StudyStreak {
  currentStreak: number; // Days
  longestStreak: number; // Days
  lastStudyDate: string | null; // ISO date string
  streakHistory: StreakPeriod[];
}

/**
 * Individual streak period
 */
export interface StreakPeriod {
  startDate: string;
  endDate: string;
  length: number; // Days
}

/**
 * Dashboard statistics
 */
export interface DashboardStats {
  totalSubjects: number;
  totalStudyTime: number;
  totalSessions: number;
  todayStudyTime: number;
  todaySessions: number;
  weekStudyTime: number;
  weekSessions: number;
  monthStudyTime: number;
  monthSessions: number;
  streak: StudyStreak;
  recentSessions: StudySessionResponse[];
  topSubjects: SubjectStudyBreakdown[];
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Generic API success response
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

/**
 * Generic API error response
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: Record<string, string[]>; // Validation errors
}

/**
 * API response type (success or error)
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Type guard to check if response is successful
 */
export function isApiSuccess<T>(
  response: ApiResponse<T>
): response is ApiSuccessResponse<T> {
  return response.success === true;
}

/**
 * Type guard to check if response is an error
 */
export function isApiError(
  response: ApiResponse
): response is ApiErrorResponse {
  return response.success === false;
}
// ============================================================================
// Input Types (proxying from validations)
// ============================================================================

export type {
  CreateSubjectInput,
  UpdateSubjectInput,
  CreateStudySessionInput,
  UpdateStudySessionInput,
} from '@/lib/validations';
