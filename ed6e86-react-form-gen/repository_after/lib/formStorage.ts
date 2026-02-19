import type { FormData } from './types';

const STORAGE_KEY = 'formData';

export function saveFormData(formData: FormData): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
  } catch (error) {
    if (error instanceof Error) {
      console.error('Failed to save form data:', error.message);
    } else {
      console.error('Failed to save form data: Unknown error');
    }
  }
}

export function loadFormData(): FormData | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const item = window.localStorage.getItem(STORAGE_KEY);
    if (!item) {
      return null;
    }

    const parsed = JSON.parse(item) as unknown;
    
    if (!isValidFormData(parsed)) {
      console.error('Invalid form data in localStorage');
      return null;
    }

    return parsed;
  } catch (error) {
    if (error instanceof Error) {
      console.error('Failed to load form data:', error.message);
    } else {
      console.error('Failed to load form data: Unknown error');
    }
    return null;
  }
}

// Type guard to validate form data structure from localStorage
function isValidFormData(data: unknown): data is FormData {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.title !== 'string' || typeof obj.description !== 'string') {
    return false;
  }

  if (!Array.isArray(obj.fields)) {
    return false;
  }

  for (const field of obj.fields) {
    if (typeof field !== 'object' || field === null) {
      return false;
    }

    const fieldObj = field as Record<string, unknown>;

    if (fieldObj.type === 'text') {
      if (
        typeof fieldObj.id !== 'string' ||
        typeof fieldObj.inputType !== 'string' ||
        !['text', 'email', 'tel', 'url'].includes(fieldObj.inputType) ||
        typeof fieldObj.label !== 'string' ||
        typeof fieldObj.placeholder !== 'string' ||
        typeof fieldObj.required !== 'boolean'
      ) {
        return false;
      }
    } else if (fieldObj.type === 'choice') {
      if (
        typeof fieldObj.id !== 'string' ||
        typeof fieldObj.choiceType !== 'string' ||
        !['radio', 'checkbox'].includes(fieldObj.choiceType) ||
        typeof fieldObj.legend !== 'string' ||
        !Array.isArray(fieldObj.options)
      ) {
        return false;
      }

      for (const option of fieldObj.options) {
        if (
          typeof option !== 'object' ||
          option === null ||
          typeof (option as Record<string, unknown>).id !== 'string' ||
          typeof (option as Record<string, unknown>).label !== 'string' ||
          typeof (option as Record<string, unknown>).value !== 'string'
        ) {
          return false;
        }
      }
    } else {
      return false;
    }
  }

  return true;
}
