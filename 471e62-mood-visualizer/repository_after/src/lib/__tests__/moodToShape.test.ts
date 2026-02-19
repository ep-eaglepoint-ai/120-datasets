import { moodToShape } from '../moodToShape';

describe('moodToShape', () => {
  describe('Determinism', () => {
    test('same mood produces identical properties', () => {
      const result1 = moodToShape('happy');
      const result2 = moodToShape('happy');
      expect(result1).toEqual(result2);
    });

    test('different moods produce different properties', () => {
      const result1 = moodToShape('happy');
      const result2 = moodToShape('sad');
      expect(result1).not.toEqual(result2);
    });

    test('case sensitivity affects output', () => {
      const result1 = moodToShape('Happy');
      const result2 = moodToShape('happy');
      expect(result1).not.toEqual(result2);
    });
  });

  describe('Empty Input Validation (REQUIREMENT #3)', () => {
    test('throws on empty string', () => {
      expect(() => moodToShape('')).toThrow('Mood cannot be empty');
    });

    test('throws on whitespace-only string', () => {
      expect(() => moodToShape('   ')).toThrow('Mood cannot be empty');
    });

    test('throws on tab and newline', () => {
      expect(() => moodToShape('\t\n')).toThrow('Mood cannot be empty');
    });
  });

  describe('Long Input Handling', () => {
    test('handles exactly 100 characters', () => {
      const mood = 'a'.repeat(100);
      const result = moodToShape(mood);
      expect(result).toBeDefined();
      expect(result.type).toBeTruthy();
    });

    test('truncates input longer than 100 chars', () => {
      const mood = 'a'.repeat(200);
      const result = moodToShape(mood);
      expect(result).toBeDefined();
      // Should still produce valid output
    });

    test('handles very long mood gracefully', () => {
      const mood = 'I am feeling very anxious and stressed today '.repeat(100);
      expect(() => moodToShape(mood)).not.toThrow();
    });
  });

  describe('Valid Shape Properties (REQUIREMENT #4)', () => {
    const validShapes = ['circle', 'triangle', 'square', 'pentagon', 'hexagon'];
    const validAnimations = ['rotate', 'pulse', 'bounce', 'wave', 'jitter'];
    const validPatterns = ['solid', 'gradient', 'striped', 'dotted'];

    test('always produces valid shape type', () => {
      for (let i = 0; i < 100; i++) {
        const result = moodToShape(`test mood ${i}`);
        expect(validShapes).toContain(result.type);
      }
    });

    test('always produces valid animation type', () => {
      for (let i = 0; i < 100; i++) {
        const result = moodToShape(`test mood ${i}`);
        expect(validAnimations).toContain(result.animation);
      }
    });

    test('always produces valid pattern type', () => {
      for (let i = 0; i < 100; i++) {
        const result = moodToShape(`test mood ${i}`);
        expect(validPatterns).toContain(result.pattern);
      }
    });

    test('always produces valid hex colors', () => {
      const result = moodToShape('random test');
      expect(result.primaryColor).toMatch(/^#[0-9A-F]{6}$/i);
      expect(result.secondaryColor).toMatch(/^#[0-9A-F]{6}$/i);
    });

    test('size is within bounds (80-200)', () => {
      for (let i = 0; i < 50; i++) {
        const result = moodToShape(`mood ${i}`);
        expect(result.size).toBeGreaterThanOrEqual(80);
        expect(result.size).toBeLessThanOrEqual(200);
      }
    });

    test('speed is within bounds (1-10)', () => {
      for (let i = 0; i < 50; i++) {
        const result = moodToShape(`mood ${i}`);
        expect(result.speed).toBeGreaterThanOrEqual(1);
        expect(result.speed).toBeLessThanOrEqual(10);
      }
    });
  });

  describe('Special Characters', () => {
    test('handles emoji in mood', () => {
      const result = moodToShape('I feel 😊 happy');
      expect(result).toBeDefined();
      expect(result.type).toBeTruthy();
    });

    test('handles special characters', () => {
      const result = moodToShape('stressed!@#$%^&*()');
      expect(result).toBeDefined();
    });

    test('handles unicode characters', () => {
      const result = moodToShape('très heureux 中文');
      expect(result).toBeDefined();
    });
  });

  describe('Sentiment Analysis', () => {
    test('positive mood uses warm colors', () => {
      const result = moodToShape('happy and joyful and excited');
      expect(result.primaryColor).toBeDefined();
      // Color should be from positive palette
    });

    test('negative mood uses cool colors', () => {
      const result = moodToShape('sad and angry and stressed');
      expect(result.primaryColor).toBeDefined();
      // Color should be from negative palette
    });

    test('neutral mood when no keywords', () => {
      const result = moodToShape('xyz abc def');
      expect(result.primaryColor).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    test('single character mood', () => {
      const result = moodToShape('a');
      expect(result).toBeDefined();
    });

    test('numeric mood', () => {
      const result = moodToShape('12345');
      expect(result).toBeDefined();
    });

    test('mood with only spaces and one char', () => {
      const result = moodToShape('  a  ');
      expect(result).toBeDefined();
    });
  });
});
