import { z } from 'zod';

export const DocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  project: z.string().optional(),
  category: z.string().optional(),
  genre: z.string().optional(),
  tags: z.array(z.string()).default([]),
  createdAt: z.number(),
  updatedAt: z.number(),
});

// Productivity tracking schemas (Requirement #3)
export const ProductivityMetricsSchema = z.object({
  dailyWordCounts: z.array(z.object({
    date: z.string(),
    wordCount: z.number(),
    documentCount: z.number(),
  })),
  currentStreak: z.number(),
  longestStreak: z.number(),
  totalActiveDays: z.number(),
  averageWordsPerDay: z.number(),
  consistencyScore: z.number(), // 0-1 based on regularity
  volumeGrowthRate: z.number(), // percentage change over time
  missedDays: z.number(),
  lastActiveDate: z.string().nullable(),
});

// Topic and thematic analysis (Requirement #9)
export const TopicAnalysisSchema = z.object({
  dominantTopics: z.array(z.object({
    topic: z.string(),
    weight: z.number(),
    keywords: z.array(z.string()),
  })),
  topicDrift: z.array(z.object({
    date: z.string(),
    topics: z.array(z.object({
      topic: z.string(),
      weight: z.number(),
    })),
  })),
  thematicShifts: z.array(z.object({
    fromTopic: z.string(),
    toTopic: z.string(),
    date: z.string(),
    magnitude: z.number(),
  })),
});

// Stylistic fingerprint (Requirement #8)
export const StylisticFingerprintSchema = z.object({
  rhythmPatterns: z.array(z.number()), // sentence length sequence
  sentenceCadence: z.object({
    shortSentenceRatio: z.number(),
    mediumSentenceRatio: z.number(),
    longSentenceRatio: z.number(),
    variationScore: z.number(),
  }),
  functionWordProfile: z.record(z.number()), // function word frequencies
  punctuationProfile: z.record(z.number()), // punctuation usage
  phrasingTendencies: z.array(z.object({
    pattern: z.string(),
    frequency: z.number(),
  })),
});

// Stylistic evolution (Requirement #13)
export const StylisticEvolutionSchema = z.object({
  toneEvolution: z.array(z.object({
    date: z.string(),
    score: z.number(),
    polarity: z.string(),
  })),
  complexityEvolution: z.array(z.object({
    date: z.string(),
    avgSentenceLength: z.number(),
    clauseDepth: z.number(),
    readability: z.number(),
  })),
  vocabularyEvolution: z.array(z.object({
    date: z.string(),
    ttr: z.number(),
    uniqueWords: z.number(),
    rareWordUsage: z.number(),
  })),
  pacingEvolution: z.array(z.object({
    date: z.string(),
    rhythmVariation: z.number(),
    sentenceLengthStdDev: z.number(),
  })),
  sentimentStability: z.number(), // 0-1, how stable sentiment is over time
  thematicFocusShift: z.number(), // magnitude of topic changes
});

export const AnalyticsResultSchema = z.object({
  documentId: z.string(),
  timestamp: z.number(),
  wordCount: z.number(),
  characterCount: z.number(),
  sentenceCount: z.number(),
  paragraphCount: z.number(),
  sentiment: z.object({
    score: z.number(),
    polarity: z.enum(['positive', 'negative', 'neutral']),
    intensity: z.number(),
    sentenceLevel: z.array(z.object({
      sentence: z.string(),
      score: z.number(),
      polarity: z.enum(['positive', 'negative', 'neutral']),
    })).optional(),
    paragraphLevel: z.array(z.object({
      paragraph: z.string(),
      score: z.number(),
      polarity: z.enum(['positive', 'negative', 'neutral']),
      intensity: z.number(),
    })).optional(),
    polarityShifts: z.array(z.object({
      fromPolarity: z.string(),
      toPolarity: z.string(),
      position: z.number(),
      magnitude: z.number(),
    })).optional(),
    volatility: z.number().optional(),
    moodPatterns: z.array(z.string()).optional(),
  }),
  readability: z.object({
    fleschReadingEase: z.number(),
    fleschKincaidGrade: z.number(),
    gunningFog: z.number(),
    smogIndex: z.number(),
    sentenceComplexity: z.number().optional(),
    fragmentCount: z.number().optional(),
    technicalTermDensity: z.number().optional(),
  }),
  lexicalRichness: z.object({
    typeTokenRatio: z.number(),
    movingAverageTTR: z.number().optional(),
    hapaxLegomena: z.number(),
    repetitionRate: z.number().optional(),
    rareWordUsage: z.number().optional(),
    vocabularyDiversity: z.number(),
  }),
  styleMetrics: z.object({
    avgSentenceLength: z.number(),
    avgWordLength: z.number(),
    passiveVoiceCount: z.number(),
    punctuationDensity: z.number(),
    clauseDepth: z.number().optional(),
    coordinationFrequency: z.number().optional(),
    syntacticVariation: z.number().optional(),
    rhythmPatterns: z.array(z.number()).optional(),
    functionWordRatio: z.number().optional(),
    sentenceLengthDistribution: z.object({
      short: z.number(),
      medium: z.number(),
      long: z.number(),
    }).optional(),
  }),
  grammarMetrics: z.object({
    tenseConsistency: z.number(),
    pronounUsage: z.record(z.number()),
    verbFormDistribution: z.record(z.number()),
    modifierDensity: z.number(),
  }).optional(),
  topicAnalysis: z.object({
    keywords: z.array(z.string()),
    dominantTopics: z.array(z.object({
      topic: z.string(),
      weight: z.number(),
      keywords: z.array(z.string()),
    })),
    nGrams: z.array(z.object({
      phrase: z.string(),
      count: z.number(),
    })),
  }).optional(),
  repetitionAnalysis: z.object({
    repeatedPhrases: z.array(z.object({
      phrase: z.string(),
      count: z.number(),
      isDeliberate: z.boolean(),
      context: z.string().optional(),
    })),
    fillerWords: z.array(z.object({
      word: z.string(),
      count: z.number(),
      density: z.number(),
    })),
    structuralRedundancy: z.number(),
    overusedWords: z.array(z.object({
      word: z.string(),
      count: z.number(),
      expectedCount: z.number(),
    })),
  }).optional(),
  stylisticFingerprint: StylisticFingerprintSchema.optional(),
  uncertaintyIndicators: z.object({
    sentimentConfidence: z.number(),
    readabilityConfidence: z.number(),
    topicConfidence: z.number(),
    overallReliability: z.number(),
    warnings: z.array(z.string()),
  }).optional(),
  keywords: z.array(z.string()).optional(),
  nGrams: z.array(z.object({
    phrase: z.string(),
    count: z.number(),
  })).optional(),
  repeatedPhrases: z.array(z.object({
    phrase: z.string(),
    count: z.number(),
    isDeliberate: z.boolean().optional(),
  })).optional(),
});

export const AnnotationSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  content: z.string(),
  timestamp: z.number(),
});

export const SnapshotSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  content: z.string(),
  analytics: AnalyticsResultSchema,
  timestamp: z.number(),
});

export const WritingGoalSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  targetMetric: z.enum(['wordCount', 'consistency', 'readability', 'sentiment']),
  targetValue: z.number(),
  currentValue: z.number(),
  deadline: z.number().optional(),
  createdAt: z.number(),
  completed: z.boolean(),
});

export const DailyTrendSchema = z.object({
  date: z.string(),
  wordCount: z.number(),
  documentCount: z.number(),
  avgSentiment: z.number(),
  avgReadability: z.number(),
});

export const ComparisonResultSchema = z.object({
  doc1Id: z.string(),
  doc2Id: z.string(),
  toneDifference: z.number(),
  vocabularyDifference: z.number(),
  readabilityDifference: z.number(),
  complexityDifference: z.number(),
  sentimentDifference: z.number(),
  normalizedMetrics: z.object({
    doc1Normalized: z.object({
      sentimentPerWord: z.number(),
      complexityPerSentence: z.number(),
      vocabularyDensity: z.number(),
    }),
    doc2Normalized: z.object({
      sentimentPerWord: z.number(),
      complexityPerSentence: z.number(),
      vocabularyDensity: z.number(),
    }),
  }).optional(),
  stylisticSignatureComparison: z.object({
    rhythmSimilarity: z.number(),
    functionWordSimilarity: z.number(),
    punctuationSimilarity: z.number(),
    overallSimilarity: z.number(),
  }).optional(),
  sentimentDistributionComparison: z.object({
    doc1Distribution: z.object({
      positive: z.number(),
      neutral: z.number(),
      negative: z.number(),
    }),
    doc2Distribution: z.object({
      positive: z.number(),
      neutral: z.number(),
      negative: z.number(),
    }),
  }).optional(),
  timestamp: z.number(),
});

// Length bands for filtering (Requirement #16)
export const LengthBandSchema = z.enum(['micro', 'short', 'medium', 'long', 'extended']);

// Genre types
export const GenreSchema = z.enum(['fiction', 'non-fiction', 'academic', 'technical', 'creative', 'journal', 'article', 'other']);

export type Document = z.infer<typeof DocumentSchema>;
export type AnalyticsResult = z.infer<typeof AnalyticsResultSchema>;
export type Annotation = z.infer<typeof AnnotationSchema>;
export type Snapshot = z.infer<typeof SnapshotSchema>;
export type WritingGoal = z.infer<typeof WritingGoalSchema>;
export type DailyTrend = z.infer<typeof DailyTrendSchema>;
export type ComparisonResult = z.infer<typeof ComparisonResultSchema>;
export type ProductivityMetrics = z.infer<typeof ProductivityMetricsSchema>;
export type TopicAnalysis = z.infer<typeof TopicAnalysisSchema>;
export type StylisticFingerprint = z.infer<typeof StylisticFingerprintSchema>;
export type StylisticEvolution = z.infer<typeof StylisticEvolutionSchema>;
export type LengthBand = z.infer<typeof LengthBandSchema>;
export type Genre = z.infer<typeof GenreSchema>;
