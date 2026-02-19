import { storageManager } from '../storageManager';
import { MoodShape } from '../types';

describe('storageManager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('save', () => {
    test('saves mood to localStorage', () => {
      const mood: MoodShape = {
        id: 'test-id',
        mood: 'happy',
        timestamp: Date.now(),
        properties: {
          type: 'circle',
          primaryColor: '#FF0000',
          secondaryColor: '#00FF00',
          size: 100,
          animation: 'rotate',
          speed: 5,
          pattern: 'solid',
        },
      };

      storageManager.save(mood);
      const saved = storageManager.loadAll();
      
      expect(saved).toHaveLength(1);
      expect(saved[0]).toEqual(mood);
    });

    test('saves multiple moods', () => {
      const mood1: MoodShape = {
        id: '1',
        mood: 'happy',
        timestamp: Date.now(),
        properties: {
          type: 'circle',
          primaryColor: '#FF0000',
          secondaryColor: '#00FF00',
          size: 100,
          animation: 'rotate',
          speed: 5,
          pattern: 'solid',
        },
      };

      const mood2: MoodShape = { ...mood1, id: '2', mood: 'sad' };

      storageManager.save(mood1);
      storageManager.save(mood2);

      const saved = storageManager.loadAll();
      expect(saved).toHaveLength(2);
    });
  });

  describe('loadAll', () => {
    test('returns empty array when no data', () => {
      const moods = storageManager.loadAll();
      expect(moods).toEqual([]);
    });

    test('loads saved moods', () => {
      const mood: MoodShape = {
        id: 'test',
        mood: 'excited',
        timestamp: Date.now(),
        properties: {
          type: 'triangle',
          primaryColor: '#FF0000',
          secondaryColor: '#00FF00',
          size: 150,
          animation: 'pulse',
          speed: 7,
          pattern: 'gradient',
        },
      };

      storageManager.save(mood);
      const loaded = storageManager.loadAll();
      
      expect(loaded[0]).toEqual(mood);
    });

    test('handles corrupted data gracefully', () => {
      localStorage.setItem('moodmorph_shapes', 'invalid json');
      
      const moods = storageManager.loadAll();
      expect(moods).toEqual([]);
    });

    test('handles non-array data', () => {
      localStorage.setItem('moodmorph_shapes', '{"invalid": "data"}');
      
      const moods = storageManager.loadAll();
      expect(moods).toEqual([]);
    });

    test('filters out invalid entries', () => {
      const valid: MoodShape = {
        id: 'valid',
        mood: 'happy',
        timestamp: Date.now(),
        properties: {
          type: 'circle',
          primaryColor: '#FF0000',
          secondaryColor: '#00FF00',
          size: 100,
          animation: 'rotate',
          speed: 5,
          pattern: 'solid',
        },
      };

      const invalid = { incomplete: 'data' };

      localStorage.setItem('moodmorph_shapes', JSON.stringify([valid, invalid]));

      const moods = storageManager.loadAll();
      expect(moods).toHaveLength(1);
      expect(moods[0]).toEqual(valid);
    });
  });

  describe('clear', () => {
    test('clears all moods', () => {
      const mood: MoodShape = {
        id: 'test',
        mood: 'neutral',
        timestamp: Date.now(),
        properties: {
          type: 'square',
          primaryColor: '#FF0000',
          secondaryColor: '#00FF00',
          size: 120,
          animation: 'bounce',
          speed: 3,
          pattern: 'striped',
        },
      };

      storageManager.save(mood);
      expect(storageManager.loadAll()).toHaveLength(1);
      
      storageManager.clear();
      expect(storageManager.loadAll()).toHaveLength(0);
    });
  });

  describe('delete', () => {
    test('deletes specific mood by ID', () => {
      const mood1: MoodShape = {
        id: '1',
        mood: 'happy',
        timestamp: Date.now(),
        properties: {
          type: 'circle',
          primaryColor: '#FF0000',
          secondaryColor: '#00FF00',
          size: 100,
          animation: 'rotate',
          speed: 5,
          pattern: 'solid',
        },
      };

      const mood2: MoodShape = { ...mood1, id: '2', mood: 'sad' };

      storageManager.save(mood1);
      storageManager.save(mood2);
      
      storageManager.delete('1');
      
      const remaining = storageManager.loadAll();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('2');
    });
  });
});
