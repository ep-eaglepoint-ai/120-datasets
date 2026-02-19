/**
 * Offline Manager Tests
 * @jest-environment jsdom
 *
 * Tests for offline persistence, sync queue, partial writes,
 * and behavior when navigator.onLine is false.
 */

import {
  cacheData,
  getCachedData,
  addToSyncQueue,
  processSyncQueue,
  OfflineManager,
  SyncQueueItem,
} from '../repository_after/src/lib/offline-manager';

const STORAGE_KEYS = OfflineManager.KEYS;

describe('Offline Manager: cache persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should round-trip data with cacheData and getCachedData', () => {
    const data = { totalStudyTime: 3600, sessionCount: 5 };
    cacheData('test_key', data);
    const retrieved = getCachedData<typeof data>('test_key');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.totalStudyTime).toBe(3600);
    expect(retrieved!.sessionCount).toBe(5);
  });

  it('should return null for missing key', () => {
    const retrieved = getCachedData('nonexistent_key');
    expect(retrieved).toBeNull();
  });

  it('should overwrite existing key', () => {
    cacheData('key', { a: 1 });
    cacheData('key', { a: 2 });
    expect(getCachedData<{ a: number }>('key')!.a).toBe(2);
  });

  it('stale cache handling: getCachedData returns cached value as-is (no automatic invalidation)', () => {
    const data = { stats: 'old' };
    cacheData(STORAGE_KEYS.CACHED_STATS, data);
    const retrieved = getCachedData<typeof data>(STORAGE_KEYS.CACHED_STATS);
    expect(retrieved).toEqual(data);
    expect(retrieved!.stats).toBe('old');
  });
});

describe('Offline Manager: sync queue', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('addToSyncQueue should append to queue and persist', () => {
    const payload = { name: 'Math', description: 'Algebra' };
    addToSyncQueue(STORAGE_KEYS.PENDING_SUBJECTS, payload);
    const queue = getCachedData<SyncQueueItem<typeof payload>[]>(STORAGE_KEYS.PENDING_SUBJECTS);
    expect(queue).not.toBeNull();
    expect(queue!).toHaveLength(1);
    expect(queue![0].data).toEqual(payload);
    expect(queue![0].id).toBeDefined();
    expect(typeof queue![0].timestamp).toBe('number');
  });

  it('addToSyncQueue should append multiple items', () => {
    addToSyncQueue(STORAGE_KEYS.PENDING_SESSIONS, { subjectId: '1', duration: 3600, timestamp: new Date().toISOString() });
    addToSyncQueue(STORAGE_KEYS.PENDING_SESSIONS, { subjectId: '2', duration: 1800, timestamp: new Date().toISOString() });
    const queue = getCachedData<any[]>(STORAGE_KEYS.PENDING_SESSIONS);
    expect(queue).toHaveLength(2);
  });
});

describe('Offline Manager: processSyncQueue', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    Object.defineProperty(global.navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  it('should not call fetch when navigator.onLine is false', async () => {
    addToSyncQueue(STORAGE_KEYS.PENDING_SUBJECTS, { name: 'Test' });
    Object.defineProperty(global.navigator, 'onLine', { value: false, writable: true, configurable: true });
    await processSyncQueue();
    expect(fetchMock).not.toHaveBeenCalled();
    const queue = getCachedData<any[]>(STORAGE_KEYS.PENDING_SUBJECTS);
    expect(queue).toHaveLength(1);
  });

  it('should remove item from queue on successful sync (subjects)', async () => {
    const payload = { name: 'Math' };
    addToSyncQueue(STORAGE_KEYS.PENDING_SUBJECTS, payload);
    fetchMock.mockResolvedValueOnce({ ok: true });
    await processSyncQueue();
    const queue = getCachedData<any[]>(STORAGE_KEYS.PENDING_SUBJECTS);
    expect(queue).toHaveLength(0);
  });

  it('should keep item in queue on failed sync (partial write / retry later)', async () => {
    const payload = { name: 'Math' };
    addToSyncQueue(STORAGE_KEYS.PENDING_SUBJECTS, payload);
    fetchMock.mockResolvedValueOnce({ ok: false });
    await processSyncQueue();
    const queue = getCachedData<any[]>(STORAGE_KEYS.PENDING_SUBJECTS);
    expect(queue).toHaveLength(1);
    expect(queue![0].data).toEqual(payload);
  });

  it('should keep item in queue on network error', async () => {
    const payload = { name: 'Physics' };
    addToSyncQueue(STORAGE_KEYS.PENDING_SUBJECTS, payload);
    fetchMock.mockRejectedValueOnce(new Error('Network error'));
    await processSyncQueue();
    const queue = getCachedData<any[]>(STORAGE_KEYS.PENDING_SUBJECTS);
    expect(queue).toHaveLength(1);
  });

  it('should sync subjects first then sessions', async () => {
    addToSyncQueue(STORAGE_KEYS.PENDING_SUBJECTS, { name: 'A' });
    addToSyncQueue(STORAGE_KEYS.PENDING_SESSIONS, {
      subjectId: '507f1f77bcf86cd799439011',
      duration: 3600,
      timestamp: new Date().toISOString(),
    });
    fetchMock.mockResolvedValue({ ok: true });
    await processSyncQueue();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/subjects',
      expect.objectContaining({ method: 'POST' })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/sessions',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('should leave failed items in queue and remove successful ones (partial write)', async () => {
    addToSyncQueue(STORAGE_KEYS.PENDING_SUBJECTS, { name: 'Success' });
    addToSyncQueue(STORAGE_KEYS.PENDING_SUBJECTS, { name: 'Fail' });
    const queueBefore = getCachedData<any[]>(STORAGE_KEYS.PENDING_SUBJECTS)!;
    expect(queueBefore).toHaveLength(2);
    fetchMock
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false });
    await processSyncQueue();
    const queueAfter = getCachedData<any[]>(STORAGE_KEYS.PENDING_SUBJECTS);
    expect(queueAfter).toHaveLength(1);
    expect(queueAfter![0].data.name).toBe('Fail');
  });
});
