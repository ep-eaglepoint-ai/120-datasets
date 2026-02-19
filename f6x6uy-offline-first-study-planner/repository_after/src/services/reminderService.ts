/**
 * Reminder Service
 * 
 * Business logic for managing study reminders.
 * Handles reminder CRUD operations and scheduling logic.
 */

import { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/db';
import { Reminder, ReminderResponse } from '@/types';
import { reminderToResponse, toObjectId } from '@/lib/utils';
import { subjectExists, getSubjectsByIds } from './subjectService';
import {
  createReminderSchema,
  updateReminderSchema,
  CreateReminderInput,
  UpdateReminderInput,
} from '@/lib/validations';

const COLLECTION_NAME = 'reminders';

// ============================================================================
// Create Reminder
// ============================================================================

/**
 * Create a new reminder
 * 
 * @param input - Reminder creation data
 * @returns Created reminder response
 * @throws Error if subject doesn't exist (when subjectId provided)
 */
export async function createReminder(input: CreateReminderInput): Promise<ReminderResponse> {
  // Validate input
  const validated = createReminderSchema.parse(input);

  // Check if subject exists (if subjectId provided)
  if (validated.subjectId) {
    const subjectExistsResult = await subjectExists(validated.subjectId);
    if (!subjectExistsResult) {
      throw new Error('Subject not found');
    }
  }

  const db = await getDatabase();
  const collection = db.collection<Reminder>(COLLECTION_NAME);

  // Create reminder document
  const now = new Date();
  const reminder: Omit<Reminder, '_id'> = {
    label: validated.label,
    triggerTime: validated.triggerTime,
    recurrence: validated.recurrence,
    subjectId: validated.subjectId ? toObjectId(validated.subjectId) : undefined,
    isActive: validated.isActive,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(reminder as Reminder);
  
  const createdReminder = await collection.findOne({ _id: result.insertedId });
  if (!createdReminder) {
    throw new Error('Failed to retrieve created reminder');
  }

  // Get subject name if applicable
  let subjectName: string | undefined;
  if (createdReminder.subjectId) {
    const subjectMap = await getSubjectsByIds([createdReminder.subjectId.toString()]);
    const subject = subjectMap.get(createdReminder.subjectId.toString());
    subjectName = subject?.name;
  }

  return reminderToResponse(createdReminder, subjectName);
}

// ============================================================================
// Get Reminder
// ============================================================================

/**
 * Get a reminder by ID
 * 
 * @param id - Reminder ID
 * @returns Reminder response or null if not found
 */
export async function getReminderById(id: string): Promise<ReminderResponse | null> {
  const db = await getDatabase();
  const collection = db.collection<Reminder>(COLLECTION_NAME);

  const reminder = await collection.findOne({ _id: toObjectId(id) });
  
  if (!reminder) {
    return null;
  }

  // Get subject name if applicable
  let subjectName: string | undefined;
  if (reminder.subjectId) {
    const subjectMap = await getSubjectsByIds([reminder.subjectId.toString()]);
    const subject = subjectMap.get(reminder.subjectId.toString());
    subjectName = subject?.name;
  }

  return reminderToResponse(reminder, subjectName);
}

/**
 * Get all reminders with optional filters
 * 
 * @param options - Query options (filters, pagination, sorting)
 * @returns Array of reminder responses
 */
export async function getAllReminders(options?: {
  isActive?: boolean;
  subjectId?: string;
  upcoming?: boolean; // Only future reminders
  page?: number;
  limit?: number;
  sortBy?: 'triggerTime' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}): Promise<ReminderResponse[]> {
  const db = await getDatabase();
  const collection = db.collection<Reminder>(COLLECTION_NAME);

  const {
    isActive,
    subjectId,
    upcoming,
    page = 1,
    limit = 100,
    sortBy = 'triggerTime',
    sortOrder = 'asc',
  } = options || {};

  // Build query filter
  const filter: Record<string, unknown> = {};
  
  if (isActive !== undefined) {
    filter.isActive = isActive;
  }
  
  if (subjectId) {
    filter.subjectId = toObjectId(subjectId);
  }
  
  if (upcoming) {
    filter.triggerTime = { $gte: new Date() };
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const reminders = await collection
    .find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .toArray();

  // Get all unique subject IDs
  const subjectIds = reminders
    .filter(r => r.subjectId)
    .map(r => r.subjectId!.toString());
  const uniqueSubjectIds = [...new Set(subjectIds)];
  const subjectMap = await getSubjectsByIds(uniqueSubjectIds);

  return reminders.map(reminder => {
    let subjectName: string | undefined;
    if (reminder.subjectId) {
      const subject = subjectMap.get(reminder.subjectId.toString());
      subjectName = subject?.name;
    }
    return reminderToResponse(reminder, subjectName);
  });
}

/**
 * Get total count of reminders
 */
export async function getReminderCount(isActive?: boolean): Promise<number> {
  const db = await getDatabase();
  const collection = db.collection<Reminder>(COLLECTION_NAME);
  
  const filter = isActive !== undefined ? { isActive } : {};
  return collection.countDocuments(filter);
}

// ============================================================================
// Update Reminder
// ============================================================================

/**
 * Update a reminder by ID
 * 
 * @param id - Reminder ID
 * @param input - Update data
 * @returns Updated reminder response
 * @throws Error if reminder not found or validation fails
 */
export async function updateReminder(
  id: string,
  input: UpdateReminderInput
): Promise<ReminderResponse> {
  // Validate input
  const validated = updateReminderSchema.parse(input);

  const db = await getDatabase();
  const collection = db.collection<Reminder>(COLLECTION_NAME);

  const objectId = toObjectId(id);

  // Check if reminder exists
  const existingReminder = await collection.findOne({ _id: objectId });
  if (!existingReminder) {
    throw new Error('Reminder not found');
  }

  // Update reminder
  const updateData: Partial<Reminder> = {
    ...validated,
    updatedAt: new Date(),
  };

  const result = await collection.findOneAndUpdate(
    { _id: objectId },
    { $set: updateData },
    { returnDocument: 'after' }
  );

  if (!result) {
    throw new Error('Failed to update reminder');
  }

  // Get subject name if applicable
  let subjectName: string | undefined;
  if (result.subjectId) {
    const subjectMap = await getSubjectsByIds([result.subjectId.toString()]);
    const subject = subjectMap.get(result.subjectId.toString());
    subjectName = subject?.name;
  }

  return reminderToResponse(result, subjectName);
}

// ============================================================================
// Delete Reminder
// ============================================================================

/**
 * Delete a reminder by ID
 * 
 * @param id - Reminder ID
 * @returns True if deleted, false if not found
 */
export async function deleteReminder(id: string): Promise<boolean> {
  const db = await getDatabase();
  const collection = db.collection<Reminder>(COLLECTION_NAME);

  const result = await collection.deleteOne({ _id: toObjectId(id) });
  
  return result.deletedCount > 0;
}

// ============================================================================
// Reminder Scheduling Functions
// ============================================================================

/**
 * Mark a reminder as triggered
 * Updates lastTriggered timestamp
 * 
 * @param id - Reminder ID
 */
export async function markReminderTriggered(id: string): Promise<void> {
  const db = await getDatabase();
  const collection = db.collection<Reminder>(COLLECTION_NAME);

  await collection.updateOne(
    { _id: toObjectId(id) },
    {
      $set: {
        lastTriggered: new Date(),
        updatedAt: new Date(),
      },
    }
  );
}

/**
 * Get due reminders (trigger time has passed and not yet triggered)
 * 
 * @returns Array of due reminders
 */
export async function getDueReminders(): Promise<ReminderResponse[]> {
  const db = await getDatabase();
  const collection = db.collection<Reminder>(COLLECTION_NAME);

  const now = new Date();

  const reminders = await collection
    .find({
      isActive: true,
      triggerTime: { $lte: now },
    })
    .sort({ triggerTime: 1 })
    .toArray();

  // Get all unique subject IDs
  const subjectIds = reminders
    .filter(r => r.subjectId)
    .map(r => r.subjectId!.toString());
  const uniqueSubjectIds = [...new Set(subjectIds)];
  const subjectMap = await getSubjectsByIds(uniqueSubjectIds);

  return reminders.map(reminder => {
    let subjectName: string | undefined;
    if (reminder.subjectId) {
      const subject = subjectMap.get(reminder.subjectId.toString());
      subjectName = subject?.name;
    }
    return reminderToResponse(reminder, subjectName);
  });
}

/**
 * Calculate next trigger time for recurring reminder
 * 
 * @param currentTriggerTime - Current trigger time
 * @param recurrence - Recurrence pattern
 * @returns Next trigger time
 */
export function calculateNextTriggerTime(
  currentTriggerTime: Date,
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly'
): Date | null {
  if (recurrence === 'none') {
    return null;
  }

  const next = new Date(currentTriggerTime);

  switch (recurrence) {
    case 'daily':
      next.setUTCDate(next.getUTCDate() + 1);
      break;
    case 'weekly':
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case 'monthly':
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
  }

  return next;
}

/**
 * Reschedule recurring reminder to next occurrence
 * 
 * @param id - Reminder ID
 */
export async function rescheduleRecurringReminder(id: string): Promise<void> {
  const db = await getDatabase();
  const collection = db.collection<Reminder>(COLLECTION_NAME);

  const reminder = await collection.findOne({ _id: toObjectId(id) });
  
  if (!reminder || reminder.recurrence === 'none') {
    return;
  }

  const nextTriggerTime = calculateNextTriggerTime(reminder.triggerTime, reminder.recurrence);
  
  if (nextTriggerTime) {
    await collection.updateOne(
      { _id: toObjectId(id) },
      {
        $set: {
          triggerTime: nextTriggerTime,
          updatedAt: new Date(),
        },
      }
    );
  }
}
