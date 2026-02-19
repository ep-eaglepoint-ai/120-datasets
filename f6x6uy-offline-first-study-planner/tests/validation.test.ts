/**
 * Validation Tests (schema only)
 *
 * Zod schema tests only. Service/behavior tests live in:
 * - reminder.test.ts (reminder CRUD, recurrence, missed triggers, inactive)
 * - sessions.test.ts, subjects.test.ts, analytics.test.ts (other services)
 * - offline-manager.test.ts, db.test.ts (offline persistence, DB recovery)
 * - tests/ui/page.test.tsx (UI and offline fallback)
 *
 * This file: Requirement 9 – validate input, type safety, reject malformed data.
 */

import {
  createSubjectSchema,
  updateSubjectSchema,
  createStudySessionSchema,
  updateStudySessionSchema,
  createReminderSchema,
  updateReminderSchema,
  dateRangeSchema,
} from '../repository_after/src/lib/validations';

describe('Requirement 9: Zod Validation', () => {
  describe('TC-36: Subject validation', () => {
    it('should validate correct subject data', () => {
      const result = createSubjectSchema.safeParse({
        name: 'Mathematics',
        description: 'Advanced calculus',
      });

      expect(result.success).toBe(true);
    });

    it('should reject empty subject name', () => {
      const result = createSubjectSchema.safeParse({
        name: '',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('cannot be empty');
      }
    });

    it('should reject subject name exceeding max length', () => {
      const result = createSubjectSchema.safeParse({
        name: 'A'.repeat(101),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('100 characters');
      }
    });

    it('should trim whitespace from subject name', () => {
      const result = createSubjectSchema.safeParse({
        name: '  Physics  ',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Physics');
      }
    });

    it('should reject whitespace-only subject name', () => {
      const result = createSubjectSchema.safeParse({
        name: '   ',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('TC-37: Study session validation', () => {
    it('should validate correct session data', () => {
      const result = createStudySessionSchema.safeParse({
        subjectId: '507f1f77bcf86cd799439011',
        duration: 3600,
        timestamp: '2024-01-15T10:00:00Z',
        notes: 'Studied calculus',
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid subject ID format', () => {
      const result = createStudySessionSchema.safeParse({
        subjectId: 'invalid-id',
        duration: 3600,
        timestamp: '2024-01-15T10:00:00Z',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid subject ID');
      }
    });

    it('should reject negative duration', () => {
      const result = createStudySessionSchema.safeParse({
        subjectId: '507f1f77bcf86cd799439011',
        duration: -100,
        timestamp: '2024-01-15T10:00:00Z',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('positive');
      }
    });

    it('should reject duration less than 60 seconds', () => {
      const result = createStudySessionSchema.safeParse({
        subjectId: '507f1f77bcf86cd799439011',
        duration: 59,
        timestamp: '2024-01-15T10:00:00Z',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('60 seconds');
      }
    });

    it('should reject duration exceeding 24 hours', () => {
      const result = createStudySessionSchema.safeParse({
        subjectId: '507f1f77bcf86cd799439011',
        duration: 86401,
        timestamp: '2024-01-15T10:00:00Z',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('24 hours');
      }
    });

    it('should reject future timestamp', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const result = createStudySessionSchema.safeParse({
        subjectId: '507f1f77bcf86cd799439011',
        duration: 3600,
        timestamp: futureDate.toISOString(),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('future');
      }
    });

    it('should reject invalid timestamp format', () => {
      const result = createStudySessionSchema.safeParse({
        subjectId: '507f1f77bcf86cd799439011',
        duration: 3600,
        timestamp: 'not-a-date',
      });

      expect(result.success).toBe(false);
    });

    it('should reject non-integer duration', () => {
      const result = createStudySessionSchema.safeParse({
        subjectId: '507f1f77bcf86cd799439011',
        duration: 3600.5,
        timestamp: '2024-01-15T10:00:00Z',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('integer');
      }
    });
  });

  describe('TC-38: Update validation requires at least one field', () => {
    it('should reject subject update with no fields', () => {
      const result = updateSubjectSchema.safeParse({});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('At least one field');
      }
    });

    it('should accept subject update with one field', () => {
      const result = updateSubjectSchema.safeParse({
        name: 'Updated Name',
      });

      expect(result.success).toBe(true);
    });

    it('should reject session update with no fields', () => {
      const result = updateStudySessionSchema.safeParse({});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('At least one field');
      }
    });
  });

  describe('TC-39: Reminder validation', () => {
    it('should validate correct reminder data', () => {
      const result = createReminderSchema.safeParse({
        label: 'Study Math',
        triggerTime: '2024-01-20T10:00:00Z',
        recurrence: 'daily',
        isActive: true,
      });

      expect(result.success).toBe(true);
    });

    it('should reject empty reminder label', () => {
      const result = createReminderSchema.safeParse({
        label: '',
        triggerTime: '2024-01-20T10:00:00Z',
        recurrence: 'none',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('cannot be empty');
      }
    });

    it('should reject invalid recurrence pattern', () => {
      const result = createReminderSchema.safeParse({
        label: 'Test',
        triggerTime: '2024-01-20T10:00:00Z',
        recurrence: 'invalid',
      });

      expect(result.success).toBe(false);
    });

    it('should default recurrence to none', () => {
      const result = createReminderSchema.safeParse({
        label: 'Test',
        triggerTime: '2024-01-20T10:00:00Z',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.recurrence).toBe('none');
      }
    });

    it('should default isActive to true', () => {
      const result = createReminderSchema.safeParse({
        label: 'Test',
        triggerTime: '2024-01-20T10:00:00Z',
        recurrence: 'none',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(true);
      }
    });
  });

  describe('TC-40: Date range validation', () => {
    it('should validate correct date range', () => {
      const result = dateRangeSchema.safeParse({
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-31T23:59:59Z',
      });

      expect(result.success).toBe(true);
    });

    it('should reject end date before start date', () => {
      const result = dateRangeSchema.safeParse({
        startDate: '2024-01-31T00:00:00Z',
        endDate: '2024-01-01T00:00:00Z',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('before or equal');
      }
    });

    it('should accept equal start and end dates', () => {
      const result = dateRangeSchema.safeParse({
        startDate: '2024-01-15T00:00:00Z',
        endDate: '2024-01-15T23:59:59Z',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('TC-41: Malformed data rejection', () => {
    it('should reject null values for required fields', () => {
      const result = createSubjectSchema.safeParse({
        name: null,
      });

      expect(result.success).toBe(false);
    });

    it('should reject undefined for required fields', () => {
      const result = createSubjectSchema.safeParse({});

      expect(result.success).toBe(false);
    });

    it('should reject wrong data types', () => {
      const result = createStudySessionSchema.safeParse({
        subjectId: '507f1f77bcf86cd799439011',
        duration: '3600', // String instead of number
        timestamp: '2024-01-15T10:00:00Z',
      });

      expect(result.success).toBe(false);
    });

    it('should reject arrays for string fields', () => {
      const result = createSubjectSchema.safeParse({
        name: ['Math', 'Physics'],
      });

      expect(result.success).toBe(false);
    });

    it('should reject objects for primitive fields', () => {
      const result = createStudySessionSchema.safeParse({
        subjectId: '507f1f77bcf86cd799439011',
        duration: { value: 3600 },
        timestamp: '2024-01-15T10:00:00Z',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('TC-42: Field length limits', () => {
    it('should reject notes exceeding 1000 characters', () => {
      const result = createStudySessionSchema.safeParse({
        subjectId: '507f1f77bcf86cd799439011',
        duration: 3600,
        timestamp: '2024-01-15T10:00:00Z',
        notes: 'A'.repeat(1001),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('1000 characters');
      }
    });

    it('should accept notes with exactly 1000 characters', () => {
      const result = createStudySessionSchema.safeParse({
        subjectId: '507f1f77bcf86cd799439011',
        duration: 3600,
        timestamp: '2024-01-15T10:00:00Z',
        notes: 'A'.repeat(1000),
      });

      expect(result.success).toBe(true);
    });

    it('should reject reminder label exceeding 200 characters', () => {
      const result = createReminderSchema.safeParse({
        label: 'A'.repeat(201),
        triggerTime: '2024-01-20T10:00:00Z',
        recurrence: 'none',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('200 characters');
      }
    });
  });

  describe('TC-43: Clear error messages', () => {
    it('should provide human-readable error for empty name', () => {
      const result = createSubjectSchema.safeParse({
        name: '',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessage = result.error.issues[0].message;
        expect(errorMessage).toBeTruthy();
        expect(errorMessage.length).toBeGreaterThan(0);
        expect(errorMessage).not.toContain('undefined');
        expect(errorMessage).not.toContain('null');
      }
    });

    it('should provide field-specific errors', () => {
      const result = createStudySessionSchema.safeParse({
        subjectId: 'invalid',
        duration: -100,
        timestamp: 'invalid-date',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
        const fieldErrors = result.error.flatten().fieldErrors;
        expect(fieldErrors.subjectId).toBeDefined();
        expect(fieldErrors.duration).toBeDefined();
        expect(fieldErrors.timestamp).toBeDefined();
      }
    });
  });

  describe('TC-44: Type coercion and transformation', () => {
    it('should transform string timestamp to Date object', () => {
      const result = createStudySessionSchema.safeParse({
        subjectId: '507f1f77bcf86cd799439011',
        duration: 3600,
        timestamp: '2024-01-15T10:00:00Z',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timestamp).toBeInstanceOf(Date);
      }
    });

    it('should trim and transform description', () => {
      const result = createSubjectSchema.safeParse({
        name: 'Math',
        description: '  Advanced calculus  ',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe('Advanced calculus');
      }
    });

    it('should transform empty description to undefined', () => {
      const result = createSubjectSchema.safeParse({
        name: 'Math',
        description: '   ',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBeUndefined();
      }
    });
  });

  describe('TC-45: SQL injection and XSS prevention', () => {
    it('should accept but not execute SQL-like strings', () => {
      const result = createSubjectSchema.safeParse({
        name: "'; DROP TABLE subjects; --",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // String is accepted as-is, MongoDB will handle it safely
        expect(result.data.name).toBe("'; DROP TABLE subjects; --");
      }
    });

    it('should accept but not execute script tags', () => {
      const result = createSubjectSchema.safeParse({
        name: '<script>alert("XSS")</script>',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // String is accepted, but should be escaped on display
        expect(result.data.name).toBe('<script>alert("XSS")</script>');
      }
    });

    it('should handle special characters safely', () => {
      const result = createSubjectSchema.safeParse({
        name: 'Math & Physics <> "Quotes"',
      });

      expect(result.success).toBe(true);
    });
  });
});
