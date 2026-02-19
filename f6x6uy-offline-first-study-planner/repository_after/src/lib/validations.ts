/**
 * Zod Validation Schemas
 * 
 * Defines strict type-safe validation schemas for all data models.
 * Enforces data integrity at both client and server boundaries.
 */

import { z } from 'zod';

// ============================================================================
// Subject Schemas
// ============================================================================

/**
 * Subject creation schema
 * Validates new subject input with strict constraints
 */
export const createSubjectSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Subject name cannot be empty')
    .max(100, 'Subject name must be 100 characters or less')
    .refine(
      (name) => name.length > 0,
      'Subject name cannot be only whitespace'
    ),
  description: z.string()
    .max(500, 'Description must be 500 characters or less')
    .optional()
    .transform((val) => val?.trim() || undefined),
});

/**
 * Subject update schema
 * Allows partial updates with same validation rules
 */
export const updateSubjectSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Subject name cannot be empty')
    .max(100, 'Subject name must be 100 characters or less')
    .optional(),
  description: z.string()
    .max(500, 'Description must be 500 characters or less')
    .optional()
    .transform((val) => val?.trim() || undefined),
}).refine(
  (data) => data.name !== undefined || data.description !== undefined,
  'At least one field must be provided for update'
);

/**
 * Subject ID validation schema
 */
export const subjectIdSchema = z.string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid subject ID format');

// ============================================================================
// Study Session Schemas
// ============================================================================

/**
 * Study session creation schema
 * Validates session data with duration and timestamp constraints
 */
export const createStudySessionSchema = z.object({
  subjectId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid subject ID format'),
  duration: z.number()
    .int('Duration must be an integer')
    .positive('Duration must be positive')
    .max(86400, 'Duration cannot exceed 24 hours (86400 seconds)')
    .refine(
      (duration) => duration >= 60,
      'Duration must be at least 60 seconds (1 minute)'
    ),
  timestamp: z.string()
    .datetime('Invalid timestamp format')
    .or(z.date())
    .transform((val) => typeof val === 'string' ? new Date(val) : val)
    .refine(
      (date) => date.getTime() <= Date.now() + 300000,
      'Timestamp cannot be in the future'
    )
    .refine(
      (date) => date >= new Date('2000-01-01'),
      'Timestamp must be after year 2000'
    ),
  notes: z.string()
    .max(1000, 'Notes must be 1000 characters or less')
    .optional()
    .transform((val) => val?.trim() || undefined),
});

/**
 * Study session update schema
 * Allows partial updates with validation
 */
export const updateStudySessionSchema = z.object({
  duration: z.number()
    .int('Duration must be an integer')
    .positive('Duration must be positive')
    .max(86400, 'Duration cannot exceed 24 hours (86400 seconds)')
    .refine(
      (duration) => duration >= 60,
      'Duration must be at least 60 seconds (1 minute)'
    )
    .optional(),
  timestamp: z.string()
    .datetime('Invalid timestamp format')
    .or(z.date())
    .transform((val) => typeof val === 'string' ? new Date(val) : val)
    .refine(
      (date) => date.getTime() <= Date.now() + 300000,
      'Timestamp cannot be in the future'
    )
    .optional(),
  notes: z.string()
    .max(1000, 'Notes must be 1000 characters or less')
    .optional()
    .transform((val) => val?.trim() || undefined),
}).refine(
  (data) => data.duration !== undefined || data.timestamp !== undefined || data.notes !== undefined,
  'At least one field must be provided for update'
);

/**
 * Session ID validation schema
 */
export const sessionIdSchema = z.string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid session ID format');

// ============================================================================
// Reminder Schemas
// ============================================================================

/**
 * Reminder recurrence pattern schema
 */
export const recurrenceSchema = z.enum([
  'none',
  'daily',
  'weekly',
  'monthly',
]).default('none');

/**
 * Reminder creation schema
 * Validates reminder data with trigger time and recurrence
 */
export const createReminderSchema = z.object({
  label: z.string()
    .trim()
    .min(1, 'Reminder label cannot be empty')
    .max(200, 'Reminder label must be 200 characters or less'),
  triggerTime: z.string()
    .datetime('Invalid trigger time format')
    .or(z.date())
    .transform((val) => typeof val === 'string' ? new Date(val) : val),
  recurrence: recurrenceSchema,
  subjectId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid subject ID format')
    .optional(),
  isActive: z.boolean().default(true),
});

/**
 * Reminder update schema
 * Allows partial updates
 */
export const updateReminderSchema = z.object({
  label: z.string()
    .trim()
    .min(1, 'Reminder label cannot be empty')
    .max(200, 'Reminder label must be 200 characters or less')
    .optional(),
  triggerTime: z.string()
    .datetime('Invalid trigger time format')
    .or(z.date())
    .transform((val) => typeof val === 'string' ? new Date(val) : val)
    .optional(),
  recurrence: recurrenceSchema.optional(),
  isActive: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  'At least one field must be provided for update'
);

/**
 * Reminder ID validation schema
 */
export const reminderIdSchema = z.string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid reminder ID format');

// ============================================================================
// Query Parameter Schemas
// ============================================================================

/**
 * Date range query schema for analytics
 */
export const dateRangeSchema = z.object({
  startDate: z.string()
    .datetime('Invalid start date format')
    .or(z.date())
    .transform((val) => typeof val === 'string' ? new Date(val) : val)
    .optional(),
  endDate: z.string()
    .datetime('Invalid end date format')
    .or(z.date())
    .transform((val) => typeof val === 'string' ? new Date(val) : val)
    .optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  },
  'Start date must be before or equal to end date'
);

/**
 * Pagination schema
 */
export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;
export type CreateStudySessionInput = z.infer<typeof createStudySessionSchema>;
export type UpdateStudySessionInput = z.infer<typeof updateStudySessionSchema>;
export type CreateReminderInput = z.infer<typeof createReminderSchema>;
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>;
export type DateRangeQuery = z.infer<typeof dateRangeSchema>;
export type PaginationQuery = z.infer<typeof paginationSchema>;
