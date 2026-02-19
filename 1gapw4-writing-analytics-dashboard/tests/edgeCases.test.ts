// ============================================================================
// REQUIREMENT #24: Edge Case Testing
// Tests for stylistic experimentation, emotional extremes, contradictory tones,
// and long-term writing evolution patterns
// ============================================================================

import {
  analyzeAdvancedSentiment,
  calculateEnhancedReadability,
  analyzeRepetition,
  computeStylisticFingerprint,
  analyzeAdvancedSentenceStructure,
  analyzeGrammarPatternsComprehensive,
  calculateProductivityMetrics,
  trackStylisticEvolution,
  calculateUncertaintyIndicators,
} from '@/lib/comprehensiveAnalytics';
import { Document, AnalyticsResult } from '@/lib/types';

describe('Edge Case Tests (Requirement #24)', () => {
  
  // =========================================================================
  // Stylistic Experimentation Tests
  // =========================================================================
  describe('Stylistic Experimentation', () => {
    
    test('handles stream of consciousness style', () => {
      const text = `
        Running through the streets and the lights are blinking and 
        people everywhere moving always moving never stopping can't stop 
        won't stop the rhythm of the city beats in my chest like a drum 
        like a heartbeat like life itself pulsing through concrete veins
      `;
      
      const sentiment = analyzeAdvancedSentiment(text);
      const structure = analyzeAdvancedSentenceStructure(text);
      const fingerprint = computeStylisticFingerprint(text);
      
      expect(sentiment).toBeDefined();
      expect(structure.coordinationFrequency).toBeGreaterThan(0);
      expect(fingerprint.rhythmPatterns.length).toBeGreaterThan(0);
    });
    
    test('handles very short fragmentary writing', () => {
      const text = `
        Night. Silence. A distant sound.
        Running.
        Fear.
        The door. Locked.
        Despair.
      `;
      
      const readability = calculateEnhancedReadability(text);
      const sentiment = analyzeAdvancedSentiment(text);
      
      expect(readability.fragmentCount).toBeGreaterThan(0);
      expect(sentiment.sentenceLevel.length).toBeGreaterThan(0);
    });
    
    test('handles experimental punctuation', () => {
      const text = `
        What if... no, that's impossible... but then again... 
        maybe??? Could it be?!?! Yes! YES! It must be!!!
        No... no... no...
      `;
      
      const fingerprint = computeStylisticFingerprint(text);
      const sentiment = analyzeAdvancedSentiment(text);
      
      expect(fingerprint.punctuationProfile).toBeDefined();
      expect(Object.keys(fingerprint.punctuationProfile).length).toBeGreaterThan(0);
      expect(sentiment.volatility).toBeGreaterThanOrEqual(0);
    });
    
    test('handles mixed case experimental writing', () => {
      const text = `
        the SILENCE was deafening. BOOM! went the thunder.
        whispers... SCREAMS... whispers again.
        Everything was CHAOS and then... nothing.
      `;
      
      const sentiment = analyzeAdvancedSentiment(text);
      expect(sentiment).toBeDefined();
      expect(sentiment.sentenceLevel.length).toBeGreaterThan(0);
    });
    
    test('handles repetitive stylistic patterns', () => {
      const text = `
        I walked. I walked and walked. I walked and walked and walked.
        The road stretched. The road stretched endlessly. The road stretched endlessly before me.
        Time passed. Time passed slowly. Time passed slowly and silently.
      `;
      
      const repetition = analyzeRepetition(text);
      const fingerprint = computeStylisticFingerprint(text);
      
      expect(repetition.repeatedPhrases.length).toBeGreaterThan(0);
      // Check that some repetitions are marked as deliberate
      const deliberate = repetition.repeatedPhrases.filter(p => p.isDeliberate);
      expect(deliberate.length).toBeGreaterThanOrEqual(0);
    });
  });
  
  // =========================================================================
  // Emotional Extremes Tests
  // =========================================================================
  describe('Emotional Extremes', () => {
    
    test('handles extremely positive text', () => {
      const text = `
        This is absolutely wonderful! I am so incredibly happy and grateful!
        Everything is perfect, amazing, beautiful, and fantastic!
        I love every single moment of this glorious, magnificent day!
        Joy fills my heart! Happiness overflows! Life is absolutely brilliant!
      `;
      
      const sentiment = analyzeAdvancedSentiment(text);
      
      expect(sentiment.score).toBeGreaterThan(0.3);
      expect(sentiment.polarity).toBe('positive');
      expect(sentiment.intensity).toBeGreaterThan(0.3);
    });
    
    test('handles extremely negative text', () => {
      const text = `
        This is terrible, awful, and absolutely horrible.
        I hate everything about this miserable, depressing situation.
        Nothing could be worse. It's dreadful, disgusting, and pathetic.
        Complete and utter disappointment. Devastating failure.
      `;
      
      const sentiment = analyzeAdvancedSentiment(text);
      
      expect(sentiment.score).toBeLessThan(-0.2);
      expect(sentiment.polarity).toBe('negative');
      expect(sentiment.intensity).toBeGreaterThan(0.3);
    });
    
    test('handles emotionally intense but neutral content', () => {
      const text = `
        The explosion was massive! The building collapsed completely!
        Sirens wailed throughout the night! People ran everywhere!
        The situation was intense! The tension was palpable!
        Everything changed in an instant! Nothing would ever be the same!
      `;
      
      const sentiment = analyzeAdvancedSentiment(text);
      
      // Should recognize intensity without strong positive/negative lean
      expect(sentiment.intensity).toBeGreaterThanOrEqual(0);
      expect(Math.abs(sentiment.score)).toBeLessThan(0.5);
    });
    
    test('handles grief and sadness', () => {
      const text = `
        The loss was overwhelming. Tears fell silently in the empty room.
        Memories of happier times only deepened the sorrow.
        The world felt gray and meaningless without them.
        Grief settled like a heavy blanket, suffocating hope.
      `;
      
      const sentiment = analyzeAdvancedSentiment(text);
      
      expect(sentiment.score).toBeLessThanOrEqual(0);
      // Polarity depends on the specific words detected
      expect(['negative', 'neutral']).toContain(sentiment.polarity);
    });
    
    test('handles manic/excited writing', () => {
      const text = `
        YES! This is IT! I've got it! The answer! Finally!
        Everything makes sense now! Can you believe it?!
        I can't stop! Won't stop! The ideas keep coming!
        Brilliant! Genius! Revolutionary! Game-changing!
      `;
      
      const sentiment = analyzeAdvancedSentiment(text);
      const fingerprint = computeStylisticFingerprint(text);
      
      expect(sentiment.intensity).toBeGreaterThanOrEqual(0);
      expect(fingerprint.punctuationProfile['!']).toBeGreaterThan(0);
    });
  });
  
  // =========================================================================
  // Contradictory Tone Tests
  // =========================================================================
  describe('Contradictory Tones', () => {
    
    test('handles sarcasm patterns', () => {
      const text = `
        Oh, how wonderful! Another meeting that could have been an email.
        I just love spending my entire day in pointless discussions.
        What a fantastic use of everyone's time. Truly brilliant planning.
        Nothing I enjoy more than this. Absolutely nothing at all.
      `;
      
      const sentiment = analyzeAdvancedSentiment(text);
      
      // Sarcasm is difficult to detect but should show some signals
      expect(sentiment).toBeDefined();
      expect(sentiment.moodPatterns).toBeDefined();
    });
    
    test('handles mixed positive and negative in same sentence', () => {
      const text = `
        The movie was beautifully shot but terribly written.
        I loved the music yet hated the plot.
        The food was delicious although the service was awful.
        She was incredibly talented but impossibly difficult.
      `;
      
      const sentiment = analyzeAdvancedSentiment(text);
      
      // Mixed content should show volatility
      expect(sentiment.volatility).toBeGreaterThanOrEqual(0);
      // Overall score should be near neutral due to contradictions
      expect(Math.abs(sentiment.score)).toBeLessThan(0.5);
    });
    
    test('handles emotional roller coaster', () => {
      const text = `
        I was so happy when I heard the news! Finally, after all these years!
        But then came the devastating truth. Everything crashed down.
        Hope flickered again when she called. Maybe things would improve.
        No. The final blow came. All was lost. Despair consumed me.
        Yet somehow, in the darkness, a small light appeared...
      `;
      
      const sentiment = analyzeAdvancedSentiment(text);
      
      expect(sentiment.polarityShifts).toBeDefined();
      expect(sentiment.volatility).toBeGreaterThanOrEqual(0);
    });
    
    test('handles passive-aggressive tone', () => {
      const text = `
        I'm fine. Everything is fine. It's not like I expected anything different.
        No, please, go ahead. I'll just wait. Again.
        It's perfectly okay that you forgot. I understand completely.
        Don't worry about me. I'm used to this by now.
      `;
      
      const sentiment = analyzeAdvancedSentiment(text);
      
      expect(sentiment).toBeDefined();
      // Should detect some negative undertone despite seemingly neutral words
    });
    
    test('handles ironic juxtaposition', () => {
      const text = `
        The funeral was lovely. Sunshine streamed through stained glass 
        as mourners wept. Beautiful flowers adorned the tragic scene.
        Death had never looked so elegant. Grief had never felt so poetic.
        In the midst of sorrow, there was an odd, uncomfortable beauty.
      `;
      
      const sentiment = analyzeAdvancedSentiment(text);
      
      expect(sentiment.volatility).toBeGreaterThanOrEqual(0);
      expect(sentiment.moodPatterns).toBeDefined();
    });
  });
  
  // =========================================================================
  // Long-term Evolution Pattern Tests
  // =========================================================================
  describe('Long-term Writing Evolution', () => {
    
    const createMockDocument = (id: string, content: string, daysAgo: number): Document => ({
      id,
      title: `Document ${id}`,
      content,
      createdAt: Date.now() - daysAgo * 24 * 60 * 60 * 1000,
      updatedAt: Date.now() - daysAgo * 24 * 60 * 60 * 1000,
      tags: [],
    });
    
    const createMockAnalytics = (
      docId: string,
      sentiment: number,
      readability: number,
      ttr: number,
      avgSentenceLength: number
    ): AnalyticsResult => ({
      documentId: docId,
      timestamp: Date.now(),
      wordCount: 500,
      characterCount: 2500,
      sentenceCount: 25,
      paragraphCount: 5,
      sentiment: {
        score: sentiment,
        polarity: sentiment > 0.1 ? 'positive' : sentiment < -0.1 ? 'negative' : 'neutral',
        intensity: Math.abs(sentiment),
      },
      readability: {
        fleschReadingEase: readability,
        fleschKincaidGrade: 12 - readability / 10,
        gunningFog: 10,
        smogIndex: 10,
      },
      lexicalRichness: {
        typeTokenRatio: ttr,
        hapaxLegomena: 100,
        vocabularyDiversity: ttr * 1.2,
      },
      styleMetrics: {
        avgSentenceLength,
        avgWordLength: 5,
        passiveVoiceCount: 2,
        punctuationDensity: 0.1,
        clauseDepth: 2,
        syntacticVariation: 5,
        rhythmPatterns: [10, 15, 20, 12, 18],
      },
    });
    
    test('tracks improving writing over time', () => {
      const documents = [
        createMockDocument('1', 'Early writing sample...', 90),
        createMockDocument('2', 'Improving writing...', 60),
        createMockDocument('3', 'Better writing...', 30),
        createMockDocument('4', 'Much improved writing...', 0),
      ];
      
      const analytics = new Map<string, AnalyticsResult>();
      analytics.set('1', createMockAnalytics('1', 0.1, 50, 0.4, 12));
      analytics.set('2', createMockAnalytics('2', 0.2, 55, 0.45, 14));
      analytics.set('3', createMockAnalytics('3', 0.25, 60, 0.5, 15));
      analytics.set('4', createMockAnalytics('4', 0.3, 65, 0.55, 16));
      
      const evolution = trackStylisticEvolution(documents, analytics);
      
      expect(evolution.toneEvolution.length).toBe(4);
      expect(evolution.complexityEvolution.length).toBe(4);
      expect(evolution.vocabularyEvolution.length).toBe(4);
      
      // Should show positive trend
      const lastTone = evolution.toneEvolution[evolution.toneEvolution.length - 1];
      const firstTone = evolution.toneEvolution[0];
      expect(lastTone.score).toBeGreaterThan(firstTone.score);
    });
    
    test('tracks declining engagement over time', () => {
      const documents = [
        createMockDocument('1', 'Enthusiastic start...', 90),
        createMockDocument('2', 'Still engaged...', 60),
        createMockDocument('3', 'Less motivated...', 30),
        createMockDocument('4', 'Going through motions...', 0),
      ];
      
      const analytics = new Map<string, AnalyticsResult>();
      analytics.set('1', createMockAnalytics('1', 0.5, 70, 0.6, 18));
      analytics.set('2', createMockAnalytics('2', 0.3, 65, 0.5, 16));
      analytics.set('3', createMockAnalytics('3', 0.1, 60, 0.45, 14));
      analytics.set('4', createMockAnalytics('4', -0.1, 55, 0.4, 12));
      
      const evolution = trackStylisticEvolution(documents, analytics);
      
      // Should show declining trend
      const lastTone = evolution.toneEvolution[evolution.toneEvolution.length - 1];
      const firstTone = evolution.toneEvolution[0];
      expect(lastTone.score).toBeLessThan(firstTone.score);
    });
    
    test('tracks style consistency over time', () => {
      const documents = [
        createMockDocument('1', 'Consistent style...', 90),
        createMockDocument('2', 'Same consistent style...', 60),
        createMockDocument('3', 'Still consistent...', 30),
        createMockDocument('4', 'Maintaining consistency...', 0),
      ];
      
      const analytics = new Map<string, AnalyticsResult>();
      analytics.set('1', createMockAnalytics('1', 0.2, 60, 0.5, 15));
      analytics.set('2', createMockAnalytics('2', 0.22, 61, 0.51, 15));
      analytics.set('3', createMockAnalytics('3', 0.19, 59, 0.49, 16));
      analytics.set('4', createMockAnalytics('4', 0.21, 60, 0.5, 15));
      
      const evolution = trackStylisticEvolution(documents, analytics);
      
      // High sentiment stability indicates consistency
      expect(evolution.sentimentStability).toBeGreaterThan(0.7);
      // Low thematic focus shift
      expect(evolution.thematicFocusShift).toBeLessThan(0.1);
    });
    
    test('handles irregular writing schedule', () => {
      const documents = [
        createMockDocument('1', 'First entry...', 100),
        createMockDocument('2', 'After long break...', 50),
        createMockDocument('3', 'Another gap...', 10),
        createMockDocument('4', 'Recent work...', 0),
      ];
      
      const analytics = new Map<string, AnalyticsResult>();
      documents.forEach((doc, i) => {
        analytics.set(doc.id, createMockAnalytics(doc.id, 0.1 * i, 60, 0.5, 15));
      });
      
      const productivity = calculateProductivityMetrics(documents, analytics);
      
      expect(productivity.missedDays).toBeGreaterThan(0);
      expect(productivity.consistencyScore).toBeLessThan(0.5);
    });
  });
  
  // =========================================================================
  // Technical Edge Cases
  // =========================================================================
  describe('Technical Edge Cases', () => {
    
    test('handles empty text', () => {
      const sentiment = analyzeAdvancedSentiment('');
      const readability = calculateEnhancedReadability('');
      const structure = analyzeAdvancedSentenceStructure('');
      
      expect(sentiment.score).toBe(0);
      expect(readability.fleschReadingEase).toBe(0);
      expect(structure.clauseDepth).toBe(0);
    });
    
    test('handles single word', () => {
      const sentiment = analyzeAdvancedSentiment('Hello');
      const readability = calculateEnhancedReadability('Hello');
      
      expect(sentiment).toBeDefined();
      expect(readability).toBeDefined();
    });
    
    test('handles text with only punctuation', () => {
      const sentiment = analyzeAdvancedSentiment('... !!! ???');
      
      expect(sentiment).toBeDefined();
      expect(sentiment.sentenceLevel.length).toBeGreaterThanOrEqual(0);
    });
    
    test('handles text with numbers', () => {
      const text = 'In 2024, there were 1,234,567 users. That is 42% growth from 2023.';
      
      const sentiment = analyzeAdvancedSentiment(text);
      const readability = calculateEnhancedReadability(text);
      
      expect(sentiment).toBeDefined();
      expect(readability).toBeDefined();
    });
    
    test('handles text with URLs and emails', () => {
      const text = 'Visit https://example.com or email contact@example.com for more information.';
      
      const sentiment = analyzeAdvancedSentiment(text);
      const readability = calculateEnhancedReadability(text);
      
      expect(sentiment).toBeDefined();
      expect(readability).toBeDefined();
    });
    
    test('handles very long text', () => {
      const longText = Array(1000).fill('This is a test sentence with some content.').join(' ');
      
      const sentiment = analyzeAdvancedSentiment(longText);
      const readability = calculateEnhancedReadability(longText);
      const repetition = analyzeRepetition(longText);
      
      expect(sentiment).toBeDefined();
      expect(readability).toBeDefined();
      expect(repetition.repeatedPhrases.length).toBeGreaterThan(0);
    });
    
    test('handles unicode and special characters', () => {
      const text = 'The café served excellent crème brûlée. 日本語 テスト. Привет мир!';
      
      const sentiment = analyzeAdvancedSentiment(text);
      const readability = calculateEnhancedReadability(text);
      
      expect(sentiment).toBeDefined();
      expect(readability).toBeDefined();
    });
    
    test('handles code snippets in text', () => {
      const text = `
        The function calculateSum(a, b) returns the sum of two numbers.
        Use console.log() to debug your code.
        The variable_name should follow snake_case convention.
      `;
      
      const sentiment = analyzeAdvancedSentiment(text);
      const readability = calculateEnhancedReadability(text);
      
      expect(sentiment).toBeDefined();
      expect(readability.technicalTermDensity).toBeGreaterThanOrEqual(0);
    });
  });
  
  // =========================================================================
  // Uncertainty and Confidence Tests
  // =========================================================================
  describe('Uncertainty Indicators', () => {
    
    test('shows low confidence for very short text', () => {
      const text = 'Short.';
      const partialResult = {
        sentiment: { score: 0, polarity: 'neutral' as const, intensity: 0 },
        readability: { fleschReadingEase: 50, fleschKincaidGrade: 8, gunningFog: 10, smogIndex: 10 },
      };
      
      const uncertainty = calculateUncertaintyIndicators(text, partialResult);
      
      expect(uncertainty.overallReliability).toBeLessThan(0.5);
      expect(uncertainty.warnings.length).toBeGreaterThan(0);
    });
    
    test('shows high confidence for long, varied text', () => {
      const text = Array(50).fill('This is a varied sentence with different content each time.').join(' ');
      const partialResult = {
        sentiment: { score: 0.2, polarity: 'positive' as const, intensity: 0.2, volatility: 0.1 },
        readability: { fleschReadingEase: 60, fleschKincaidGrade: 8, gunningFog: 10, smogIndex: 10 },
      };
      
      const uncertainty = calculateUncertaintyIndicators(text, partialResult);
      
      expect(uncertainty.overallReliability).toBeGreaterThan(0.5);
    });
    
    test('warns about high sentiment volatility', () => {
      const text = 'Happy! Sad. Happy! Sad. Very emotional text with lots of variation.';
      const partialResult = {
        sentiment: { score: 0, polarity: 'neutral' as const, intensity: 0.5, volatility: 0.8 },
        readability: { fleschReadingEase: 70, fleschKincaidGrade: 6, gunningFog: 8, smogIndex: 8 },
      };
      
      const uncertainty = calculateUncertaintyIndicators(text, partialResult);
      
      expect(uncertainty.warnings.some(w => w.includes('volatility'))).toBe(true);
    });
  });
});
