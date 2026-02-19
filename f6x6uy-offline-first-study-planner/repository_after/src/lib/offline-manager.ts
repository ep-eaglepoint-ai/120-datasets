/**
 * Offline Synchronization Manager
 * 
 * Handles client-side persistence, request queuing, and background synchronization.
 * Ensures the application remains functional without internet access.
 */

const STORAGE_KEYS = {
  PENDING_SESSIONS: 'study_planner_pending_sessions',
  PENDING_SUBJECTS: 'study_planner_pending_subjects',
  CACHED_STATS: 'study_planner_cached_stats',
  CACHED_SUBJECTS: 'study_planner_cached_subjects',
};

export interface SyncQueueItem<T> {
  id: string;
  data: T;
  timestamp: number;
}

/**
 * Save data to local storage for offline access
 */
export function cacheData(key: string, data: any): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Error caching data:', error);
  }
}

/**
 * Retrieve cached data from local storage
 */
export function getCachedData<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error retrieving cached data:', error);
    return null;
  }
}

/**
 * Add a request to the sync queue
 */
export function addToSyncQueue<T>(key: string, data: T): void {
  const queue = getCachedData<SyncQueueItem<T>[]>(key) || [];
  const newItem: SyncQueueItem<T> = {
    id: Math.random().toString(36).substring(2, 11),
    data,
    timestamp: Date.now(),
  };
  queue.push(newItem);
  cacheData(key, queue);
}

/**
 * Process the sync queue
 */
export async function processSyncQueue(): Promise<void> {
  if (typeof window === 'undefined' || !navigator.onLine) return;

  // Sync subjects first (sessions might depend on newer subjects)
  await syncSubjects();
  await syncSessions();
}

async function syncSubjects(): Promise<void> {
  const queue = getCachedData<SyncQueueItem<any>[]>(STORAGE_KEYS.PENDING_SUBJECTS) || [];
  if (queue.length === 0) return;

  const remaining: SyncQueueItem<any>[] = [];

  for (const item of queue) {
    try {
      const response = await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.data),
      });

      if (!response.ok) {
        remaining.push(item);
      }
    } catch (error) {
      remaining.push(item);
    }
  }

  cacheData(STORAGE_KEYS.PENDING_SUBJECTS, remaining);
}

async function syncSessions(): Promise<void> {
  const queue = getCachedData<SyncQueueItem<any>[]>(STORAGE_KEYS.PENDING_SESSIONS) || [];
  if (queue.length === 0) return;

  const remaining: SyncQueueItem<any>[] = [];

  for (const item of queue) {
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.data),
      });

      if (!response.ok) {
        remaining.push(item);
      }
    } catch (error) {
      remaining.push(item);
    }
  }

  cacheData(STORAGE_KEYS.PENDING_SESSIONS, remaining);
}

export const OfflineManager = {
  KEYS: STORAGE_KEYS,
  cacheData,
  getCachedData,
  addToSyncQueue,
  processSyncQueue,
};
