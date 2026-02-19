/**
 * Reminder Service Tests
 *
 * Service/behavior tests for reminder CRUD, recurrence edge cases,
 * missed triggers, and disabled (inactive) reminders.
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db, ObjectId } from 'mongodb';
import {
  createReminder,
  getReminderById,
  getAllReminders,
  getReminderCount,
  updateReminder,
  deleteReminder,
  getDueReminders,
  markReminderTriggered,
  calculateNextTriggerTime,
  rescheduleRecurringReminder,
} from '../repository_after/src/services/reminderService';
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
    binary: { version: '7.0.3' },
    instance: { launchTimeout: 60000 },
  });
  const uri = mongoServer.getUri();
  client = new MongoClient(uri);
  await client.connect();
  db = client.db('study_planner_test');
}, 120000);

afterAll(async () => {
  if (client) await client.close();
  if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
  const collections = await db.listCollections().toArray();
  for (const collection of collections) {
    await db.collection(collection.name).deleteMany({});
  }
});

describe('Reminder CRUD', () => {
  describe('createReminder', () => {
    it('should create reminder without subjectId', async () => {
      const input = {
        label: 'Study Math',
        triggerTime: new Date('2024-01-20T10:00:00Z'),
        recurrence: 'daily' as const,
        isActive: true,
      };
      const reminder = await createReminder(input);
      expect(reminder).toBeDefined();
      expect(reminder.id).toBeDefined();
      expect(reminder.label).toBe('Study Math');
      expect(reminder.triggerTime).toBe('2024-01-20T10:00:00.000Z');
      expect(reminder.recurrence).toBe('daily');
      expect(reminder.isActive).toBe(true);
    });

    it('should create reminder with subjectId when subject exists', async () => {
      const subject = await createSubject({ name: 'Math' });
      const input = {
        label: 'Study Math',
        triggerTime: new Date('2024-01-20T10:00:00Z'),
        recurrence: 'none' as const,
        subjectId: subject.id,
        isActive: true,
      };
      const reminder = await createReminder(input);
      expect(reminder.subjectId).toBe(subject.id);
      expect(reminder.subjectName).toBe('Math');
    });

    it('should throw when subjectId does not exist', async () => {
      const fakeId = new ObjectId().toString();
      const input = {
        label: 'Study',
        triggerTime: new Date('2024-01-20T10:00:00Z'),
        recurrence: 'none' as const,
        subjectId: fakeId,
      };
      await expect(createReminder(input)).rejects.toThrow('Subject not found');
    });

    it('should throw when validation fails (service uses schema)', async () => {
      await expect(
        createReminder({
          label: '',
          triggerTime: new Date('2024-01-20T10:00:00Z'),
          recurrence: 'none',
        })
      ).rejects.toThrow();
    });
  });

  describe('getReminderById', () => {
    it('should return reminder when found', async () => {
      const created = await createReminder({
        label: 'Test',
        triggerTime: new Date('2024-01-20T10:00:00Z'),
        recurrence: 'none',
      });
      const found = await getReminderById(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.label).toBe('Test');
    });

    it('should return null when not found', async () => {
      const found = await getReminderById(new ObjectId().toString());
      expect(found).toBeNull();
    });
  });

  describe('getAllReminders', () => {
    it('should return all reminders with default options', async () => {
      await createReminder({
        label: 'A',
        triggerTime: new Date('2024-01-20T10:00:00Z'),
        recurrence: 'none',
      });
      await createReminder({
        label: 'B',
        triggerTime: new Date('2024-01-21T10:00:00Z'),
        recurrence: 'none',
      });
      const list = await getAllReminders();
      expect(list).toHaveLength(2);
    });

    it('should filter by isActive', async () => {
      await createReminder({
        label: 'Active',
        triggerTime: new Date('2024-01-20T10:00:00Z'),
        recurrence: 'none',
        isActive: true,
      });
      await createReminder({
        label: 'Inactive',
        triggerTime: new Date('2024-01-21T10:00:00Z'),
        recurrence: 'none',
        isActive: false,
      });
      const active = await getAllReminders({ isActive: true });
      const inactive = await getAllReminders({ isActive: false });
      expect(active).toHaveLength(1);
      expect(active[0].label).toBe('Active');
      expect(inactive).toHaveLength(1);
      expect(inactive[0].label).toBe('Inactive');
    });

    it('should filter by subjectId', async () => {
      const subject = await createSubject({ name: 'Physics' });
      await createReminder({
        label: 'For Physics',
        triggerTime: new Date('2024-01-20T10:00:00Z'),
        recurrence: 'none',
        subjectId: subject.id,
      });
      await createReminder({
        label: 'No subject',
        triggerTime: new Date('2024-01-21T10:00:00Z'),
        recurrence: 'none',
      });
      const bySubject = await getAllReminders({ subjectId: subject.id });
      expect(bySubject).toHaveLength(1);
      expect(bySubject[0].subjectId).toBe(subject.id);
    });

    it('should filter upcoming (future trigger time)', async () => {
      const past = new Date();
      past.setTime(past.getTime() - 86400000);
      const future = new Date();
      future.setTime(future.getTime() + 86400000);
      await createReminder({
        label: 'Past',
        triggerTime: past,
        recurrence: 'none',
      });
      await createReminder({
        label: 'Future',
        triggerTime: future,
        recurrence: 'none',
      });
      const upcoming = await getAllReminders({ upcoming: true });
      expect(upcoming).toHaveLength(1);
      expect(upcoming[0].label).toBe('Future');
    });

    it('should support pagination and sort', async () => {
      await createReminder({
        label: 'First',
        triggerTime: new Date('2024-01-20T10:00:00Z'),
        recurrence: 'none',
      });
      await createReminder({
        label: 'Second',
        triggerTime: new Date('2024-01-21T10:00:00Z'),
        recurrence: 'none',
      });
      await createReminder({
        label: 'Third',
        triggerTime: new Date('2024-01-22T10:00:00Z'),
        recurrence: 'none',
      });
      const page1 = await getAllReminders({ page: 1, limit: 2, sortBy: 'triggerTime', sortOrder: 'asc' });
      expect(page1).toHaveLength(2);
      expect(page1[0].label).toBe('First');
      const page2 = await getAllReminders({ page: 2, limit: 2, sortBy: 'triggerTime', sortOrder: 'asc' });
      expect(page2).toHaveLength(1);
      expect(page2[0].label).toBe('Third');
    });
  });

  describe('getReminderCount', () => {
    it('should return total count', async () => {
      await createReminder({
        label: 'A',
        triggerTime: new Date('2024-01-20T10:00:00Z'),
        recurrence: 'none',
      });
      await createReminder({
        label: 'B',
        triggerTime: new Date('2024-01-21T10:00:00Z'),
        recurrence: 'none',
      });
      expect(await getReminderCount()).toBe(2);
    });

    it('should return count filtered by isActive', async () => {
      await createReminder({
        label: 'A',
        triggerTime: new Date('2024-01-20T10:00:00Z'),
        recurrence: 'none',
        isActive: true,
      });
      await createReminder({
        label: 'B',
        triggerTime: new Date('2024-01-21T10:00:00Z'),
        recurrence: 'none',
        isActive: false,
      });
      expect(await getReminderCount(true)).toBe(1);
      expect(await getReminderCount(false)).toBe(1);
    });
  });

  describe('updateReminder', () => {
    it('should update reminder', async () => {
      const created = await createReminder({
        label: 'Original',
        triggerTime: new Date('2024-01-20T10:00:00Z'),
        recurrence: 'none',
      });
      const updated = await updateReminder(created.id, {
        label: 'Updated',
        isActive: false,
      });
      expect(updated.label).toBe('Updated');
      expect(updated.isActive).toBe(false);
    });

    it('should throw when reminder not found', async () => {
      await expect(
        updateReminder(new ObjectId().toString(), { label: 'X' })
      ).rejects.toThrow('Reminder not found');
    });
  });

  describe('deleteReminder', () => {
    it('should delete reminder and return true', async () => {
      const created = await createReminder({
        label: 'To delete',
        triggerTime: new Date('2024-01-20T10:00:00Z'),
        recurrence: 'none',
      });
      const deleted = await deleteReminder(created.id);
      expect(deleted).toBe(true);
      const found = await getReminderById(created.id);
      expect(found).toBeNull();
    });

    it('should return false when reminder not found', async () => {
      const deleted = await deleteReminder(new ObjectId().toString());
      expect(deleted).toBe(false);
    });
  });
});

describe('Recurrence edge cases', () => {
  describe('calculateNextTriggerTime', () => {
    it('should return null for none', () => {
      const base = new Date('2024-01-20T10:00:00Z');
      expect(calculateNextTriggerTime(base, 'none')).toBeNull();
    });

    it('should add one day for daily', () => {
      const base = new Date('2024-01-20T10:00:00Z');
      const next = calculateNextTriggerTime(base, 'daily');
      expect(next).not.toBeNull();
      expect(next!.toISOString()).toBe('2024-01-21T10:00:00.000Z');
    });

    it('should add 7 days for weekly', () => {
      const base = new Date('2024-01-20T10:00:00Z');
      const next = calculateNextTriggerTime(base, 'weekly');
      expect(next).not.toBeNull();
      expect(next!.toISOString()).toBe('2024-01-27T10:00:00.000Z');
    });

    it('should add one month for monthly', () => {
      const base = new Date('2024-01-15T10:00:00Z');
      const next = calculateNextTriggerTime(base, 'monthly');
      expect(next).not.toBeNull();
      expect(next!.toISOString()).toBe('2024-02-15T10:00:00.000Z');
    });

    it('should handle month boundary Jan 31 -> next month (JS rolls Feb 31 to Mar 2/3)', () => {
      const baseJan31 = new Date('2024-01-31T10:00:00Z');
      const next = calculateNextTriggerTime(baseJan31, 'monthly');
      expect(next).not.toBeNull();
      // setUTCMonth(1) on Jan 31 gives Feb 31 -> rolls to Mar 2 in leap year
      expect(next!.getUTCMonth()).toBe(2); // March
      expect(next!.getUTCDate()).toBe(2);
      expect(next!.toISOString()).toBe('2024-03-02T10:00:00.000Z');
    });

    it('should handle non-leap year month boundary Jan 31', () => {
      const baseJan31 = new Date('2023-01-31T10:00:00Z');
      const next = calculateNextTriggerTime(baseJan31, 'monthly');
      expect(next).not.toBeNull();
      // setUTCMonth(1) on Jan 31 gives Feb 31 -> rolls to Mar 3 in non-leap year
      expect(next!.getUTCMonth()).toBe(2); // March
      expect(next!.getUTCDate()).toBe(3);
      expect(next!.toISOString()).toBe('2023-03-03T10:00:00.000Z');
    });
  });

  describe('rescheduleRecurringReminder', () => {
    it('should update triggerTime to next occurrence for daily', async () => {
      const created = await createReminder({
        label: 'Daily',
        triggerTime: new Date('2024-01-20T10:00:00Z'),
        recurrence: 'daily',
      });
      await rescheduleRecurringReminder(created.id);
      const updated = await getReminderById(created.id);
      expect(updated!.triggerTime).toBe('2024-01-21T10:00:00.000Z');
    });

    it('should update triggerTime for weekly', async () => {
      const created = await createReminder({
        label: 'Weekly',
        triggerTime: new Date('2024-01-20T10:00:00Z'),
        recurrence: 'weekly',
      });
      await rescheduleRecurringReminder(created.id);
      const updated = await getReminderById(created.id);
      expect(updated!.triggerTime).toBe('2024-01-27T10:00:00.000Z');
    });

    it('should do nothing for recurrence none', async () => {
      const created = await createReminder({
        label: 'One-time',
        triggerTime: new Date('2024-01-20T10:00:00Z'),
        recurrence: 'none',
      });
      await rescheduleRecurringReminder(created.id);
      const updated = await getReminderById(created.id);
      expect(updated!.triggerTime).toBe('2024-01-20T10:00:00.000Z');
    });

    it('should do nothing when reminder not found', async () => {
      await expect(rescheduleRecurringReminder(new ObjectId().toString())).resolves.not.toThrow();
    });
  });
});

describe('Missed triggers and getDueReminders', () => {
  it('should return only active reminders with triggerTime <= now', async () => {
    const past = new Date();
    past.setTime(past.getTime() - 3600000);
    const future = new Date();
    future.setTime(future.getTime() + 3600000);
    const dueActive = await createReminder({
      label: 'Due active',
      triggerTime: past,
      recurrence: 'none',
      isActive: true,
    });
    await createReminder({
      label: 'Due but inactive',
      triggerTime: past,
      recurrence: 'none',
      isActive: false,
    });
    await createReminder({
      label: 'Future',
      triggerTime: future,
      recurrence: 'none',
      isActive: true,
    });
    const due = await getDueReminders();
    expect(due).toHaveLength(1);
    expect(due[0].id).toBe(dueActive.id);
    expect(due[0].label).toBe('Due active');
  });

  it('should order due reminders by triggerTime ascending', async () => {
    const base = new Date();
    const t1 = new Date(base.getTime() - 7200000);
    const t2 = new Date(base.getTime() - 3600000);
    const r1 = await createReminder({
      label: 'Later',
      triggerTime: t2,
      recurrence: 'none',
      isActive: true,
    });
    const r2 = await createReminder({
      label: 'Earlier',
      triggerTime: t1,
      recurrence: 'none',
      isActive: true,
    });
    const due = await getDueReminders();
    expect(due).toHaveLength(2);
    expect(due[0].triggerTime <= due[1].triggerTime).toBe(true);
    expect(due[0].id).toBe(r2.id);
    expect(due[1].id).toBe(r1.id);
  });
});

describe('markReminderTriggered', () => {
  it('should set lastTriggered on reminder', async () => {
    const created = await createReminder({
      label: 'Trigger me',
      triggerTime: new Date('2024-01-20T10:00:00Z'),
      recurrence: 'none',
    });
    await markReminderTriggered(created.id);
    const updated = await getReminderById(created.id);
    expect(updated!.lastTriggered).toBeDefined();
    expect(typeof updated!.lastTriggered).toBe('string');
  });
});

describe('Disabled permissions (inactive reminders)', () => {
  it('should exclude inactive reminders from getDueReminders', async () => {
    const past = new Date();
    past.setTime(past.getTime() - 3600000);
    await createReminder({
      label: 'Inactive due',
      triggerTime: past,
      recurrence: 'none',
      isActive: false,
    });
    const due = await getDueReminders();
    expect(due).toHaveLength(0);
  });

  it('getAllReminders({ isActive: false }) returns only inactive', async () => {
    await createReminder({
      label: 'Active',
      triggerTime: new Date('2024-01-20T10:00:00Z'),
      recurrence: 'none',
      isActive: true,
    });
    await createReminder({
      label: 'Inactive',
      triggerTime: new Date('2024-01-21T10:00:00Z'),
      recurrence: 'none',
      isActive: false,
    });
    const inactive = await getAllReminders({ isActive: false });
    expect(inactive).toHaveLength(1);
    expect(inactive[0].isActive).toBe(false);
    expect(inactive[0].label).toBe('Inactive');
  });
});
