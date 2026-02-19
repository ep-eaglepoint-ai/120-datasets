/**
 * Mock API service simulating a backend with configurable latency and failure rate.
 * Used to test sync behavior, error handling, and conflict resolution.
 */

// Configurable settings for testing different scenarios
const CONFIG = {
  minLatency: 100, // Minimum response time in ms
  maxLatency: 500, // Maximum response time in ms
  failureRate: 0.1, // 10% chance of failure
  enabled: true, // Set false to simulate server down
};

// In-memory "server" state + Persistence
let serverTasks = new Map();
let serverVersion = 0;
const SERVER_STORAGE_KEY = "mock_server_data";

let initializedPromise = null;

/**
 * Initialize mock server by loading from storage
 */
async function initServer() {
  try {
    const raw = await window.storage?.getItem(SERVER_STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      serverTasks = new Map(data.tasks.map((t) => [t.id, t]));
      serverVersion = data.version || 0;
      console.log(
        "[MockAPI] Server state restored:",
        serverTasks.size,
        "tasks",
      );
    }
  } catch (e) {
    console.error("[MockAPI] Failed to restore server state:", e);
  }
}

/**
 * Ensure server is initialized before any operation
 */
async function ensureInitialized() {
  if (!initializedPromise) {
    initializedPromise = initServer();
  }
  return initializedPromise;
}

/**
 * Persist server state to simulated remote storage
 */
async function persistServer() {
  try {
    const data = {
      tasks: Array.from(serverTasks.values()),
      version: serverVersion,
    };
    await window.storage?.setItem(SERVER_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("[MockAPI] Failed to persist server state:", e);
  }
}

/**
 * Simulate network latency
 */
function simulateLatency() {
  const latency =
    CONFIG.minLatency + Math.random() * (CONFIG.maxLatency - CONFIG.minLatency);
  return new Promise((resolve) => setTimeout(resolve, latency));
}

/**
 * Simulate random failures
 */
function maybeFailRandomly() {
  if (!CONFIG.enabled) {
    throw new Error("Server unavailable");
  }
  if (Math.random() < CONFIG.failureRate) {
    throw new Error("Random server error");
  }
}

/**
 * Generate a unique server task ID
 */
function generateServerId() {
  return `server_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export async function getTasks() {
  await ensureInitialized();
  await simulateLatency();
  maybeFailRandomly();

  const tasks = Array.from(serverTasks.values());
  console.log("[MockAPI] GET /tasks - returned", tasks.length, "tasks");
  return tasks;
}

export async function createTask(data) {
  await ensureInitialized();
  await simulateLatency();
  maybeFailRandomly();

  const now = Date.now();
  const serverId = generateServerId();

  const task = {
    ...data,
    id: serverId,
    createdAt: data.createdAt || now,
    updatedAt: now,
    version: ++serverVersion,
  };

  serverTasks.set(serverId, task);
  await persistServer();
  console.log("[MockAPI] POST /tasks - created:", task.title);
  return task;
}

export async function updateTask(id, data) {
  await ensureInitialized();
  await simulateLatency();
  maybeFailRandomly();

  const existing = serverTasks.get(id);
  if (!existing) {
    throw new Error(`Task not found: ${id}`);
  }

  const now = Date.now();
  const updated = {
    ...existing,
    ...data,
    id, // Ensure ID isn't overwritten
    updatedAt: now,
    version: ++serverVersion,
  };

  serverTasks.set(id, updated);
  await persistServer();
  console.log("[MockAPI] PUT /tasks/" + id + " - updated:", updated.title);
  return updated;
}

export async function deleteTask(id) {
  await ensureInitialized();
  await simulateLatency();
  maybeFailRandomly();

  const existed = serverTasks.has(id);
  serverTasks.delete(id);
  await persistServer();

  console.log(
    "[MockAPI] DELETE /tasks/" + id + " -",
    existed ? "deleted" : "not found",
  );
  return { success: true, id };
}

export async function getTask(id) {
  await ensureInitialized();
  await simulateLatency();
  maybeFailRandomly();

  return serverTasks.get(id) || null;
}

// ============== Testing Utilities ==============

export async function resetServer() {
  serverTasks.clear();
  serverVersion = 0;
  await persistServer();
  console.log("[MockAPI] Server reset");
}

export function seedServer(tasks) {
  resetServer();
  tasks.forEach((task) => {
    serverTasks.set(task.id, { ...task, version: ++serverVersion });
  });
  console.log("[MockAPI] Seeded with", tasks.length, "tasks");
}

export function configureApi(options) {
  Object.assign(CONFIG, options);
  console.log("[MockAPI] Configuration updated:", CONFIG);
}

export function getServerSnapshot() {
  return {
    tasks: Array.from(serverTasks.values()),
    version: serverVersion,
    config: { ...CONFIG },
  };
}

export function simulateServerUpdate(id, updates) {
  const existing = serverTasks.get(id);
  if (existing) {
    serverTasks.set(id, {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
      version: ++serverVersion,
    });
    console.log("[MockAPI] Simulated server update for task:", id);
  }
}
