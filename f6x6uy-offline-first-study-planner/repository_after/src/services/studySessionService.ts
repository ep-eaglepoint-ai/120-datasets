/**
 * Study Session Service
 * 
 * Business logic for managing study sessions.
 * Handles session logging, updates, and prevents invalid operations.
 */

import { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/db';
import { StudySession, StudySessionResponse } from '@/types';
import { sessionToResponse, toObjectId, getDateString } from '@/lib/utils';
import { subjectExists, getSubjectsByIds } from './subjectService';
import {
  createStudySessionSchema,
  updateStudySessionSchema,
  CreateStudySessionInput,
  UpdateStudySessionInput,
} from '@/lib/validations';

const COLLECTION_NAME = 'study_sessions';
const DUPLICATE_SUBMISSION_WINDOW_MS = 5000; // 5 seconds

// ============================================================================
// Create Study Session
// ============================================================================

/**
 * Create a new study session
 * 
 * @param input - Session creation data
 * @returns Created session response
 * @throws Error if subject doesn't exist, duration invalid, or duplicate submission
 */
export async function createStudySession(
  input: CreateStudySessionInput
): Promise<StudySessionResponse> {
  // Validate input
  const validated = createStudySessionSchema.parse(input);

  // Check if subject exists
  const subjectExistsResult = await subjectExists(validated.subjectId);
  if (!subjectExistsResult) {
    throw new Error('Subject not found');
  }

  const db = await getDatabase();
  const collection = db.collection<StudySession>(COLLECTION_NAME);

  // Check for duplicate rapid submissions
  // Prevent same subject, duration, and timestamp within 5 seconds (strictly less than 5s)
  const recentCutoff = new Date(Date.now() - DUPLICATE_SUBMISSION_WINDOW_MS);
  const duplicateSession = await collection.findOne({
    subjectId: toObjectId(validated.subjectId),
    duration: validated.duration,
    timestamp: validated.timestamp,
    createdAt: { $gt: recentCutoff },
  });

  if (duplicateSession) {
    throw new Error('Duplicate session submission detected. Please wait before submitting again.');
  }

  // Create session document
  const now = new Date();
  const session: Omit<StudySession, '_id'> = {
    subjectId: toObjectId(validated.subjectId),
    duration: validated.duration,
    timestamp: validated.timestamp,
    notes: validated.notes,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(session as StudySession);
  
  const createdSession = await collection.findOne({ _id: result.insertedId });
  if (!createdSession) {
    throw new Error('Failed to retrieve created session');
  }

  // Get subject name for response
  const subjectMap = await getSubjectsByIds([validated.subjectId]);
  const subject = subjectMap.get(validated.subjectId);

  return sessionToResponse(createdSession, subject?.name);
}

// ============================================================================
// Get Study Session
// ============================================================================

/**
 * Get a study session by ID
 * 
 * @param id - Session ID
 * @returns Session response or null if not found
 */
export async function getStudySessionById(id: string): Promise<StudySessionResponse | null> {
  const db = await getDatabase();
  const collection = db.collection<StudySession>(COLLECTION_NAME);

  const session = await collection.findOne({ _id: toObjectId(id) });
  
  if (!session) {
    return null;
  }

  // Get subject name
  const subjectMap = await getSubjectsByIds([session.subjectId.toString()]);
  const subject = subjectMap.get(session.subjectId.toString());

  return sessionToResponse(session, subject?.name);
}

/**
 * Get all study sessions with optional filters
 * 
 * @param options - Query options (filters, pagination, sorting)
 * @returns Array of session responses
 */
export async function getAllStudySessions(options?: {
  subjectId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
  sortBy?: 'timestamp' | 'duration' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}): Promise<StudySessionResponse[]> {
  const db = await getDatabase();
  const collection = db.collection<StudySession>(COLLECTION_NAME);

  const {
    subjectId,
    startDate,
    endDate,
    page = 1,
    limit = 100,
    sortBy = 'timestamp',
    sortOrder = 'desc',
  } = options || {};

  // Build query filter
  const filter: Record<string, unknown> = {};
  
  if (subjectId) {
    filter.subjectId = toObjectId(subjectId);
  }
  
  if (startDate || endDate) {
    filter.timestamp = {};
    if (startDate) {
      (filter.timestamp as Record<string, unknown>).$gte = startDate;
    }
    if (endDate) {
      (filter.timestamp as Record<string, unknown>).$lte = endDate;
    }
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const sessions = await collection
    .find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .toArray();

  // Get all unique subject IDs
  const subjectIds = [...new Set(sessions.map(s => s.subjectId.toString()))];
  const subjectMap = await getSubjectsByIds(subjectIds);

  return sessions.map(session => {
    const subject = subjectMap.get(session.subjectId.toString());
    return sessionToResponse(session, subject?.name);
  });
}

/**
 * Get total count of study sessions
 */
export async function getStudySessionCount(subjectId?: string): Promise<number> {
  const db = await getDatabase();
  const collection = db.collection<StudySession>(COLLECTION_NAME);
  
  const filter = subjectId ? { subjectId: toObjectId(subjectId) } : {};
  return collection.countDocuments(filter);
}

// ============================================================================
// Update Study Session
// ============================================================================

/**
 * Update a study session by ID
 * 
 * @param id - Session ID
 * @param input - Update data
 * @returns Updated session response
 * @throws Error if session not found or validation fails
 */
export async function updateStudySession(
  id: string,
  input: UpdateStudySessionInput
): Promise<StudySessionResponse> {
  // Validate input
  const validated = updateStudySessionSchema.parse(input);

  const db = await getDatabase();
  const collection = db.collection<StudySession>(COLLECTION_NAME);

  const objectId = toObjectId(id);

  // Check if session exists
  const existingSession = await collection.findOne({ _id: objectId });
  if (!existingSession) {
    throw new Error('Study session not found');
  }

  // Update session
  const updateData: Partial<StudySession> = {
    ...validated,
    updatedAt: new Date(),
  };

  const result = await collection.findOneAndUpdate(
    { _id: objectId },
    { $set: updateData },
    { returnDocument: 'after' }
  );

  if (!result) {
    throw new Error('Failed to update study session');
  }

  // Get subject name
  const subjectMap = await getSubjectsByIds([result.subjectId.toString()]);
  const subject = subjectMap.get(result.subjectId.toString());

  return sessionToResponse(result, subject?.name);
}

// ============================================================================
// Delete Study Session
// ============================================================================

/**
 * Delete a study session by ID
 * 
 * @param id - Session ID
 * @returns True if deleted, false if not found
 */
export async function deleteStudySession(id: string): Promise<boolean> {
  const db = await getDatabase();
  const collection = db.collection<StudySession>(COLLECTION_NAME);

  const result = await collection.deleteOne({ _id: toObjectId(id) });
  
  return result.deletedCount > 0;
}

// ============================================================================
// Aggregation Functions
// ============================================================================

/**
 * Calculate total study time for a subject
 * 
 * @param subjectId - Subject ID
 * @returns Total time in seconds
 */
export async function getTotalStudyTime(subjectId?: string): Promise<number> {
  const db = await getDatabase();
  const collection = db.collection<StudySession>(COLLECTION_NAME);

  const matchStage = subjectId ? { $match: { subjectId: toObjectId(subjectId) } } : { $match: {} };

  const result = await collection.aggregate([
    matchStage,
    {
      $group: {
        _id: null,
        totalTime: { $sum: '$duration' },
      },
    },
  ]).toArray();

  return result.length > 0 ? result[0].totalTime : 0;
}

/**
 * Get study time breakdown by subject
 * 
 * @returns Array of subject IDs with their total study time
 */
export async function getStudyTimeBySubject(): Promise<Array<{ subjectId: string; totalTime: number; sessionCount: number }>> {
  const db = await getDatabase();
  const collection = db.collection<StudySession>(COLLECTION_NAME);

  const result = await collection.aggregate([
    {
      $group: {
        _id: '$subjectId',
        totalTime: { $sum: '$duration' },
        sessionCount: { $sum: 1 },
      },
    },
    {
      $sort: { totalTime: -1 },
    },
  ]).toArray();

  return result.map(item => ({
    subjectId: item._id.toString(),
    totalTime: item.totalTime,
    sessionCount: item.sessionCount,
  }));
}

/**
 * Get sessions grouped by date
 * 
 * @param startDate - Start date (optional)
 * @param endDate - End date (optional)
 * @returns Map of date string to sessions
 */
export async function getSessionsByDate(
  startDate?: Date,
  endDate?: Date
): Promise<Map<string, StudySession[]>> {
  const db = await getDatabase();
  const collection = db.collection<StudySession>(COLLECTION_NAME);

  const filter: Record<string, unknown> = {};
  if (startDate || endDate) {
    filter.timestamp = {};
    if (startDate) {
      (filter.timestamp as Record<string, unknown>).$gte = startDate;
    }
    if (endDate) {
      (filter.timestamp as Record<string, unknown>).$lte = endDate;
    }
  }

  const sessions = await collection.find(filter).sort({ timestamp: 1 }).toArray();

  const sessionsByDate = new Map<string, StudySession[]>();
  sessions.forEach(session => {
    const dateKey = getDateString(session.timestamp);
    if (!sessionsByDate.has(dateKey)) {
      sessionsByDate.set(dateKey, []);
    }
    sessionsByDate.get(dateKey)!.push(session);
  });

  return sessionsByDate;
}
