/**
 * Storage abstraction layer for offline-first data persistence.
 * Uses window.storage API with in-memory caching for <16ms reads.
 */

// Storage keys for different data types
export const STORAGE_KEYS = {
  TASKS: "offline_tasks",
  QUEUE: "sync_queue",
  SYNC_STATE: "sync_state",
  LAST_SYNC: "last_sync_timestamp",
  DEVICE_ID: "device_id",
};

// In-memory cache for instant reads
const memoryCache = new Map();

/**
 * Generate a unique device ID for conflict resolution
 */
export function getDeviceId() {
  const cached = memoryCache.get(STORAGE_KEYS.DEVICE_ID);
  if (cached) return cached;

  // Generate a simple unique ID
  const id = `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  memoryCache.set(STORAGE_KEYS.DEVICE_ID, id);
  return id;
}

export async function getData(key) {
  // Check memory cache first for <16ms reads
  if (memoryCache.has(key)) {
    return memoryCache.get(key);
  }

  try {
    // Use window.storage async API
    const raw = await window.storage?.getItem(key);
    if (raw === null || raw === undefined) {
      return null;
    }

    const parsed = JSON.parse(raw);
    memoryCache.set(key, parsed);
    return parsed;
  } catch (error) {
    console.error(`[Storage] Error reading key "${key}":`, error);
    return null;
  }
}

export async function setData(key, value) {
  try {
    // Update memory cache immediately for instant reads
    memoryCache.set(key, value);

    // Persist to storage
    const serialized = JSON.stringify(value);
    await window.storage?.setItem(key, serialized);

    return true;
  } catch (error) {
    console.error(`[Storage] Error writing key "${key}":`, error);
    // Keep cache update even if persist fails - prevents data loss
    return false;
  }
}

export async function removeData(key) {
  try {
    memoryCache.delete(key);
    await window.storage?.removeItem(key);
    return true;
  } catch (error) {
    console.error(`[Storage] Error removing key "${key}":`, error);
    return false;
  }
}

/**
 * Clear memory cache (useful for testing)
 */
export function clearCache() {
  memoryCache.clear();
}

export async function initializeStorage() {
  const criticalKeys = [
    STORAGE_KEYS.TASKS,
    STORAGE_KEYS.QUEUE,
    STORAGE_KEYS.SYNC_STATE,
  ];

  await Promise.all(
    criticalKeys.map(async (key) => {
      try {
        const raw = await window.storage?.getItem(key);
        if (raw !== null && raw !== undefined) {
          memoryCache.set(key, JSON.parse(raw));
        }
      } catch (error) {
        console.error(`[Storage] Error preloading key "${key}":`, error);
      }
    }),
  );

  // Initialize device ID
  let deviceId = memoryCache.get(STORAGE_KEYS.DEVICE_ID);
  if (!deviceId) {
    try {
      const raw = await window.storage?.getItem(STORAGE_KEYS.DEVICE_ID);
      if (raw) {
        deviceId = JSON.parse(raw);
        memoryCache.set(STORAGE_KEYS.DEVICE_ID, deviceId);
      } else {
        deviceId = getDeviceId();
        await setData(STORAGE_KEYS.DEVICE_ID, deviceId);
      }
    } catch {
      deviceId = getDeviceId();
    }
  }

  console.log("[Storage] Initialized with device ID:", deviceId);
}

export function getCacheSnapshot() {
  return Object.fromEntries(memoryCache);
}
