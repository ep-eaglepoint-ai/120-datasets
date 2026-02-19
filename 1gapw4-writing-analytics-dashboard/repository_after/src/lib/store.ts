import { create } from "zustand";
import {
  Document,
  AnalyticsResult,
  Annotation,
  Snapshot,
  ProductivityMetrics,
  StylisticEvolution,
} from "./types";
import * as storage from "./storage";
import * as analysis from "./textAnalysis";
import * as advancedAnalysis from "./advancedAnalysis";
import * as comprehensiveAnalytics from "./comprehensiveAnalytics";
import * as csvExport from "./csvExport";
import { analyzeTopicsComprehensive } from "./comprehensiveAnalytics";

// Analytics cache for memoization
const analyticsCache = new Map<
  string,
  { content: string; result: AnalyticsResult }
>();

// Batch queue for operations
let batchQueue: Array<() => Promise<void>> = [];
let batchTimeout: NodeJS.Timeout | null = null;
const BATCH_DELAY = 100; // ms

// Web Worker instance for heavy processing
let analyticsWorker: Worker | null = null;

function getAnalyticsWorker(): Worker | null {
  if (typeof window === "undefined") return null;
  if (!analyticsWorker) {
    try {
      analyticsWorker = new Worker("/analytics.worker.js");
    } catch (e) {
      console.warn("Failed to create analytics worker:", e);
      return null;
    }
  }
  return analyticsWorker;
}

interface AppState {
  documents: Document[];
  currentDocument: Document | null;
  analytics: Map<string, AnalyticsResult>;
  annotations: Map<string, Annotation[]>;
  snapshots: Map<string, Snapshot[]>;
  productivityMetrics: ProductivityMetrics | null;
  stylisticEvolution: StylisticEvolution | null;
  loading: boolean;
  error: string | null;
  workerProgress: { completed: number; total: number } | null;

  loadDocuments: () => Promise<void>;
  addDocument: (
    doc: Omit<Document, "id" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
  updateDocument: (id: string, updates: Partial<Document>) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  setCurrentDocument: (doc: Document | null) => void;
  analyzeDocument: (documentId: string, force?: boolean) => Promise<void>;
  analyzeDocumentWithWorker: (documentId: string) => Promise<void>;
  addAnnotation: (documentId: string, content: string) => Promise<void>;
  createSnapshot: (documentId: string) => Promise<void>;
  restoreSnapshot: (snapshot: Snapshot) => Promise<void>;
  loadSnapshots: (documentId: string) => Promise<void>;
  computeProductivityMetrics: () => void;
  computeStylisticEvolution: () => void;
  exportData: () => Promise<string>;
  exportLongitudinalReport: () => string;
  exportVisualizationData: () => string;
  exportDocumentCSV: (documentId: string) => string | null;
  batchOperation: (operation: () => Promise<void>) => void;
  flushBatch: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  documents: [],
  currentDocument: null,
  analytics: new Map(),
  annotations: new Map(),
  snapshots: new Map(),
  productivityMetrics: null,
  stylisticEvolution: null,
  loading: false,
  error: null,
  workerProgress: null,

  loadDocuments: async () => {
    set({ loading: true, error: null });
    try {
      const docs = await storage.getAllDocuments();
      const analyticsData = await storage.getAllAnalytics();

      const analyticsMap = new Map<string, AnalyticsResult>();
      analyticsData.forEach((a) => analyticsMap.set(a.documentId, a));

      set({ documents: docs, analytics: analyticsMap, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  addDocument: async (docData) => {
    set({ loading: true, error: null });
    try {
      const now = Date.now();
      const doc: Document = {
        ...docData,
        id: `doc-${now}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: now,
        updatedAt: now,
        tags: docData.tags || [],
      };

      await storage.saveDocument(doc);

      // Add document to state FIRST, before analyzing
      set((state) => ({
        documents: [...state.documents, doc],
        loading: false,
      }));

      // Now analyze the document (it exists in state now)
      await get().analyzeDocument(doc.id);

      // Automatically create snapshot on import
      await get().createSnapshot(doc.id);
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  updateDocument: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const existing = get().documents.find((d) => d.id === id);
      if (!existing) throw new Error("Document not found");

      const updated = {
        ...existing,
        ...updates,
        updatedAt: Date.now(),
      };

      await storage.saveDocument(updated);

      // Create snapshot before updating content
      if (updates.content && existing.content !== updates.content) {
        await get().createSnapshot(id);
      }

      if (updates.content) {
        await get().analyzeDocument(id);
      }

      set((state) => ({
        documents: state.documents.map((d) => (d.id === id ? updated : d)),
        currentDocument:
          state.currentDocument?.id === id ? updated : state.currentDocument,
        loading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  deleteDocument: async (id) => {
    set({ loading: true, error: null });
    try {
      await storage.deleteDocument(id);

      set((state) => ({
        documents: state.documents.filter((d) => d.id !== id),
        currentDocument:
          state.currentDocument?.id === id ? null : state.currentDocument,
        loading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  setCurrentDocument: (doc) => {
    set({ currentDocument: doc });
  },

  analyzeDocument: async (documentId, force = false) => {
    try {
      const doc = get().documents.find((d) => d.id === documentId);
      if (!doc) throw new Error("Document not found");

      // Check cache for memoized analytics (incremental recalculation)
      const cached = analyticsCache.get(documentId);
      if (!force && cached && cached.content === doc.content) {
        // Use cached result
        set((state) => {
          const newAnalytics = new Map(state.analytics);
          newAnalytics.set(documentId, cached.result);
          return { analytics: newAnalytics };
        });
        return;
      }

      const shouldUseWorker = doc.content.length > 5000;
      const worker = getAnalyticsWorker();
      if (shouldUseWorker && worker) {
        await get().analyzeDocumentWithWorker(documentId);
        return;
      }

      // Basic metrics
      const basicMetrics = analysis.countBasicMetrics(doc.content);

      // Advanced sentiment analysis (Requirement #4)
      const advancedSentiment = comprehensiveAnalytics.analyzeAdvancedSentiment(
        doc.content,
      );

      // Enhanced readability with edge cases (Requirement #6)
      const readability = comprehensiveAnalytics.calculateEnhancedReadability(
        doc.content,
      );

      // Lexical richness with advanced metrics
      const lexicalRichness = analysis.calculateLexicalRichness(doc.content);
      const advancedLexical = advancedAnalysis.calculateAdvancedLexicalMetrics(
        doc.content,
      );

      // Advanced sentence structure (Requirement #7)
      const advancedSyntax =
        comprehensiveAnalytics.analyzeAdvancedSentenceStructure(doc.content);

      // Style metrics with rhythm and function words
      const styleMetrics = analysis.analyzeStyleMetrics(doc.content);

      // Stylistic fingerprint (Requirement #8)
      const stylisticFingerprint =
        comprehensiveAnalytics.computeStylisticFingerprint(doc.content);

      // Grammar patterns (Requirement #11)
      const grammarMetrics =
        comprehensiveAnalytics.analyzeGrammarPatternsComprehensive(doc.content);

      // Topic analysis (Requirement #9)
      const comprehensiveTopics = analyzeTopicsComprehensive(doc.content);
      const keywords = comprehensiveTopics.keywords;

      // Repetition analysis (Requirement #10)
      const repetitionAnalysis = comprehensiveAnalytics.analyzeRepetition(
        doc.content,
      );

      // Uncertainty indicators (Requirement #23)
      const partialResult = {
        sentiment: {
          ...advancedSentiment,
          polarity: advancedSentiment.polarity as
            | "positive"
            | "negative"
            | "neutral",
        },
        readability,
      };
      const uncertaintyIndicators =
        comprehensiveAnalytics.calculateUncertaintyIndicators(
          doc.content,
          partialResult,
        );

      const analyticsResult: AnalyticsResult = {
        documentId,
        timestamp: Date.now(),
        ...basicMetrics,
        sentiment: {
          ...advancedSentiment,
          polarity: advancedSentiment.polarity as
            | "positive"
            | "negative"
            | "neutral",
        },
        readability,
        lexicalRichness: {
          ...lexicalRichness,
          movingAverageTTR:
            (advancedLexical as { movingAverageTTR?: number })
              .movingAverageTTR || lexicalRichness.typeTokenRatio,
          repetitionRate: advancedLexical.repetitionRate,
          rareWordUsage: advancedLexical.rareWordUsage,
        },
        styleMetrics: {
          ...styleMetrics,
          clauseDepth: advancedSyntax.clauseDepth,
          coordinationFrequency: advancedSyntax.coordinationFrequency,
          syntacticVariation: advancedSyntax.syntacticVariation,
          rhythmPatterns: stylisticFingerprint.rhythmPatterns,
          functionWordRatio: (
            Object.values(stylisticFingerprint.functionWordProfile) as number[]
          ).reduce((a, b) => a + b, 0),
          sentenceLengthDistribution: advancedSyntax.sentenceLengthDistribution,
        },
        grammarMetrics,
        topicAnalysis: {
          keywords: comprehensiveTopics.keywords.map((k) => k.word),
          dominantTopics: comprehensiveTopics.dominantTopics,
          nGrams: comprehensiveTopics.nGrams,
          enhancedKeywords: comprehensiveTopics.keywords, // TF-IDF weighted
          entityAnalysis: comprehensiveTopics.entities,
          domainAnalysis: comprehensiveTopics.domain,
          thematicAnalysis: comprehensiveTopics.thematicAnalysis,
          coherenceScore: comprehensiveTopics.coherenceScore,
          topicSummary: comprehensiveTopics.summary,
        },
        repetitionAnalysis,
        stylisticFingerprint,
        uncertaintyIndicators,
        keywords,
        nGrams: comprehensiveTopics.nGrams,
        repeatedPhrases: repetitionAnalysis.repeatedPhrases,
      };

      // Cache the result
      analyticsCache.set(documentId, {
        content: doc.content,
        result: analyticsResult,
      });

      await storage.saveAnalytics(analyticsResult);

      set((state) => {
        const newAnalytics = new Map(state.analytics);
        newAnalytics.set(documentId, analyticsResult);
        return { analytics: newAnalytics };
      });

      // Automatically create snapshot after analytics recalculation
      await get().createSnapshot(documentId);

      // Update productivity metrics after new analysis
      get().computeProductivityMetrics();
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  analyzeDocumentWithWorker: async (documentId) => {
    const worker = getAnalyticsWorker();
    if (!worker) {
      // Fallback to synchronous analysis
      return get().analyzeDocument(documentId, true);
    }

    const doc = get().documents.find((d) => d.id === documentId);
    if (!doc) {
      set({ error: "Document not found" });
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const handleMessage = (e: MessageEvent) => {
        const { type, payload } = e.data;

        if (type === "ANALYSIS_COMPLETE" && payload.documentId === documentId) {
          worker.removeEventListener("message", handleMessage);

          const analyticsResult: AnalyticsResult = {
            documentId,
            timestamp: Date.now(),
            ...payload.result,
          };

          analyticsCache.set(documentId, {
            content: doc.content,
            result: analyticsResult,
          });

          set((state) => {
            const newAnalytics = new Map(state.analytics);
            newAnalytics.set(documentId, analyticsResult);
            return { analytics: newAnalytics, workerProgress: null };
          });

          storage.saveAnalytics(analyticsResult).then(async () => {
            await get().createSnapshot(documentId);
            get().computeProductivityMetrics();
            resolve();
          });
        } else if (
          type === "ANALYSIS_ERROR" &&
          payload.documentId === documentId
        ) {
          worker.removeEventListener("message", handleMessage);
          set({ error: payload.error, workerProgress: null });
          reject(new Error(payload.error));
        } else if (type === "BATCH_PROGRESS") {
          set({ workerProgress: payload });
        }
      };

      worker.addEventListener("message", handleMessage);
      worker.postMessage({
        type: "ANALYZE_TEXT",
        payload: { documentId, content: doc.content },
      });
    });
  },

  addAnnotation: async (documentId, content) => {
    try {
      const annotation: Annotation = {
        id: `ann-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        documentId,
        content,
        timestamp: Date.now(),
      };

      await storage.saveAnnotation(annotation);

      set((state) => {
        const newAnnotations = new Map(state.annotations);
        const existing = newAnnotations.get(documentId) || [];
        newAnnotations.set(documentId, [...existing, annotation]);
        return { annotations: newAnnotations };
      });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  createSnapshot: async (documentId) => {
    try {
      const doc = get().documents.find((d) => d.id === documentId);
      const analyticsResult = get().analytics.get(documentId);

      if (!doc || !analyticsResult) return;

      const snapshot: Snapshot = {
        id: `snap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        documentId,
        content: doc.content,
        analytics: analyticsResult,
        timestamp: Date.now(),
      };

      await storage.saveSnapshot(snapshot);

      set((state) => {
        const newSnapshots = new Map(state.snapshots);
        const existing = newSnapshots.get(documentId) || [];
        newSnapshots.set(documentId, [...existing, snapshot]);
        return { snapshots: newSnapshots };
      });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  restoreSnapshot: async (snapshot) => {
    try {
      const existing = get().documents.find(
        (d) => d.id === snapshot.documentId,
      );
      if (!existing) throw new Error("Document not found");

      const updated = {
        ...existing,
        content: snapshot.content,
        updatedAt: Date.now(),
      };

      await storage.saveDocument(updated);
      await storage.saveAnalytics(snapshot.analytics);

      set((state) => {
        const newAnalytics = new Map(state.analytics);
        newAnalytics.set(snapshot.documentId, snapshot.analytics);
        return {
          documents: state.documents.map((d) =>
            d.id === updated.id ? updated : d,
          ),
          currentDocument:
            state.currentDocument?.id === updated.id
              ? updated
              : state.currentDocument,
          analytics: newAnalytics,
        };
      });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  loadSnapshots: async (documentId) => {
    try {
      const snapshots = await storage.getSnapshotsByDocument(documentId);
      set((state) => {
        const newSnapshots = new Map(state.snapshots);
        newSnapshots.set(documentId, snapshots);
        return { snapshots: newSnapshots };
      });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  batchOperation: (operation) => {
    batchQueue.push(operation);

    if (batchTimeout) {
      clearTimeout(batchTimeout);
    }

    batchTimeout = setTimeout(() => {
      get().flushBatch();
    }, BATCH_DELAY);
  },

  flushBatch: async () => {
    const operations = [...batchQueue];
    batchQueue = [];

    if (batchTimeout) {
      clearTimeout(batchTimeout);
      batchTimeout = null;
    }

    await Promise.all(operations.map((op) => op()));
  },

  exportData: async () => {
    try {
      const data = await storage.exportAllData();
      return JSON.stringify(data, null, 2);
    } catch (error) {
      throw new Error(`Export failed: ${(error as Error).message}`);
    }
  },

  computeProductivityMetrics: () => {
    const { documents, analytics } = get();
    const productivityMetrics =
      comprehensiveAnalytics.calculateProductivityMetrics(documents, analytics);
    set({ productivityMetrics });
  },

  computeStylisticEvolution: () => {
    const { documents, analytics } = get();
    const stylisticEvolution = comprehensiveAnalytics.trackStylisticEvolution(
      documents,
      analytics,
    );
    set({ stylisticEvolution });
  },

  exportLongitudinalReport: () => {
    const { documents, analytics, productivityMetrics, stylisticEvolution } =
      get();
    const topicAnalysis = comprehensiveAnalytics.detectTopicDrift(
      documents,
      analytics,
    );
    return csvExport.exportLongitudinalReportCSV(
      documents,
      analytics,
      productivityMetrics,
      stylisticEvolution,
      topicAnalysis,
    );
  },

  exportVisualizationData: () => {
    const { productivityMetrics, stylisticEvolution } = get();
    return csvExport.exportVisualizationDataCSV(
      productivityMetrics,
      stylisticEvolution,
    );
  },

  exportDocumentCSV: (documentId: string) => {
    const { documents, analytics } = get();
    const doc = documents.find((d: Document) => d.id === documentId);
    const docAnalytics = analytics.get(documentId);
    if (!doc || !docAnalytics) return null;
    return csvExport.exportDocumentAnalyticsCSV(doc, docAnalytics);
  },
}));
