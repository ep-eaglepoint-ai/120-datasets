/**
 * Subject Service
 * 
 * Business logic for managing study subjects.
 * Handles CRUD operations with validation and error handling.
 */

import { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/db';
import { Subject, SubjectResponse } from '@/types';
import { subjectToResponse, toObjectId, isDuplicateKeyError } from '@/lib/utils';
import {
  createSubjectSchema,
  updateSubjectSchema,
  CreateSubjectInput,
  UpdateSubjectInput,
} from '@/lib/validations';

const COLLECTION_NAME = 'subjects';

// ============================================================================
// Create Subject
// ============================================================================

/**
 * Create a new study subject
 * 
 * @param input - Subject creation data
 * @returns Created subject response
 * @throws Error if subject name already exists or validation fails
 */
export async function createSubject(input: CreateSubjectInput): Promise<SubjectResponse> {
  // Validate input
  const validated = createSubjectSchema.parse(input);

  const db = await getDatabase();
  const collection = db.collection<Subject>(COLLECTION_NAME);

  // Check for duplicate name (case-insensitive)
  const existingSubject = await collection.findOne({
    name: { $regex: new RegExp(`^${validated.name}$`, 'i') },
  });

  if (existingSubject) {
    throw new Error(`Subject with name "${validated.name}" already exists`);
  }

  // Create subject document
  const now = new Date();
  const subject: Omit<Subject, '_id'> = {
    name: validated.name,
    description: validated.description,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const result = await collection.insertOne(subject as Subject);
    
    const createdSubject = await collection.findOne({ _id: result.insertedId });
    if (!createdSubject) {
      throw new Error('Failed to retrieve created subject');
    }

    return subjectToResponse(createdSubject);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new Error(`Subject with name "${validated.name}" already exists`);
    }
    throw error;
  }
}

// ============================================================================
// Get Subject
// ============================================================================

/**
 * Get a subject by ID
 * 
 * @param id - Subject ID
 * @returns Subject response or null if not found
 */
export async function getSubjectById(id: string): Promise<SubjectResponse | null> {
  const db = await getDatabase();
  const collection = db.collection<Subject>(COLLECTION_NAME);

  const subject = await collection.findOne({ _id: toObjectId(id) });
  
  if (!subject) {
    return null;
  }

  return subjectToResponse(subject);
}

/**
 * Get all subjects with optional pagination
 * 
 * @param options - Query options (pagination, sorting)
 * @returns Array of subject responses
 */
export async function getAllSubjects(options?: {
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}): Promise<SubjectResponse[]> {
  const db = await getDatabase();
  const collection = db.collection<Subject>(COLLECTION_NAME);

  const {
    page = 1,
    limit = 100,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = options || {};

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const subjects = await collection
    .find({})
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .toArray();

  return subjects.map(subjectToResponse);
}

/**
 * Get total count of subjects
 */
export async function getSubjectCount(): Promise<number> {
  const db = await getDatabase();
  const collection = db.collection<Subject>(COLLECTION_NAME);
  return collection.countDocuments({});
}

// ============================================================================
// Update Subject
// ============================================================================

/**
 * Update a subject by ID
 * 
 * @param id - Subject ID
 * @param input - Update data
 * @returns Updated subject response
 * @throws Error if subject not found or validation fails
 */
export async function updateSubject(
  id: string,
  input: UpdateSubjectInput
): Promise<SubjectResponse> {
  // Validate input
  const validated = updateSubjectSchema.parse(input);

  const db = await getDatabase();
  const collection = db.collection<Subject>(COLLECTION_NAME);

  const objectId = toObjectId(id);

  // Check if subject exists
  const existingSubject = await collection.findOne({ _id: objectId });
  if (!existingSubject) {
    throw new Error('Subject not found');
  }

  // Check for duplicate name if name is being updated
  if (validated.name && validated.name !== existingSubject.name) {
    const duplicateSubject = await collection.findOne({
      _id: { $ne: objectId },
      name: { $regex: new RegExp(`^${validated.name}$`, 'i') },
    });

    if (duplicateSubject) {
      throw new Error(`Subject with name "${validated.name}" already exists`);
    }
  }

  // Update subject
  const updateData: Partial<Subject> = {
    ...validated,
    updatedAt: new Date(),
  };

  try {
    const result = await collection.findOneAndUpdate(
      { _id: objectId },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new Error('Failed to update subject');
    }

    return subjectToResponse(result);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new Error(`Subject with name "${validated.name}" already exists`);
    }
    throw error;
  }
}

// ============================================================================
// Delete Subject
// ============================================================================

/**
 * Delete a subject by ID
 * 
 * Note: This does not delete associated study sessions.
 * Sessions will still reference the deleted subject ID.
 * 
 * @param id - Subject ID
 * @returns True if deleted, false if not found
 */
export async function deleteSubject(id: string): Promise<boolean> {
  const db = await getDatabase();
  const collection = db.collection<Subject>(COLLECTION_NAME);

  const result = await collection.deleteOne({ _id: toObjectId(id) });
  
  return result.deletedCount > 0;
}

/**
 * Check if a subject exists
 * 
 * @param id - Subject ID
 * @returns True if subject exists
 */
export async function subjectExists(id: string): Promise<boolean> {
  const db = await getDatabase();
  const collection = db.collection<Subject>(COLLECTION_NAME);

  const count = await collection.countDocuments({ _id: toObjectId(id) });
  
  return count > 0;
}

/**
 * Get subjects by IDs
 * 
 * @param ids - Array of subject IDs
 * @returns Map of subject ID to subject response
 */
export async function getSubjectsByIds(ids: string[]): Promise<Map<string, SubjectResponse>> {
  const db = await getDatabase();
  const collection = db.collection<Subject>(COLLECTION_NAME);

  const objectIds = ids.map(toObjectId);
  const subjects = await collection.find({ _id: { $in: objectIds } }).toArray();

  const subjectMap = new Map<string, SubjectResponse>();
  subjects.forEach((subject) => {
    subjectMap.set(subject._id.toString(), subjectToResponse(subject));
  });

  return subjectMap;
}
