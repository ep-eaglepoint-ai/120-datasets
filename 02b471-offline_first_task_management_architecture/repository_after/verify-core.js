/**
 * Core Logic Verification Script
 * Tests the offline sync engine, queue management, and conflict resolution
 * without requiring a browser environment.
 */

import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Mock browser environment
global.window = {
  storage: {
    _data: new Map(),
    getItem: async (k) => global.window.storage._data.get(k),
    setItem: async (k, v) => global.window.storage._data.set(k, v),
    removeItem: async (k) => global.window.storage._data.delete(k),
  },
  addEventListener: () => {},
  removeEventListener: () => {},
};
// Mock navigator
if (!global.navigator) {
  global.navigator = { onLine: true };
} else {
  // If it exists (e.g. newer Node versions), try to shadow onLine
  Object.defineProperty(global.navigator, "onLine", {
    value: true,
    writable: true,
    configurable: true,
  });
}

// Mock dependencies
console.log("📦 Loading modules...");
const { getData, setData, initializeStorage, STORAGE_KEYS } =
  await import("./src/lib/storage.js");
const syncEngine = await import("./src/lib/syncEngine.js");
const mockApi = await import("./src/lib/mockApi.js");

async function runVerification() {
  console.log("\n🚀 Starting Core Verification\n");
  let errors = 0;

  // Helper for assertions
  const assert = (condition, msg) => {
    if (condition) {
      console.log(`✅ PASS: ${msg}`);
    } else {
      console.error(`❌ FAIL: ${msg}`);
      errors++;
    }
  };

  try {
    // 1. Storage Logic
    await initializeStorage();
    await setData("test_key", { foo: "bar" });
    const data = await getData("test_key");
    assert(data?.foo === "bar", "Storage reads/writes correctly");

    // 2. Offline Queueing
    console.log("\n📡 Testing Offline Queueing...");
    global.navigator.onLine = false; // Go offline

    // Create a task
    const taskId = "local_123";
    const taskData = { id: taskId, title: "Offline Task", completed: false };

    await syncEngine.queueOperation(
      syncEngine.OP_TYPES.CREATE,
      taskId,
      taskData,
    );

    const queue = await syncEngine.getQueue();
    assert(queue.length === 1, "Operation added to queue");
    assert(queue[0].type === "CREATE", "Operation type preserved");
    assert(queue[0].taskId === taskId, "Task ID preserved");

    // 3. Online Sync
    console.log("\n🔄 Testing Online Sync...");
    global.navigator.onLine = true; // Go online
    mockApi.configureApi({
      minLatency: 10,
      maxLatency: 50,
      failureRate: 0,
      enabled: true,
    }); // Fast, reliable API

    // Capture created tasks
    let serverId = null;
    const onCreated = (localId, result) => {
      serverId = result.id;
      console.log(`   Mapped ${localId} -> ${result.id}`);
    };

    const result = await syncEngine.processQueue({ onTaskCreated: onCreated });
    assert(result.processed === 1, "Queue processed successfully");
    assert(result.failed === 0, "No failures");
    assert(serverId !== null, "Server assigned ID");

    const emptyQueue = await syncEngine.getQueue();
    assert(emptyQueue.length === 0, "Queue cleared after sync");

    // 4. Conflict Resolution
    console.log("\n⚔️ Testing Conflict Resolution...");

    const now = Date.now();
    const serverTask = {
      id: "task_1",
      title: "Server Title",
      updatedAt: now + 1000, // Newer
    };
    const localTask = {
      id: "task_1",
      title: "Local Title",
      updatedAt: now, // Older
    };

    const resServerWins = syncEngine.resolveConflict(localTask, serverTask);
    assert(
      resServerWins.resolution === "server",
      "Server wins when newer (LWW)",
    );

    const resLocalWins = syncEngine.resolveConflict(
      { ...localTask, updatedAt: now + 2000 },
      serverTask,
    );
    assert(resLocalWins.resolution === "local", "Local wins when newer (LWW)");
  } catch (err) {
    console.error("💥 Verification crashed:", err);
    errors++;
  }

  console.log(
    `\n🏁 Verification Complete: ${errors === 0 ? "ALL PASSED" : `${errors} ERRORS`}`,
  );
  if (errors > 0) process.exit(1);
}

runVerification();
