export const STORAGE_KEYS = {
  polls: "voting_app:polls_store:v1",
  theme: "voting_app:theme:v1",
};

export function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function readLocalStorageJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  return safeJsonParse<T>(window.localStorage.getItem(key));
}

export function writeLocalStorageJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function readSessionStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSessionStorage(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // ignore
  }
}
