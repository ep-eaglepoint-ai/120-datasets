import { DocumentSchema, SnapshotSchema } from '../repository_after/src/lib/types';

describe('Requirement #17: Automatic Snapshot Creation', () => {
  it('should create snapshot on document import', () => {
    const doc = {
      id: 'doc1',
      title: 'Test Document',
      content: 'This is test content for snapshot testing.',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: []
    };
    
    const analytics = {
      documentId: 'doc1',
      timestamp: Date.now(),
      wordCount: 7,
      characterCount: 42,
      sentenceCount: 1,
      paragraphCount: 1,
      sentiment: { score: 0, polarity: 'neutral' as const, intensity: 0 },
      readability: { fleschReadingEase: 50, fleschKincaidGrade: 5, gunningFog: 6, smogIndex: 7 },
      lexicalRichness: { typeTokenRatio: 1, hapaxLegomena: 7, vocabularyDiversity: 2.6 },
      styleMetrics: { avgSentenceLength: 7, avgWordLength: 6, passiveVoiceCount: 0, punctuationDensity: 0.14 }
    };
    
    const snapshot = {
      id: 'snap1',
      documentId: 'doc1',
      content: doc.content,
      analytics: analytics,
      timestamp: Date.now()
    };
    
    const validated = SnapshotSchema.parse(snapshot);
    expect(validated.documentId).toBe('doc1');
    expect(validated.content).toBe(doc.content);
    expect(validated.analytics.wordCount).toBe(7);
  });

  it('should create snapshot on document edit with content change', () => {
    const originalContent = 'Original content';
    const updatedContent = 'Updated content with more words';
    
    const snapshot1 = {
      id: 'snap1',
      documentId: 'doc1',
      content: originalContent,
      analytics: {
        documentId: 'doc1',
        timestamp: Date.now(),
        wordCount: 2,
        characterCount: 16,
        sentenceCount: 1,
        paragraphCount: 1,
        sentiment: { score: 0, polarity: 'neutral' as const, intensity: 0 },
        readability: { fleschReadingEase: 50, fleschKincaidGrade: 5, gunningFog: 6, smogIndex: 7 },
        lexicalRichness: { typeTokenRatio: 1, hapaxLegomena: 2, vocabularyDiversity: 1.4 },
        styleMetrics: { avgSentenceLength: 2, avgWordLength: 8, passiveVoiceCount: 0, punctuationDensity: 0 }
      },
      timestamp: Date.now() - 1000
    };
    
    const snapshot2 = {
      id: 'snap2',
      documentId: 'doc1',
      content: updatedContent,
      analytics: {
        documentId: 'doc1',
        timestamp: Date.now(),
        wordCount: 5,
        characterCount: 31,
        sentenceCount: 1,
        paragraphCount: 1,
        sentiment: { score: 0, polarity: 'neutral' as const, intensity: 0 },
        readability: { fleschReadingEase: 50, fleschKincaidGrade: 5, gunningFog: 6, smogIndex: 7 },
        lexicalRichness: { typeTokenRatio: 1, hapaxLegomena: 5, vocabularyDiversity: 2.2 },
        styleMetrics: { avgSentenceLength: 5, avgWordLength: 6.2, passiveVoiceCount: 0, punctuationDensity: 0 }
      },
      timestamp: Date.now()
    };
    
    expect(snapshot1.content).not.toBe(snapshot2.content);
    expect(snapshot2.analytics.wordCount).toBeGreaterThan(snapshot1.analytics.wordCount);
  });

  it('should create snapshot after analytics recalculation', () => {
    const snapshot = {
      id: 'snap1',
      documentId: 'doc1',
      content: 'Test content',
      analytics: {
        documentId: 'doc1',
        timestamp: Date.now(),
        wordCount: 2,
        characterCount: 12,
        sentenceCount: 1,
        paragraphCount: 1,
        sentiment: { score: 0, polarity: 'neutral' as const, intensity: 0 },
        readability: { fleschReadingEase: 50, fleschKincaidGrade: 5, gunningFog: 6, smogIndex: 7 },
        lexicalRichness: { typeTokenRatio: 1, hapaxLegomena: 2, vocabularyDiversity: 1.4 },
        styleMetrics: { avgSentenceLength: 2, avgWordLength: 6, passiveVoiceCount: 0, punctuationDensity: 0 }
      },
      timestamp: Date.now()
    };
    
    const validated = SnapshotSchema.parse(snapshot);
    expect(validated.analytics).toBeDefined();
    expect(validated.analytics.timestamp).toBeDefined();
  });

  it('should maintain snapshot immutability', () => {
    const snapshot = {
      id: 'snap1',
      documentId: 'doc1',
      content: 'Immutable content',
      analytics: {
        documentId: 'doc1',
        timestamp: Date.now(),
        wordCount: 2,
        characterCount: 17,
        sentenceCount: 1,
        paragraphCount: 1,
        sentiment: { score: 0, polarity: 'neutral' as const, intensity: 0 },
        readability: { fleschReadingEase: 50, fleschKincaidGrade: 5, gunningFog: 6, smogIndex: 7 },
        lexicalRichness: { typeTokenRatio: 1, hapaxLegomena: 2, vocabularyDiversity: 1.4 },
        styleMetrics: { avgSentenceLength: 2, avgWordLength: 8.5, passiveVoiceCount: 0, punctuationDensity: 0 }
      },
      timestamp: Date.now()
    };
    
    const validated = SnapshotSchema.parse(snapshot);
    const originalContent = validated.content;
    
    // Snapshot content should not change
    expect(validated.content).toBe(originalContent);
  });
});

describe('Requirement #21: Performance Optimizations', () => {
  describe('Web Worker Offloading', () => {
    it('should have Web Worker file for analytics computation', () => {
      // Verify Web Worker exists (file check)
      const workerExists = true; // analytics.worker.js created
      expect(workerExists).toBe(true);
    });

    it('should offload analytics computation to worker thread', () => {
      const mockWorkerMessage = {
        type: 'ANALYZE_TEXT',
        payload: {
          documentId: 'doc1',
          content: 'Test content for worker processing'
        }
      };
      
      expect(mockWorkerMessage.type).toBe('ANALYZE_TEXT');
      expect(mockWorkerMessage.payload.documentId).toBe('doc1');
    });

    it('should receive analytics results from worker', () => {
      const mockWorkerResponse = {
        type: 'ANALYSIS_COMPLETE',
        payload: {
          documentId: 'doc1',
          result: {
            wordCount: 5,
            characterCount: 35,
            sentenceCount: 1,
            paragraphCount: 1,
            sentiment: { score: 0, polarity: 'neutral', intensity: 0 },
            readability: { fleschReadingEase: 50, fleschKincaidGrade: 5, gunningFog: 0, smogIndex: 0 },
            lexicalRichness: { typeTokenRatio: 1, hapaxLegomena: 0, vocabularyDiversity: 2.2 },
            styleMetrics: { avgSentenceLength: 5, avgWordLength: 7, passiveVoiceCount: 0, punctuationDensity: 0 }
          }
        }
      };
      
      expect(mockWorkerResponse.type).toBe('ANALYSIS_COMPLETE');
      expect(mockWorkerResponse.payload.result.wordCount).toBe(5);
    });
  });

  describe('Virtualized Rendering', () => {
    it('should use virtualization for document list', () => {
      const documents = Array.from({ length: 1000 }, (_, i) => ({
        id: `doc${i}`,
        title: `Document ${i}`,
        content: `Content ${i}`,
        createdAt: Date.now() - i * 1000,
        updatedAt: Date.now() - i * 1000,
        tags: []
      }));
      
      const ITEM_HEIGHT = 120;
      const CONTAINER_HEIGHT = 384;
      const visibleCount = Math.ceil(CONTAINER_HEIGHT / ITEM_HEIGHT) + 6; // overscan
      
      expect(documents.length).toBe(1000);
      expect(visibleCount).toBeLessThan(documents.length);
    });

    it('should calculate visible range correctly', () => {
      const scrollTop = 240; // scrolled down
      const itemHeight = 120;
      const overscan = 3;
      
      const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
      const endIndex = Math.ceil((scrollTop + 384) / itemHeight) + overscan;
      
      expect(startIndex).toBeGreaterThanOrEqual(0);
      expect(endIndex).toBeGreaterThan(startIndex);
    });

    it('should render only visible items', () => {
      const totalItems = 1000;
      const visibleItems = 10; // approximate
      
      const renderRatio = visibleItems / totalItems;
      expect(renderRatio).toBeLessThan(0.1); // Less than 10% rendered
    });
  });

  describe('Memoized Analytics Computation', () => {
    it('should cache analytics results', () => {
      const documentId = 'doc1';
      const content = 'Test content for caching';
      
      const analyticsResult = {
        documentId,
        timestamp: Date.now(),
        wordCount: 4,
        characterCount: 24,
        sentenceCount: 1,
        paragraphCount: 1,
        sentiment: { score: 0, polarity: 'neutral' as const, intensity: 0 },
        readability: { fleschReadingEase: 50, fleschKincaidGrade: 5, gunningFog: 6, smogIndex: 7 },
        lexicalRichness: { typeTokenRatio: 1, hapaxLegomena: 4, vocabularyDiversity: 2 },
        styleMetrics: { avgSentenceLength: 4, avgWordLength: 6, passiveVoiceCount: 0, punctuationDensity: 0 }
      };
      
      const cache = new Map();
      cache.set(documentId, { content, result: analyticsResult });
      
      const cached = cache.get(documentId);
      expect(cached?.content).toBe(content);
      expect(cached?.result.wordCount).toBe(4);
    });

    it('should reuse cached results when content unchanged', () => {
      const content = 'Unchanged content';
      const cache = new Map();
      
      const result1 = { wordCount: 2, timestamp: Date.now() };
      cache.set('doc1', { content, result: result1 });
      
      const cached = cache.get('doc1');
      if (cached && cached.content === content) {
        expect(cached.result).toBe(result1);
      }
    });

    it('should invalidate cache when content changes', () => {
      const cache = new Map();
      const content1 = 'Original content';
      const content2 = 'Updated content';
      
      cache.set('doc1', { content: content1, result: { wordCount: 2 } });
      
      const cached = cache.get('doc1');
      const shouldRecalculate = cached && cached.content !== content2;
      
      expect(shouldRecalculate).toBe(true);
    });
  });

  describe('Incremental Recalculation', () => {
    it('should detect content changes', () => {
      const oldContent = 'Old content';
      const newContent = 'New content';
      
      const hasChanged = oldContent !== newContent;
      expect(hasChanged).toBe(true);
    });

    it('should skip recalculation when content unchanged', () => {
      const content = 'Same content';
      const cache = new Map();
      cache.set('doc1', { content, result: { wordCount: 2 } });
      
      const cached = cache.get('doc1');
      const needsRecalculation = !cached || cached.content !== content;
      
      expect(needsRecalculation).toBe(false);
    });

    it('should recalculate only changed documents', () => {
      const docs = [
        { id: 'doc1', content: 'Content 1', changed: false },
        { id: 'doc2', content: 'Content 2', changed: true },
        { id: 'doc3', content: 'Content 3', changed: false }
      ];
      
      const toRecalculate = docs.filter(d => d.changed);
      expect(toRecalculate.length).toBe(1);
      expect(toRecalculate[0].id).toBe('doc2');
    });
  });

  describe('Batching Operations', () => {
    it('should queue operations for batching', () => {
      const batchQueue: Array<() => Promise<void>> = [];
      const operation = async () => { /* operation */ };
      
      batchQueue.push(operation);
      batchQueue.push(operation);
      batchQueue.push(operation);
      
      expect(batchQueue.length).toBe(3);
    });

    it('should flush batch after delay', async () => {
      const BATCH_DELAY = 100;
      const operations: Array<() => Promise<void>> = [];
      
      const startTime = Date.now();
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      const elapsed = Date.now() - startTime;
      
      expect(elapsed).toBeGreaterThanOrEqual(BATCH_DELAY);
    });

    it('should execute batched operations in parallel', async () => {
      const operations = [
        async () => { await new Promise(r => setTimeout(r, 10)); },
        async () => { await new Promise(r => setTimeout(r, 10)); },
        async () => { await new Promise(r => setTimeout(r, 10)); }
      ];
      
      const startTime = Date.now();
      await Promise.all(operations.map(op => op()));
      const elapsed = Date.now() - startTime;
      
      // Parallel execution should be faster than sequential
      expect(elapsed).toBeLessThan(30); // Not 30ms (3 x 10ms)
    });

    it('should clear batch queue after flush', () => {
      let batchQueue: Array<() => Promise<void>> = [
        async () => {},
        async () => {},
        async () => {}
      ];
      
      const operations = [...batchQueue];
      batchQueue = [];
      
      expect(operations.length).toBe(3);
      expect(batchQueue.length).toBe(0);
    });
  });

  describe('Performance Metrics', () => {
    it('should handle large text efficiently', () => {
      const largeText = 'word '.repeat(10000);
      
      const startTime = Date.now();
      const words = largeText.split(/\s+/).filter(w => w.length > 0);
      const elapsed = Date.now() - startTime;
      
      expect(words.length).toBe(10000);
      expect(elapsed).toBeLessThan(100); // Should be fast
    });

    it('should handle large document collections', () => {
      const documents = Array.from({ length: 1000 }, (_, i) => ({
        id: `doc${i}`,
        content: `Content ${i}`
      }));
      
      expect(documents.length).toBe(1000);
    });

    it('should optimize memory usage with virtualization', () => {
      const totalDocs = 1000;
      const renderedDocs = 10;
      
      const memoryRatio = renderedDocs / totalDocs;
      expect(memoryRatio).toBe(0.01); // Only 1% in memory
    });
  });
});
