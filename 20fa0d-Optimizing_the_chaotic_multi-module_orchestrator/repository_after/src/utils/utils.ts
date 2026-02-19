import { CacheManager } from '../types/types';

export const range = <T>(count: number, mapFn: (index: number) => T): T[] => {
  return Array.from({ length: count }, (_, i) => mapFn(i));
};

export const stringHash = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
};

export const reverseMap = <T, R>(arr: T[], fn: (item: T, index: number) => R): R[] => {
  const result: R[] = [];
  for (let i = arr.length - 1; i >= 0; i--) {
    result.unshift(fn(arr[i], i));
  }
  return result;
};

export const createCache = <T = any>(): CacheManager<T> => {
  const cache = new Map<string, T>();
  return {
    get: (key: string) => cache.get(key),
    set: (key: string, value: T) => cache.set(key, value),
    clear: () => cache.clear(),
    has: (key: string) => cache.has(key),
  };
};

export const setNestedValue = <T extends Record<string, any>>(obj: T, path: string[], value: any): T => {
  if (path.length === 0) return value as T;
  const [head, ...tail] = path;
  const current = obj[head];
  return {
    ...obj,
    [head]: tail.length === 0 ? value : setNestedValue((current && typeof current === 'object' ? current : {}), tail, value),
  } as T;
};

export const deleteNestedValue = <T extends Record<string, any>>(obj: T, path: string[]): T => {
  if (path.length === 0) return obj;
  if (path.length === 1) {
    const { [path[0]]: _, ...rest } = obj;
    return rest as T;
  }
  const [head, ...tail] = path;
  const current = obj[head];
  if (!current || typeof current !== 'object') return obj;
  return {
    ...obj,
    [head]: deleteNestedValue(current, tail),
  } as T;
};

export const deepMerge = <T extends Record<string, any>>(target: T, source: Partial<T>): T => {
  const result = { ...target } as any;
  for (const key in source) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const sVal = (source as any)[key];
    const tVal = (result as any)[key];
    if (sVal && typeof sVal === 'object' && !Array.isArray(sVal) && tVal && typeof tVal === 'object' && !Array.isArray(tVal)) {
      result[key] = deepMerge(tVal, sVal as any);
    } else {
      result[key] = sVal as any;
    }
  }
  return result;
};

export const getNestedValue = (obj: Record<string, any>, path: string | string[]) => {
  const pathArray = typeof path === 'string' ? path.split('.') : path;
  return pathArray.reduce((cur, key) => cur?.[key], obj);
};

export const cloneWithoutPrivateKeys = <T extends Record<string, any>>(obj: T): Partial<T> => {
  const result: Partial<T> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && !key.startsWith('_')) {
      result[key] = obj[key];
    }
  }
  return result;
};

export const debounce = <T extends (...args: any[]) => any>(fn: T, delay: number) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};
