/**
 * Sync Engine - Core synchronization logic for offline-first architecture.
 * Manages operation queue, conflict resolution, and automatic sync.
 */

import { getData, setData, STORAGE_KEYS } from "./storage.js";
import * as api from "./mockApi.js";

// Operation types
export const OP_TYPES = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
};

// Sync states
export const SYNC_STATES = {
  IDLE: "idle",
  SYNCING: "syncing",
  ERROR: "error",
};

// Configuration
const CONFIG = {
  maxRetries: 3,
  baseRetryDelay: 1000, // 1 second
  syncDebounceMs: 500, // Debounce rapid syncs
  batchSize: 10, // Max operations per sync batch
};

// Event listeners
const listeners = new Map();

export function subscribe(event, callback) {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event).add(callback);

  return () => {
    listeners.get(event)?.delete(callback);
  };
}

/**
 * Emit an event to all subscribers
 */
function emit(event, data) {
  listeners.get(event)?.forEach((callback) => {
    try {
      callback(data);
    } catch (error) {
      console.error(`[SyncEngine] Error in ${event} listener:`, error);
    }
  });
}

/**
 * Generate unique operation ID
 */
function generateOpId() {
  return `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export async function getQueue() {
  const queue = await getData(STORAGE_KEYS.QUEUE);
  return Array.isArray(queue) ? queue : [];
}

async function saveQueue(queue) {
  await setData(STORAGE_KEYS.QUEUE, queue);
}

export async function queueOperation(type, taskId, data = null) {
  const queue = await getQueue();

  // For UPDATE/DELETE, merge with existing pending operations on same task
  const existingIndex = queue.findIndex(
    (op) => op.taskId === taskId && op.status === "pending",
  );

  let operation;

  if (existingIndex >= 0 && type === OP_TYPES.UPDATE) {
    // Merge UPDATE into existing operation
    const existing = queue[existingIndex];
    operation = {
      ...existing,
      data: { ...existing.data, ...data },
      timestamp: Date.now(),
    };
    queue[existingIndex] = operation;
  } else if (existingIndex >= 0 && type === OP_TYPES.DELETE) {
    // DELETE supersedes any pending operation
    const existing = queue[existingIndex];
    if (existing.type === OP_TYPES.CREATE) {
      // Task was created offline and deleted before sync - remove from queue entirely
      queue.splice(existingIndex, 1);
      operation = null;
    } else {
      // Convert to DELETE
      operation = {
        ...existing,
        type: OP_TYPES.DELETE,
        data: null,
        timestamp: Date.now(),
      };
      queue[existingIndex] = operation;
    }
  } else {
    // New operation
    operation = {
      id: generateOpId(),
      type,
      taskId,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      status: "pending",
    };
    queue.push(operation);
  }

  await saveQueue(queue);

  if (operation) {
    emit("operationQueued", operation);
    console.log(`[SyncEngine] Queued ${type} for task ${taskId}`);
  }

  return operation;
}

async function processOperation(operation) {
  try {
    let result;

    switch (operation.type) {
      case OP_TYPES.CREATE:
        result = await api.createTask(operation.data);
        break;

      case OP_TYPES.UPDATE:
        result = await api.updateTask(operation.taskId, operation.data);
        break;

      case OP_TYPES.DELETE:
        result = await api.deleteTask(operation.taskId);
        break;

      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }

    return { success: true, result };
  } catch (error) {
    return { success: false, error };
  }
}

export function resolveConflict(localTask, serverTask) {
  if (!serverTask) {
    // Task doesn't exist on server, local wins
    return {
      hasConflict: false,
      resolution: "local",
      mergedTask: localTask,
    };
  }

  if (!localTask) {
    // Task was deleted locally but exists on server
    return {
      hasConflict: true,
      resolution: "server",
      mergedTask: serverTask,
    };
  }

  // Compare timestamps - Last Write Wins
  const localTime = localTask.updatedAt || 0;
  const serverTime = serverTask.updatedAt || 0;

  if (serverTime > localTime) {
    // Server version is newer
    return {
      hasConflict: true,
      resolution: "server",
      mergedTask: serverTask,
    };
  }

  // Local version is newer or equal - local wins
  return {
    hasConflict: serverTime !== localTime,
    resolution: "local",
    mergedTask: localTask,
  };
}

// Sync state
let currentState = SYNC_STATES.IDLE;
let syncInProgress = false;
let pendingSync = false;
let syncTimeoutId = null;

/**
 * Get current sync state
 */
export function getSyncState() {
  return currentState;
}

/**
 * Set sync state and emit event
 */
function setSyncState(state) {
  if (currentState !== state) {
    currentState = state;
    emit("stateChange", state);
  }
}

export async function processQueue(options = {}) {
  if (syncInProgress) {
    pendingSync = true;
    return { processed: 0, failed: 0, conflicts: 0 };
  }

  if (!navigator.onLine) {
    console.log("[SyncEngine] Offline, skipping sync");
    return { processed: 0, failed: 0, conflicts: 0 };
  }

  syncInProgress = true;
  setSyncState(SYNC_STATES.SYNCING);

  const results = { processed: 0, failed: 0, conflicts: 0 };

  try {
    let queue = await getQueue();
    const pendingOps = queue.filter((op) => op.status === "pending");

    console.log(
      `[SyncEngine] Processing ${pendingOps.length} pending operations`,
    );

    for (const operation of pendingOps.slice(0, CONFIG.batchSize)) {
      // Mark as syncing
      operation.status = "syncing";
      await saveQueue(queue);

      const { success, result, error } = await processOperation(operation);

      if (success) {
        // Handle CREATE - notify about new server ID
        if (operation.type === OP_TYPES.CREATE && options.onTaskCreated) {
          options.onTaskCreated(operation.taskId, result);
        }

        // Remove from queue
        queue = queue.filter((op) => op.id !== operation.id);
        await saveQueue(queue);

        emit("operationComplete", { operation, result });
        results.processed++;

        console.log(
          `[SyncEngine] Completed ${operation.type} for task ${operation.taskId}`,
        );
      } else {
        // Handle failure
        operation.retryCount++;

        if (operation.retryCount >= CONFIG.maxRetries) {
          operation.status = "failed";
          emit("error", { operation, error });
          results.failed++;
          console.error(
            `[SyncEngine] Failed after ${CONFIG.maxRetries} retries:`,
            error,
          );
        } else {
          operation.status = "pending";
          console.log(
            `[SyncEngine] Retry ${operation.retryCount}/${CONFIG.maxRetries} for ${operation.type}`,
          );
        }

        await saveQueue(queue);
      }
    }

    // Update sync timestamp
    await setData(STORAGE_KEYS.LAST_SYNC, Date.now());

    setSyncState(results.failed > 0 ? SYNC_STATES.ERROR : SYNC_STATES.IDLE);
  } catch (error) {
    console.error("[SyncEngine] Sync error:", error);
    setSyncState(SYNC_STATES.ERROR);
    emit("error", { error });
  } finally {
    syncInProgress = false;

    // If another sync was requested while processing, schedule it
    if (pendingSync) {
      pendingSync = false;
      scheduleSync(options);
    }
  }

  return results;
}

/**
 * Schedule a debounced sync
 */
export function scheduleSync(options = {}) {
  if (syncTimeoutId) {
    clearTimeout(syncTimeoutId);
  }

  syncTimeoutId = setTimeout(() => {
    syncTimeoutId = null;
    processQueue(options);
  }, CONFIG.syncDebounceMs);
}

export async function fetchAndMerge(localTasks) {
  if (!navigator.onLine) {
    return { tasks: localTasks, conflicts: [] };
  }

  try {
    const serverTasks = await api.getTasks();
    const conflicts = [];
    const mergedTasks = new Map();

    // Add all server tasks
    serverTasks.forEach((task) => {
      mergedTasks.set(task.id, task);
    });

    // Merge local tasks
    localTasks.forEach((localTask) => {
      const serverTask = mergedTasks.get(localTask.id);

      if (serverTask) {
        // Task exists on both - resolve conflict
        const resolution = resolveConflict(localTask, serverTask);
        mergedTasks.set(localTask.id, resolution.mergedTask);

        if (resolution.hasConflict) {
          conflicts.push({
            taskId: localTask.id,
            localVersion: localTask,
            serverVersion: serverTask,
            resolution: resolution.resolution,
          });
        }
      } else if (localTask.id.startsWith("local_")) {
        // Local-only task (not yet synced to server)
        mergedTasks.set(localTask.id, localTask);
      }
      // If task is not on server and doesn't have local_ prefix,
      // it was deleted on server - don't add it
    });

    if (conflicts.length > 0) {
      console.log(`[SyncEngine] Resolved ${conflicts.length} conflicts`);
      conflicts.forEach((c) => emit("conflict", c));
    }

    return {
      tasks: Array.from(mergedTasks.values()),
      conflicts,
    };
  } catch (error) {
    console.error("[SyncEngine] Fetch error:", error);
    return { tasks: localTasks, conflicts: [] };
  }
}

/**
 * Get pending operation count
 */
export async function getPendingCount() {
  const queue = await getQueue();
  return queue.filter((op) => op.status === "pending").length;
}

/**
 * Get failed operation count
 */
export async function getFailedCount() {
  const queue = await getQueue();
  return queue.filter((op) => op.status === "failed").length;
}

/**
 * Retry failed operations
 */
export async function retryFailed() {
  const queue = await getQueue();
  let updated = false;

  queue.forEach((op) => {
    if (op.status === "failed") {
      op.status = "pending";
      op.retryCount = 0;
      updated = true;
    }
  });

  if (updated) {
    await saveQueue(queue);
    scheduleSync();
  }
}

/**
 * Clear all failed operations
 */
export async function clearFailed() {
  const queue = await getQueue();
  const filtered = queue.filter((op) => op.status !== "failed");
  await saveQueue(filtered);
}

/**
 * Clear entire queue (use with caution)
 */
export async function clearQueue() {
  await saveQueue([]);
  console.log("[SyncEngine] Queue cleared");
}
