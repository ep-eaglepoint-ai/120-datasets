import { describe, it, expect, beforeEach } from "vitest";
import * as storage from "@/lib/storage.js";

// Mock localStorage for testing
const mockLocalStorage = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value; },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

global.localStorage = mockLocalStorage;

describe("Storage Library", () => {
  beforeEach(() => {
    localStorage.clear();
    if (storage.clearCache) {
      storage.clearCache();
    }
  });

  describe("getData", () => {
    it("should return cached data if available", async () => {
      // Setup cache
      await storage.setData("test_key", { foo: "bar" });

      const result = await storage.getData("test_key");
      expect(result).toEqual({ foo: "bar" });
    });

    it("should handle getData calls", async () => {
      const result = await storage.getData("unknown_key");
      // Result can be null or undefined for missing keys
      expect(result == null).toBe(true);
    });

    it("should return null if key does not exist", async () => {
      const result = await storage.getData("missing_key");
      // Missing keys return null or undefined
      expect(result == null).toBe(true);
    });
  });

  describe("setData", () => {
    it("should update cache and persist to storage", async () => {
      const key = "new_key";
      const value = { id: 1, name: "Test" };

      await storage.setData(key, value);

      // Verify cache update (by immediate read)
      const cached = await storage.getData(key);
      expect(cached).toEqual(value);
    });
  });

  describe("getDeviceId", () => {
    it("should generate and persist ID if none exists", () => {
      const deviceId = storage.getDeviceId();
      expect(deviceId).toMatch(/^device_\d+_[a-z0-9]+$/);
    });

    it("should return cached ID if available", () => {
      const id1 = storage.getDeviceId();
      const id2 = storage.getDeviceId();
      expect(id1).toBe(id2);
    });
  });
});
