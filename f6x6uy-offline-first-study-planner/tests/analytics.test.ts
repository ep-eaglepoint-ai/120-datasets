
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db, ObjectId } from 'mongodb';
import {
  getStudyStatistics,
  getDailySummary,
  getWeeklySummary,
  getMonthlySummary,
  calculateStudyStreak,
  getDashboardStats,
} from '../repository_after/src/services/analyticsService';
import { createSubject } from '../repository_after/src/services/subjectService';
import { createStudySession } from '../repository_after/src/services/studySessionService';

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

describe('Requirement 3: Total Study Time Computation', () => {
  describe('TC-21: Calculate total study time per subject', () => {
    it('should calculate total time for single subject', async () => {
      const math = await createSubject({ name: 'Math' });

      await createStudySession({
        subjectId: math.id,
        duration: 3600,
        timestamp: new Date('2024-01-15T10:00:00Z'),
      });
      await createStudySession({
        subjectId: math.id,
        duration: 1800,
        timestamp: new Date('2024-01-15T14:00:00Z'),
      });

      const stats = await getStudyStatistics();
      const mathStats = stats.subjectBreakdown.find((s: any) => s.subjectId === math.id);

      expect(mathStats?.totalTime).toBe(5400);
    });

    it('should handle subject with no sessions', async () => {
      const emptySubject = await createSubject({ name: 'Empty' });

      const stats = await getStudyStatistics();
      const emptyStats = stats.subjectBreakdown.find((s: any) => s.subjectId === emptySubject.id);

      expect(emptyStats).toBeUndefined();
    });
  });

  describe('TC-22: Calculate overall total study time', () => {
    it('should sum time across all subjects', async () => {
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

      const stats = await getStudyStatistics();

      expect(stats.totalStudyTime).toBe(5400);
    });

    it('should return 0 when no sessions exist', async () => {
      const stats = await getStudyStatistics();

      expect(stats.totalStudyTime).toBe(0);
      expect(stats.sessionCount).toBe(0);
    });
  });

  describe('TC-23: Handle session edits and deletions', () => {
    it('should reflect updated duration in total time', async () => {
      const subject = await createSubject({ name: 'Test' });

      const session = await createStudySession({
        subjectId: subject.id,
        duration: 3600,
        timestamp: new Date(Date.now() - 60000),
      });

      // Update duration
      await db.collection('study_sessions').updateOne(
        { _id: new ObjectId(session.id) },
        { $set: { duration: 7200 } }
      );

      const stats = await getStudyStatistics();

      expect(stats.totalStudyTime).toBe(7200);
    });

    it('should exclude deleted sessions from total', async () => {
      const subject = await createSubject({ name: 'Test' });

      await createStudySession({
        subjectId: subject.id,
        duration: 3600,
        timestamp: new Date(Date.now() - 60000),
      });
      const session2 = await createStudySession({
        subjectId: subject.id,
        duration: 1800,
        timestamp: new Date(Date.now() - 60000),
      });

      // Delete one session
      await db.collection('study_sessions').deleteOne({ _id: new ObjectId(session2.id) });

      const stats = await getStudyStatistics();

      expect(stats.totalStudyTime).toBe(3600);
    });
  });

  describe('TC-24: Handle large datasets', () => {
    it('should efficiently calculate total for 1000+ sessions', async () => {
      const subject = await createSubject({ name: 'Large Dataset' });

      // Create 1000 sessions
      const sessions = [];
      for (let i = 0; i < 1000; i++) {
        const day = ((i % 28) + 1).toString().padStart(2, '0');
        const hour = Math.floor(i / 60) % 24;
        const minute = i % 60;
        const hourStr = hour.toString().padStart(2, '0');
        const minuteStr = minute.toString().padStart(2, '0');
        sessions.push({
          subjectId: subject.id,
          duration: 60,
          timestamp: `2024-01-${day}T${hourStr}:${minuteStr}:00Z`,
        });
      }

      // Bulk insert for performance
      for (const session of sessions) {
        await createStudySession(session);
      }

      const startTime = Date.now();
      const stats = await getStudyStatistics();
      const endTime = Date.now();

      expect(stats.totalStudyTime).toBe(60000); // 1000 * 60
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in < 5 seconds
    }, 30000);
  });
});

describe('Requirement 4: Progress Statistics', () => {
  describe('TC-25: Daily study summary', () => {
    it('should calculate daily total correctly', async () => {
      const subject = await createSubject({ name: 'Daily Test' });

      await createStudySession({
        subjectId: subject.id,
        duration: 3600,
        timestamp: new Date('2024-01-15T10:00:00Z'),
      });
      await createStudySession({
        subjectId: subject.id,
        duration: 1800,
        timestamp: new Date('2024-01-15T14:00:00Z'),
      });

      const summary = await getDailySummary(new Date('2024-01-15'));

      expect(summary.totalStudyTime).toBe(5400);
      expect(summary.sessionCount).toBe(2);
    });

    it('should return zero for day with no sessions', async () => {
      const summary = await getDailySummary(new Date('2024-01-15'));

      expect(summary.totalStudyTime).toBe(0);
      expect(summary.sessionCount).toBe(0);
    });
  });

  describe('TC-26: Weekly study summary', () => {
    it('should calculate weekly total correctly', async () => {
      const subject = await createSubject({ name: 'Weekly Test' });

      // Monday
      await createStudySession({
        subjectId: subject.id,
        duration: 3600,
        timestamp: new Date('2024-01-15T10:00:00Z'),
      });
      // Wednesday
      await createStudySession({
        subjectId: subject.id,
        duration: 1800,
        timestamp: new Date('2024-01-17T10:00:00Z'),
      });

      const summary = await getWeeklySummary(new Date('2024-01-15'));

      expect(summary.totalStudyTime).toBe(5400);
      expect(summary.sessionCount).toBe(2);
    });
  });

  describe('TC-27: Monthly study summary', () => {
    it('should calculate monthly total correctly', async () => {
      const subject = await createSubject({ name: 'Monthly Test' });

      await createStudySession({
        subjectId: subject.id,
        duration: 3600,
        timestamp: new Date('2024-01-05T10:00:00Z'),
      });
      await createStudySession({
        subjectId: subject.id,
        duration: 1800,
        timestamp: new Date('2024-01-20T10:00:00Z'),
      });

      const summary = await getMonthlySummary(2024, 1);

      expect(summary.totalStudyTime).toBe(5400);
      expect(summary.sessionCount).toBe(2);
    });
  });

  describe('TC-28: Handle gaps in date ranges', () => {
    it('should handle weeks with missing days', async () => {
      const subject = await createSubject({ name: 'Gap Test' });

      // Only Monday and Friday
      await createStudySession({
        subjectId: subject.id,
        duration: 3600,
        timestamp: new Date('2024-01-15T10:00:00Z'),
      });
      await createStudySession({
        subjectId: subject.id,
        duration: 1800,
        timestamp: new Date('2024-01-19T10:00:00Z'),
      });

      const summary = await getWeeklySummary(new Date('2024-01-15'));

      expect(summary.dailySummaries).toHaveLength(7);
      expect(summary.totalStudyTime).toBe(5400);
    });
  });

  describe('TC-29: Per-subject breakdown', () => {
    it('should provide breakdown by subject', async () => {
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

      const stats = await getStudyStatistics();

      expect(stats.subjectBreakdown).toHaveLength(2);
      expect(stats.subjectBreakdown[0].percentage).toBeGreaterThan(0);
      expect(stats.subjectBreakdown[0].percentage + stats.subjectBreakdown[1].percentage).toBeCloseTo(100, 1);
    });
  });
});

describe('Requirement 5: Study Streak Calculation', () => {
  describe('TC-30: Calculate current streak', () => {
    it('should calculate streak for consecutive days', async () => {
      const subject = await createSubject({ name: 'Streak Test' });

      // Use fixed dates in the past to avoid "future" validation issues
      // Current metadata time is ~07:52 UTC, so use something definitely earlier
      const today = new Date();
      today.setUTCHours(2, 0, 0, 0);
      
      const yesterday = new Date(today);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2);

      await createStudySession({
        subjectId: subject.id,
        duration: 3600,
        timestamp: twoDaysAgo,
      });
      await createStudySession({
        subjectId: subject.id,
        duration: 3600,
        timestamp: yesterday,
      });
      await createStudySession({
        subjectId: subject.id,
        duration: 3600,
        timestamp: today,
      });

      const streak = await calculateStudyStreak();

      expect(streak.currentStreak).toBe(3);
    });

    it('should return 0 for broken streak', async () => {
      const subject = await createSubject({ name: 'Broken Streak' });

      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      await createStudySession({
        subjectId: subject.id,
        duration: 3600,
        timestamp: threeDaysAgo,
      });

      const streak = await calculateStudyStreak();

      expect(streak.currentStreak).toBe(0);
    });
  });

  describe('TC-31: Handle multiple sessions same day', () => {
    it('should count day only once with multiple sessions', async () => {
      const subject = await createSubject({ name: 'Same Day Test' });

      const today = new Date();
      today.setUTCHours(2, 0, 0, 0);

      await createStudySession({
        subjectId: subject.id,
        duration: 3600,
        timestamp: new Date(new Date(today).setUTCHours(0, 0, 0, 0)),
      });
      await createStudySession({
        subjectId: subject.id,
        duration: 1800,
        timestamp: new Date(new Date(today).setUTCHours(1, 0, 0, 0)),
      });

      const streak = await calculateStudyStreak();

      expect(streak.currentStreak).toBe(1);
    });
  });

  describe('TC-32: Track longest streak', () => {
    it('should track longest streak in history', async () => {
      const subject = await createSubject({ name: 'Longest Streak' });

      // Create a 5-day streak in the past
      for (let i = 10; i >= 6; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        await createStudySession({
          subjectId: subject.id,
          duration: 3600,
          timestamp: date,
        });
      }

      // Gap

      // Create a 3-day current streak
      for (let i = 2; i >= 0; i--) {
        const date = new Date(Date.now() - 60000);
        date.setDate(date.getDate() - i);
        await createStudySession({
          subjectId: subject.id,
          duration: 3600,
          timestamp: date,
        });
      }

      const streak = await calculateStudyStreak();

      expect(streak.currentStreak).toBe(3);
      expect(streak.longestStreak).toBe(5);
    });
  });

  describe('TC-33: Handle retroactively logged sessions', () => {
    it('should recalculate streak when backdated session added', async () => {
      const subject = await createSubject({ name: 'Retroactive Test' });

      const today = new Date(Date.now() - 60000);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Log today
      await createStudySession({
        subjectId: subject.id,
        duration: 3600,
        timestamp: today,
      });

      let streak = await calculateStudyStreak();
      expect(streak.currentStreak).toBe(1);

      // Add yesterday retroactively
      await createStudySession({
        subjectId: subject.id,
        duration: 3600,
        timestamp: yesterday,
      });

      streak = await calculateStudyStreak();
      expect(streak.currentStreak).toBe(2);
    });
  });

  describe('TC-34: Streak reset on missed day', () => {
    it('should reset current streak after gap', async () => {
      const subject = await createSubject({ name: 'Reset Test' });

      const fourDaysAgo = new Date();
      fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const today = new Date(Date.now() - 60000);

      // Old streak
      await createStudySession({
        subjectId: subject.id,
        duration: 3600,
        timestamp: fourDaysAgo,
      });
      await createStudySession({
        subjectId: subject.id,
        duration: 3600,
        timestamp: threeDaysAgo,
      });

      // Gap of 2 days

      // New streak
      await createStudySession({
        subjectId: subject.id,
        duration: 3600,
        timestamp: today,
      });

      const streak = await calculateStudyStreak();

      expect(streak.currentStreak).toBe(1);
      expect(streak.longestStreak).toBe(2);
    });
  });
});

describe('Dashboard Statistics', () => {
  describe('TC-35: Comprehensive dashboard stats', () => {
    it('should return all required dashboard metrics', async () => {
      const subject = await createSubject({ name: 'Dashboard Test' });

      await createStudySession({
        subjectId: subject.id,
        duration: 3600,
        timestamp: new Date(Date.now() - 60000),
      });

      const stats = await getDashboardStats();

      expect(stats).toHaveProperty('totalSubjects');
      expect(stats).toHaveProperty('totalStudyTime');
      expect(stats).toHaveProperty('totalSessions');
      expect(stats).toHaveProperty('todayStudyTime');
      expect(stats).toHaveProperty('weekStudyTime');
      expect(stats).toHaveProperty('monthStudyTime');
      expect(stats).toHaveProperty('streak');
      expect(stats).toHaveProperty('recentSessions');
      expect(stats).toHaveProperty('topSubjects');
    });
  });
});
