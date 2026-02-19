/**
 * Storage Polyfill - Implements window.storage API
 *
 * This provides the async storage API used by the offline-first architecture.
 * Uses localStorage internally with async wrapper for consistent API.
 */

// Create the storage API if it doesn't exist
if (typeof window !== "undefined" && !window.storage) {
  const storagePrefix = "taskmanager_";

  window.storage = {
    /**
     * Get item from storage
     * @param {string} key
     * @returns {Promise<string|null>}
     */
    async getItem(key) {
      try {
        const value = localStorage.getItem(storagePrefix + key);
        return value;
      } catch (error) {
        console.error("[StoragePolyfill] getItem error:", error);
        return null;
      }
    },

    async setItem(key, value) {
      try {
        localStorage.setItem(storagePrefix + key, value);
      } catch (error) {
        console.error("[StoragePolyfill] setItem error:", error);
        throw error;
      }
    },

    async removeItem(key) {
      try {
        localStorage.removeItem(storagePrefix + key);
      } catch (error) {
        console.error("[StoragePolyfill] removeItem error:", error);
        throw error;
      }
    },

    async clear() {
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(storagePrefix)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
      } catch (error) {
        console.error("[StoragePolyfill] clear error:", error);
        throw error;
      }
    },

    async keys() {
      try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(storagePrefix)) {
            keys.push(key.replace(storagePrefix, ""));
          }
        }
        return keys;
      } catch (error) {
        console.error("[StoragePolyfill] keys error:", error);
        return [];
      }
    },
  };
}

export default window.storage;
