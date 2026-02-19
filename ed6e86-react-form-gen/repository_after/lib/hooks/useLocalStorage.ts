import { useState } from 'react';
import type { FormData } from '../types';

export function useLocalStorage(key: string, initialValue: FormData | null): [FormData | null, (value: FormData | null) => void] {
  const [storedValue, setStoredValue] = useState<FormData | null>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      if (!item) {
        return initialValue;
      }
      return JSON.parse(item) as FormData;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return initialValue;
    }
  });

  const setValue = (value: FormData | null): void => {
    try {
      setStoredValue(value);
      if (typeof window !== 'undefined') {
        if (value === null) {
          window.localStorage.removeItem(key);
        } else {
          window.localStorage.setItem(key, JSON.stringify(value));
        }
      }
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  };

  return [storedValue, setValue];
}
