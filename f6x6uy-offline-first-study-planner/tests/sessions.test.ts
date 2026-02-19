import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db, ObjectId } from 'mongodb';
import {
  createStudySession,
  getStudySessionById,
  getAllStudySessions,
  updateStudySession,
  deleteStudySession,
  getTotalStudyTime,
} from '../repository_after/src/services/studySessionService';
import { createSubject } from '../repository_after/src/services/subjectService';

let mongoServer: MongoMemoryServer;
let client: MongoClient;
let db: Db;

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
  const collections = await db.listCollections().toArray();
  for (const collection of collections) {
    await db.collection(collection.name).deleteMany({});
  }
});

describe('Requirement 2: Study Session Management', () => {
  describe('TC-11: Create valid study session', () => {
    it('should create session with valid data', async () => {
      const subject = await createSubject({ name: 'Math' });
      const timestamp = new Date('2024-01-15T10:00:00Z');

      const session = await createStudySession({
        subjectId: subject.id,
        duration: 3600, // 1 hour
        timestamp,
        notes: 'Studied calculus',
      });

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.subjectId).toBe(subject.id);
      expect(session.duration).toBe(3600);
      expect(session.notes).toBe('Studied calculus');
    });

    it('should create session without notes', async () => {
      const subject = await createSubject({ name: 'Physics' });

      const session = await createStudySession({
        subjectId: subject.id,
        duration: 1800,
        timestamp: new Date(Date.now() - 60000),
      });

      expect(session.notes).toBeUndefined();
    });
  });

  describe('TC-12: Reject invalid durations', () => {
    it('should reject negative duration', async () => {
      const subject = await createSubject({ name: 'Chemistry' });

      await expect(
        createStudySession({
          subjectId: subject.id,
          duration: -100,
          timestamp: new Date(Date.now() - 60000),
        })
      ).rejects.toThrow();
    });

    it('should reject zero duration', async () => {
      const subject = await createSubject({ name: 'Biology' });

      await expect(
        createStudySession({
          subjectId: subject.id,
          duration: 0,
          timestamp: new Date(Date.now() - 60000),
        })
      ).rejects.toThrow();
    });

    it('should reject duration less than 60 seconds (1 minute)', async () => {
      const subject = await createSubject({ name: 'History' });

      await expect(
        createStudySession({
          subjectId: subject.id,
          duration: 59,
          timestamp: new Date(Date.now() - 60000),
        })
      ).rejects.toThrow();
    });

    it('should accept minimum valid duration (60 seconds)', async () => {
      const subject = await createSubject({ name: 'Geography' });

      const session = await createStudySession({
        subjectId: subject.id,
        duration: 60,
        timestamp: new Date(Date.now() - 60000),
      });

      expect(session.duration).toBe(60);
    });
  });

  describe('TC-13: Reject unrealistically long sessions', () => {
    it('should reject duration exceeding 24 hours (86400 seconds)', async () => {
      const subject = await createSubject({ name: 'Art' });

      await expect(
        createStudySession({
          subjectId: subject.id,
          duration: 86401,
          timestamp: new Date(Date.now() - 60000),
        })
      ).rejects.toThrow();
    });

    it('should accept maximum valid duration (24 hours)', async () => {
      const subject = await createSubject({ name: 'Music' });

      const session = await createStudySession({
        subjectId: subject.id,
        duration: 86400,
        timestamp: new Date(Date.now() - 60000),
      });

      expect(session.duration).toBe(86400);
    });
  });

  describe('TC-14: Prevent duplicate rapid submissions', () => {
    it('should reject duplicate submission within 5 seconds', async () => {
      const subject = await createSubject({ name: 'English' });
      const timestamp = new Date('2024-01-15T10:00:00Z');

      await createStudySession({
        subjectId: subject.id,
        duration: 3600,
        timestamp,
      });

      await expect(
        createStudySession({
          subjectId: subject.id,
          duration: 3600,
          timestamp,
        })
      ).rejects.toThrow('Duplicate session submission');
    });

    it('should allow similar session after 5 seconds', async () => {
      const subject = await createSubject({ name: 'Drama' });
      const timestamp = new Date('2024-01-15T10:00:00Z');

      const session1 = await createStudySession({
        subjectId: subject.id,
        duration: 3600,
        timestamp,
      });

      // Wait for duplicate check window to pass
      await new Promise(resolve => setTimeout(resolve, 5100));

      const session2 = await createStudySession({
        subjectId: subject.id,
        duration: 3600,
        timestamp,
      });

      expect(session2.id).not.toBe(session1.id);
    });

    it('should allow session with different duration immediately', async () => {
      const subject = await createSubject({ name: 'Science' });
      const timestamp = new Date('2024-01-15T10:00:00Z');

      await createStudySession({
        subjectId: subject.id,
        duration: 3600,
        timestamp,
      });

      const session2 = await createStudySession({
        subjectId: subject.id,
        duration: 1800, // Different duration
        timestamp,
      });

      expect(session2).toBeDefined();
    });
  });

  describe('TC-15: Prevent sessions for nonexistent subjects', () => {
    it('should reject session for non-existent subject ID', async () => {
      await expect(
        createStudySession({
          subjectId: '507f1f77bcf86cd799439011',
          duration: 3600,
          timestamp: new Date(Date.now() - 60000),
        })
      ).rejects.toThrow('Subject not found');
    });

    it('should reject session for deleted subject', async () => {
      const subject = await createSubject({ name: 'Deleted Subject' });
      const subjectId = subject.id;

      // Delete the subject
      await db.collection('subjects').deleteOne({ _id: new ObjectId(subjectId) });

      await expect(
        createStudySession({
          subjectId,
          duration: 3600,
          timestamp: new Date(Date.now() - 60000),
        })
      ).rejects.toThrow('Subject not found');
    });
  });

  describe('TC-16: Timestamp validation', () => {
    it('should reject future timestamp', async () => {
      const subject = await createSubject({ name: 'Future Test' });
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      await expect(
        createStudySession({
          subjectId: subject.id,
          duration: 3600,
          timestamp: futureDate,
        })
      ).rejects.toThrow();
    });

    it('should accept current timestamp', async () => {
      const subject = await createSubject({ name: 'Current Test' });

      const session = await createStudySession({
        subjectId: subject.id,
        duration: 3600,
        timestamp: new Date(Date.now() - 60000),
      });

      expect(session).toBeDefined();
    });

    it('should accept backdated timestamp', async () => {
      const subject = await createSubject({ name: 'Past Test' });
      const pastDate = new Date('2024-01-01T10:00:00Z');

      const session = await createStudySession({
        subjectId: subject.id,
        duration: 3600,
        timestamp: pastDate,
      });

      expect(session.timestamp).toBe(pastDate.toISOString());
    });

    it('should reject timestamp before year 2000', async () => {
      const subject = await createSubject({ name: 'Old Test' });
      const oldDate = new Date('1999-12-31T23:59:59Z');

      await expect(
        createStudySession({
          subjectId: subject.id,
          duration: 3600,
          timestamp: oldDate,
        })
      ).rejects.toThrow();
    });
  });

  describe('TC-17: Update study session', () => {
    it('should update session duration', async () => {
      const subject = await createSubject({ name: 'Update Test' });
      const session = await createStudySession({
        subjectId: subject.id,
        duration: 3600,
        timestamp: new Date(Date.now() - 60000),
      });

      const updated = await updateStudySession(session.id, {
        duration: 7200,
      });

      expect(updated.duration).toBe(7200);
    });

    it('should update session notes', async () => {
      const subject = await createSubject({ name: 'Notes Test' });
      const session = await createStudySession({
        subjectId: subject.id,
        duration: 3600,
        timestamp: new Date(Date.now() - 60000),
      });

      const updated = await updateStudySession(session.id, {
        notes: 'Updated notes',
      });

      expect(updated.notes).toBe('Updated notes');
    });

    it('should reject invalid duration on update', async () => {
      const subject = await createSubject({ name: 'Invalid Update' });
      const session = await createStudySession({
        subjectId: subject.id,
        duration: 3600,
        timestamp: new Date(Date.now() - 60000),
      });

      await expect(
        updateStudySession(session.id, { duration: -100 })
      ).rejects.toThrow();
    });
  });

  describe('TC-18: Delete study session', () => {
    it('should delete existing session', async () => {
      const subject = await createSubject({ name: 'Delete Test' });
      const session = await createStudySession({
        subjectId: subject.id,
        duration: 3600,
        timestamp: new Date(Date.now() - 60000),
      });

      const deleted = await deleteStudySession(session.id);

      expect(deleted).toBe(true);

      const found = await getStudySessionById(session.id);
      expect(found).toBeNull();
    });
  });

  describe('TC-19: Filter sessions by subject', () => {
    it('should return only sessions for specified subject', async () => {
      const math = await createSubject({ name: 'Math' });
      const physics = await createSubject({ name: 'Physics' });

      await createStudySession({
        subjectId: math.id,
        duration: 3600,
        timestamp: new Date(Date.now() - 60000),
      });
      await createStudySession({
        subjectId: physics.id,
        duration: 1800,
        timestamp: new Date(Date.now() - 60000),
      });
      await createStudySession({
        subjectId: math.id,
        duration: 2400,
        timestamp: new Date(Date.now() - 60000),
      });

      const mathSessions = await getAllStudySessions({ subjectId: math.id });

      expect(mathSessions).toHaveLength(2);
      expect(mathSessions.every(s => s.subjectId === math.id)).toBe(true);
    });
  });

  describe('TC-20: Calculate total study time', () => {
    it('should calculate total time across all sessions', async () => {
      const subject = await createSubject({ name: 'Total Test' });

      await createStudySession({
        subjectId: subject.id,
        duration: 3600,
        timestamp: new Date(Date.now() - 60000),
      });
      await createStudySession({
        subjectId: subject.id,
        duration: 1800,
        timestamp: new Date(Date.now() - 60000),
      });
      await createStudySession({
        subjectId: subject.id,
        duration: 2400,
        timestamp: new Date(Date.now() - 60000),
      });

      const total = await getTotalStudyTime(subject.id);

      expect(total).toBe(7800); // 3600 + 1800 + 2400
    });

    it('should return 0 for subject with no sessions', async () => {
      const subject = await createSubject({ name: 'Empty Subject' });

      const total = await getTotalStudyTime(subject.id);

      expect(total).toBe(0);
    });
  });
});
