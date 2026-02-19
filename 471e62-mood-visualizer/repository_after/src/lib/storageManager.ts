import { MoodShape } from './types';

const STORAGE_KEY = 'moodmorph_shapes';

export const storageManager = {
  save(mood: MoodShape): void {
    try {
      const existing = this.loadAll();
      existing.push(mood);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        throw new Error('Storage quota exceeded');
      }
      throw error;
    }
  },

  loadAll(): MoodShape[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      
      const parsed = JSON.parse(data);
      
      if (!Array.isArray(parsed)) {
        console.warn('Invalid storage data, clearing');
        this.clear();
        return [];
      }
      
      return parsed.filter(item => 
        item &&
        typeof item.id === 'string' &&
        typeof item.mood === 'string' &&
        typeof item.timestamp === 'number' &&
        item.properties &&
        typeof item.properties.type === 'string'
      );
    } catch (error) {
      console.warn('Failed to load storage, clearing:', error);
      this.clear();
      return [];
    }
  },

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  },

  delete(id: string): void {
    const moods = this.loadAll();
    const filtered = moods.filter(m => m.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  },
};
