import { useState, useEffect, useCallback, useRef } from "react";
import {
  getData,
  setData,
  initializeStorage,
  STORAGE_KEYS,
} from "../lib/storage.js";
import {
  queueOperation,
  processQueue,
  fetchAndMerge,
  subscribe,
  getPendingCount,
  getFailedCount,
  scheduleSync,
  OP_TYPES,
  SYNC_STATES,
  retryFailed,
} from "../lib/syncEngine.js";

function generateLocalId() {
  return `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function useOfflineStore() {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [syncState, setSyncState] = useState(SYNC_STATES.IDLE);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [errors, setErrors] = useState([]);

  const idMappings = useRef(new Map());

  const updateCounts = useCallback(async () => {
    const pending = await getPendingCount();
    const failed = await getFailedCount();
    setPendingCount(pending);
    setFailedCount(failed);
  }, []);

  const persistTasks = useCallback(async (newTasks) => {
    await setData(STORAGE_KEYS.TASKS, newTasks);
  }, []);

  const handleTaskCreated = useCallback(
    (localId, serverTask) => {
      idMappings.current.set(localId, serverTask.id);

      setTasks((prevTasks) => {
        const updated = prevTasks.map((task) =>
          task.id === localId ? { ...serverTask } : task,
        );
        persistTasks(updated);
        return updated;
      });

      console.log(`[Store] Task ID mapped: ${localId} -> ${serverTask.id}`);
    },
    [persistTasks],
  );

  const refresh = useCallback(async () => {
    if (!navigator.onLine) {
      console.log("[Store] Offline, skipping refresh");
      return;
    }

    try {
      setSyncState(SYNC_STATES.SYNCING);

      // First, process any pending operations
      await processQueue({
        onTaskCreated: handleTaskCreated,
      });

      // Then fetch and merge server data
      const currentTasks = (await getData(STORAGE_KEYS.TASKS)) || [];
      const { tasks: mergedTasks, conflicts } =
        await fetchAndMerge(currentTasks);

      setTasks(mergedTasks);
      await persistTasks(mergedTasks);

      if (conflicts.length > 0) {
        console.log(`[Store] Resolved ${conflicts.length} conflicts`);
      }

      setLastSyncTime(Date.now());
      await updateCounts();
      setSyncState(SYNC_STATES.IDLE);
    } catch (error) {
      console.error("[Store] Refresh error:", error);
      setSyncState(SYNC_STATES.ERROR);
      setErrors((prev) => [
        ...prev,
        { type: "refresh", error, timestamp: Date.now() },
      ]);
    }
  }, [handleTaskCreated, persistTasks, updateCounts]);

  /**
   * Initialize store - load from cache, then sync
   */
  const initialize = useCallback(async () => {
    try {
      setIsLoading(true);

      // Initialize storage layer
      await initializeStorage();

      // Load cached tasks immediately (cache-first)
      const cachedTasks = await getData(STORAGE_KEYS.TASKS);
      if (Array.isArray(cachedTasks) && cachedTasks.length > 0) {
        setTasks(cachedTasks);
        console.log(`[Store] Loaded ${cachedTasks.length} cached tasks`);
      }

      // Load last sync time
      const lastSync = await getData(STORAGE_KEYS.LAST_SYNC);
      if (lastSync) {
        setLastSyncTime(lastSync);
      }

      // Update counts
      await updateCounts();

      setIsInitialized(true);
      setIsLoading(false);

      // Background sync with server if online
      if (navigator.onLine) {
        await refresh();
      }
    } catch (error) {
      console.error("[Store] Initialization error:", error);
      setIsLoading(false);
      setErrors((prev) => [
        ...prev,
        { type: "init", error, timestamp: Date.now() },
      ]);
    }
  }, [updateCounts, refresh]);

  /**
   * Add a new task (optimistic)
   */
  const addTask = useCallback(
    async (title, priority = "medium") => {
      const now = Date.now();
      const localId = generateLocalId();

      const newTask = {
        id: localId,
        title: title.trim(),
        completed: false,
        priority,
        createdAt: now,
        updatedAt: now,
      };

      // Optimistic update
      setTasks((prev) => {
        const updated = [...prev, newTask];
        persistTasks(updated);
        return updated;
      });

      // Queue for sync
      await queueOperation(OP_TYPES.CREATE, localId, newTask);
      await updateCounts();

      // Trigger sync if online
      if (navigator.onLine) {
        scheduleSync({ onTaskCreated: handleTaskCreated });
      }

      console.log(`[Store] Added task: ${title}`);
      return newTask;
    },
    [persistTasks, updateCounts, handleTaskCreated],
  );

  /**
   * Update an existing task (optimistic)
   */
  const updateTask = useCallback(
    async (taskId, updates) => {
      const now = Date.now();

      // Find current task to preserve unchanged fields
      const currentTask = tasks.find((t) => t.id === taskId);
      if (!currentTask) {
        console.error(`[Store] Task not found: ${taskId}`);
        return null;
      }

      const updatedTask = {
        ...currentTask,
        ...updates,
        updatedAt: now,
      };

      // Optimistic update
      setTasks((prev) => {
        const updated = prev.map((task) =>
          task.id === taskId ? updatedTask : task,
        );
        persistTasks(updated);
        return updated;
      });

      // Queue for sync (use server ID if available)
      const serverId = idMappings.current.get(taskId) || taskId;
      await queueOperation(OP_TYPES.UPDATE, serverId, updates);
      await updateCounts();

      // Trigger sync if online
      if (navigator.onLine) {
        scheduleSync({ onTaskCreated: handleTaskCreated });
      }

      console.log(`[Store] Updated task: ${taskId}`);
      return updatedTask;
    },
    [tasks, persistTasks, updateCounts, handleTaskCreated],
  );

  /**
   * Toggle task completion status
   */
  const toggleTask = useCallback(
    async (taskId) => {
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        return updateTask(taskId, { completed: !task.completed });
      }
      return null;
    },
    [tasks, updateTask],
  );

  /**
   * Delete a task (optimistic)
   */
  const deleteTask = useCallback(
    async (taskId) => {
      // Optimistic remove
      setTasks((prev) => {
        const updated = prev.filter((task) => task.id !== taskId);
        persistTasks(updated);
        return updated;
      });

      // Queue for sync (use server ID if available)
      const serverId = idMappings.current.get(taskId) || taskId;
      await queueOperation(OP_TYPES.DELETE, serverId);
      await updateCounts();

      // Trigger sync if online
      if (navigator.onLine) {
        scheduleSync({ onTaskCreated: handleTaskCreated });
      }

      console.log(`[Store] Deleted task: ${taskId}`);
    },
    [persistTasks, updateCounts, handleTaskCreated],
  );

  /**
   * Clear all errors
   */
  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  /**
   * Retry failed operations
   */
  const retryFailedOps = useCallback(async () => {
    await retryFailed();
    await updateCounts();
  }, [updateCounts]);

  // Subscribe to sync engine events
  useEffect(() => {
    const unsubState = subscribe("stateChange", (state) => {
      setSyncState(state);
    });

    const unsubComplete = subscribe("operationComplete", async () => {
      await updateCounts();
    });

    const unsubError = subscribe("error", async ({ operation, error }) => {
      await updateCounts();
      setErrors((prev) => [
        ...prev,
        {
          type: "sync",
          operation,
          error,
          timestamp: Date.now(),
        },
      ]);
    });

    const unsubConflict = subscribe("conflict", (conflict) => {
      console.log("[Store] Conflict resolved:", conflict);
    });

    return () => {
      unsubState();
      unsubComplete();
      unsubError();
      unsubConflict();
    };
  }, [updateCounts]);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Sync when coming back online
  useEffect(() => {
    const handleOnline = () => {
      console.log("[Store] Back online, triggering sync");
      refresh();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [refresh]);

  return {
    // State
    tasks,
    isLoading,
    isInitialized,
    syncState,
    pendingCount,
    failedCount,
    lastSyncTime,
    errors,

    // Actions
    addTask,
    updateTask,
    toggleTask,
    deleteTask,
    refresh,
    clearErrors,
    retryFailedOps,

    // Computed
    activeTasks: tasks.filter((t) => !t.completed),
    completedTasks: tasks.filter((t) => t.completed),
    hasPendingChanges: pendingCount > 0,
    hasErrors: failedCount > 0 || errors.length > 0,
  };
}

export default useOfflineStore;
