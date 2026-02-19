/**
 * Subject Service Tests
 * 
 * Tests for Requirement 1: Subject CRUD operations with validation
 * - Create, edit, delete, and list study subjects
 * - Prevent duplicate or empty subject names
 * - Handle deleted subjects referenced by sessions
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db, ObjectId } from 'mongodb';
import {
  createSubject,
  getSubjectById,
  getAllSubjects,
  updateSubject,
  deleteSubject,
  subjectExists,
} from '../repository_after/src/services/subjectService';

let mongoServer: MongoMemoryServer;
let client: MongoClient;
let db: Db;

// Mock the database module
jest.mock('../repository_after/src/lib/db', () => ({
  getDatabase: jest.fn(() => db),
  getMongoClient: jest.fn(() => client),
}));

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    binary: {
      version: '7.0.3',
    },
    instance: {
      launchTimeout: 60000,
    },
  });
  const uri = mongoServer.getUri();
  client = new MongoClient(uri);
  await client.connect();
  db = client.db('study_planner_test');
}, 120000);

afterAll(async () => {
  if (client) {
    await client.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  // Clear all collections before each test
  const collections = await db.listCollections().toArray();
  for (const collection of collections) {
    await db.collection(collection.name).deleteMany({});
  }
});

describe('Requirement 1: Subject Management', () => {
  describe('TC-01: Create subject with valid data', () => {
    it('should create a subject with name and description', async () => {
      const input = {
        name: 'Mathematics',
        description: 'Advanced calculus and algebra',
      };

      const subject = await createSubject(input);

      expect(subject).toBeDefined();
      expect(subject.id).toBeDefined();
      expect(subject.name).toBe('Mathematics');
      expect(subject.description).toBe('Advanced calculus and algebra');
      expect(subject.createdAt).toBeDefined();
      expect(subject.updatedAt).toBeDefined();
    });

    it('should create a subject without description', async () => {
      const input = {
        name: 'Physics',
      };

      const subject = await createSubject(input);

      expect(subject).toBeDefined();
      expect(subject.name).toBe('Physics');
      expect(subject.description).toBeUndefined();
    });
  });

  describe('TC-02: Prevent empty or whitespace-only subject names', () => {
    it('should reject empty subject name', async () => {
      const input = {
        name: '',
      };

      await expect(createSubject(input)).rejects.toThrow();
    });

    it('should reject whitespace-only subject name', async () => {
      const input = {
        name: '   ',
      };

      await expect(createSubject(input)).rejects.toThrow();
    });

    it('should trim and accept subject name with leading/trailing spaces', async () => {
      const input = {
        name: '  Chemistry  ',
      };

      const subject = await createSubject(input);
      expect(subject.name).toBe('Chemistry');
    });
  });

  describe('TC-03: Prevent duplicate subject names (case-insensitive)', () => {
    it('should reject duplicate subject name with exact match', async () => {
      await createSubject({ name: 'Biology' });

      await expect(createSubject({ name: 'Biology' })).rejects.toThrow(
        'already exists'
      );
    });

    it('should reject duplicate subject name with different case', async () => {
      await createSubject({ name: 'History' });

      await expect(createSubject({ name: 'HISTORY' })).rejects.toThrow(
        'already exists'
      );
    });

    it('should reject duplicate subject name with mixed case', async () => {
      await createSubject({ name: 'Geography' });

      await expect(createSubject({ name: 'gEoGrApHy' })).rejects.toThrow(
        'already exists'
      );
    });
  });

  describe('TC-04: List all subjects', () => {
    it('should return empty array when no subjects exist', async () => {
      const subjects = await getAllSubjects();
      expect(subjects).toEqual([]);
    });

    it('should return all subjects', async () => {
      await createSubject({ name: 'Math' });
      await createSubject({ name: 'Science' });
      await createSubject({ name: 'English' });

      const subjects = await getAllSubjects();
      expect(subjects).toHaveLength(3);
    });

    it('should sort subjects by createdAt descending by default', async () => {
      const math = await createSubject({ name: 'Math' });
      await new Promise(resolve => setTimeout(resolve, 10));
      const science = await createSubject({ name: 'Science' });

      const subjects = await getAllSubjects();
      expect(subjects[0].id).toBe(science.id);
      expect(subjects[1].id).toBe(math.id);
    });
  });

  describe('TC-05: Update subject', () => {
    it('should update subject name', async () => {
      const subject = await createSubject({ name: 'Maths' });

      const updated = await updateSubject(subject.id, { name: 'Mathematics' });

      expect(updated.name).toBe('Mathematics');
      expect(updated.id).toBe(subject.id);
    });

    it('should update subject description', async () => {
      const subject = await createSubject({ name: 'Physics' });

      const updated = await updateSubject(subject.id, {
        description: 'Quantum mechanics',
      });

      expect(updated.description).toBe('Quantum mechanics');
    });

    it('should prevent duplicate name when updating', async () => {
      const subject1 = await createSubject({ name: 'Chemistry' });
      await createSubject({ name: 'Biology' });

      await expect(
        updateSubject(subject1.id, { name: 'Biology' })
      ).rejects.toThrow('already exists');
    });

    it('should reject update with no fields', async () => {
      const subject = await createSubject({ name: 'History' });

      await expect(updateSubject(subject.id, {})).rejects.toThrow();
    });
  });

  describe('TC-06: Delete subject', () => {
    it('should delete existing subject', async () => {
      const subject = await createSubject({ name: 'Geography' });

      const deleted = await deleteSubject(subject.id);

      expect(deleted).toBe(true);

      const found = await getSubjectById(subject.id);
      expect(found).toBeNull();
    });

    it('should return false when deleting non-existent subject', async () => {
      const deleted = await deleteSubject('507f1f77bcf86cd799439011');

      expect(deleted).toBe(false);
    });

    it('should allow deletion even if subject is referenced by sessions', async () => {
      // This test verifies that deletion doesn't check for references
      // The requirement states sessions can reference deleted subjects
      const subject = await createSubject({ name: 'Music' });

      // Create a session referencing this subject
      await db.collection('study_sessions').insertOne({
        subjectId: new ObjectId(subject.id),
        duration: 3600,
        timestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const deleted = await deleteSubject(subject.id);
      expect(deleted).toBe(true);
    });
  });

  describe('TC-07: Get subject by ID', () => {
    it('should return subject when found', async () => {
      const created = await createSubject({ name: 'Art' });

      const found = await getSubjectById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.name).toBe('Art');
    });

    it('should return null when subject not found', async () => {
      const found = await getSubjectById('507f1f77bcf86cd799439011');

      expect(found).toBeNull();
    });
  });

  describe('TC-08: Subject exists check', () => {
    it('should return true for existing subject', async () => {
      const subject = await createSubject({ name: 'Drama' });

      const exists = await subjectExists(subject.id);

      expect(exists).toBe(true);
    });

    it('should return false for non-existent subject', async () => {
      const exists = await subjectExists('507f1f77bcf86cd799439011');

      expect(exists).toBe(false);
    });
  });

  describe('TC-09: Subject name length validation', () => {
    it('should accept subject name with 100 characters', async () => {
      const name = 'A'.repeat(100);
      const subject = await createSubject({ name });

      expect(subject.name).toBe(name);
    });

    it('should reject subject name exceeding 100 characters', async () => {
      const name = 'A'.repeat(101);

      await expect(createSubject({ name })).rejects.toThrow();
    });
  });

  describe('TC-10: Subject description length validation', () => {
    it('should accept description with 500 characters', async () => {
      const description = 'A'.repeat(500);
      const subject = await createSubject({
        name: 'Test',
        description,
      });

      expect(subject.description).toBe(description);
    });

    it('should reject description exceeding 500 characters', async () => {
      const description = 'A'.repeat(501);

      await expect(
        createSubject({ name: 'Test', description })
      ).rejects.toThrow();
    });
  });
});
