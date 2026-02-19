import compromise from 'compromise';
import { tokenizeText } from './textAnalysis';
import { Document, AnalyticsResult, ProductivityMetrics, TopicAnalysis, StylisticFingerprint, StylisticEvolution } from './types';

// Domain-specific vocabulary lists for enhanced domain detection
const DOMAIN_LEXICONS = {
  academic: [
    'analysis', 'research', 'methodology', 'hypothesis', 'empirical',
    'theoretical', 'conceptual', 'paradigm', 'discourse', 'scholarly',
    'citation', 'peer-reviewed', 'literature', 'findings', 'conclusion'
  ],
  technical: [
    'algorithm', 'protocol', 'interface', 'implementation', 'deployment',
    'architecture', 'framework', 'optimization', 'scalability', 'reliability',
    'database', 'server', 'client', 'encryption', 'authentication'
  ],
  literary: [
    'narrative', 'protagonist', 'antagonist', 'metaphor', 'symbolism',
    'foreshadowing', 'imagery', 'theme', 'motif', 'allegory',
    'characterization', 'plot', 'setting', 'dialogue', 'prose'
  ],
  business: [
    'strategy', 'revenue', 'stakeholder', 'leverage', 'benchmark',
    'sustainable', 'innovation', 'disruption', 'scalable', 'ecosystem',
    'market', 'investment', 'ROI', 'metrics', 'quarterly'
  ],
  scientific: [
    'experiment', 'observation', 'data', 'control', 'variable',
    'hypothesis', 'theory', 'evidence', 'conclusion', 'method',
    'sample', 'population', 'statistics', 'significant', 'correlation'
  ]
};

// ============================================================================
// COMPREHENSIVE TOPIC ANALYSIS FUNCTIONS
// ============================================================================

// Enhanced Topic Analysis with multiple techniques
export function analyzeTopicsComprehensive(text: string, keywords: string[] = []): any {
  const words = tokenizeText(text).words;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  // 1. Keyword Extraction with TF-IDF weighting
  const enhancedKeywords = extractKeywordsWithTFIDF(text);
  
  // 2. Named Entity Recognition
  const entities = extractNamedEntities(text);
  
  // 3. Topic Clustering with semantic grouping
  const topics = clusterTopicsComprehensive(words, sentences, enhancedKeywords, entities);
  
  // 4. Thematic Analysis
  const thematicAnalysis = analyzeThemesComprehensive(text, topics);
  
  // 5. Domain Detection
  const domain = detectDomainComprehensive(text);
  
  // 6. Topic Coherence Score
  const coherenceScore = calculateTopicCoherence(topics, text);
  
  // 7. Keep original format for backward compatibility
  const dominantTopics = topics.slice(0, 5).map(topic => ({
    topic: topic.name,
    weight: topic.weight / 100, // Normalize for compatibility
    keywords: topic.keywords || [topic.name]
  }));
  
  // 8. Extract n-grams (compatible with existing format)
  const nGrams = extractNGramsAdvanced(words, 2, 15);
  
  return {
    dominantTopics: dominantTopics,
    nGrams: nGrams,
    keywords: enhancedKeywords.map(k => k.word),
    enhancedKeywords: enhancedKeywords, // Full objects with TF-IDF
    entities,
    topics,
    thematicAnalysis,
    domain,
    coherenceScore,
    summary: generateTopicSummary(topics, thematicAnalysis)
  };
}

// TF-IDF Keyword Extraction
function extractKeywordsWithTFIDF(text: string, corpus: string[] = []): Array<{word: string, tfidf: number, frequency: number}> {
  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  const termFreq = new Map<string, number>();
  const docFreq = new Map<string, number>();
  
  // Calculate term frequency
  words.forEach(word => {
    termFreq.set(word, (termFreq.get(word) || 0) + 1);
  });
  
  // Calculate TF-IDF (simplified without full corpus)
  const totalWords = words.length || 1;
  const keywords = Array.from(termFreq.entries())
    .map(([word, tf]) => {
      const idf = Math.log((corpus.length + 1) / (1 + (docFreq.get(word) || 0)));
      const tfidf = (tf / totalWords) * idf;
      return { word, tfidf, frequency: tf };
    })
    .sort((a, b) => b.tfidf - a.tfidf)
    .slice(0, 25);
  
  return keywords;
}

// Named Entity Recognition using compromise
function extractNamedEntities(text: string): any {
  const doc = compromise(text as any);
  
  const people = doc.people().out('array');
  const places = doc.places().out('array');
  const organizations = doc.organizations().out('array');
  const dates = doc.dates().out('array');
  
  // Custom entity extraction
  const concepts = extractConcepts(text);
  const technicalTerms = extractTechnicalTerms(text);
  
  return {
    people: groupAndCount(people),
    places: groupAndCount(places),
    organizations: groupAndCount(organizations),
    dates: groupAndCount(dates),
    concepts: groupAndCount(concepts),
    technicalTerms: groupAndCount(technicalTerms),
    totalCount: people.length + places.length + organizations.length + 
                dates.length + concepts.length + technicalTerms.length
  };
}

function extractConcepts(text: string): string[] {
  const doc = compromise(text as any);
  const nouns = doc.nouns().out('array');
  const adjectives = doc.adjectives().out('array');
  
  // Filter for abstract concepts
  const abstractNouns = nouns.filter((word: string) => 
    word.length > 5 && 
    !Object.values(DOMAIN_LEXICONS).flat().includes(word)
  );
  
  return [...abstractNouns, ...adjectives];
}

function extractTechnicalTerms(text: string): string[] {
  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  const technicalTerms: string[] = [];
  
  // Check against domain lexicons
  Object.values(DOMAIN_LEXICONS).forEach(lexicon => {
    words.forEach(word => {
      if (lexicon.includes(word) && !technicalTerms.includes(word)) {
        technicalTerms.push(word);
      }
    });
  });
  
  return technicalTerms;
}

function groupAndCount(items: string[]): Array<{item: string, count: number}> {
  const counts = new Map<string, number>();
  items.forEach(item => {
    const key = item.toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  
  return Array.from(counts.entries())
    .map(([item, count]) => ({ item, count }))
    .sort((a, b) => b.count - a.count);
}

// Advanced Topic Clustering
function clusterTopicsComprehensive(words: string[], sentences: string[], keywords: any[], entities: any): any[] {
  const clusters = [];
  
  // Cluster by semantic similarity
  const semanticClusters = clusterBySemanticSimilarity(keywords);
  
  // Entity-based clusters
  const entityClusters = clusterByEntities(entities);
  
  // Theme-based clusters
  const themeClusters = identifyThematicClusters(sentences);
  
  // Combine clusters
  clusters.push(...semanticClusters, ...entityClusters, ...themeClusters);
  
  // Deduplicate and rank clusters
  const mergedClusters = mergeClusters(clusters);
  
  return mergedClusters.sort((a: any, b: any) => b.weight - a.weight).slice(0, 10);
}

function clusterBySemanticSimilarity(keywords: any[]): any[] {
  const clusters = [];
  const usedWords = new Set<string>();
  
  keywords.forEach((kw, i) => {
    if (usedWords.has(kw.word)) return;
    
    const cluster = {
      type: 'semantic',
      name: kw.word,
      keywords: [kw.word],
      weight: kw.tfidf * 100, // Scale for consistency
      members: [] as string[],
      relatedConcepts: [] as string[]
    };
    
    // Find similar keywords
    keywords.slice(i + 1).forEach(otherKw => {
      if (areWordsRelated(kw.word, otherKw.word)) {
        cluster.keywords.push(otherKw.word);
        cluster.weight += otherKw.tfidf * 100;
        usedWords.add(otherKw.word);
      }
    });
    
    if (cluster.keywords.length > 1) {
      clusters.push(cluster);
    }
  });
  
  return clusters;
}

function areWordsRelated(word1: string, word2: string): boolean {
  if (word1.length < 4 || word2.length < 4) return false;
  
  // Check for common prefixes/suffixes
  const commonPrefix = word1.substring(0, Math.min(4, word1.length, word2.length));
  const commonSuffix = word1.substring(Math.max(0, word1.length - 4));
  
  return word2.startsWith(commonPrefix) || 
         word2.endsWith(commonSuffix) ||
         word1.includes(word2.substring(0, 3)) || 
         word2.includes(word1.substring(0, 3));
}

function clusterByEntities(entities: any): any[] {
  const clusters = [];
  
  Object.entries(entities).forEach(([type, items]: [string, any]) => {
    if (type !== 'totalCount' && Array.isArray(items) && items.length > 0) {
      const cluster = {
        type: 'entity',
        name: `${type} (${items.length})`,
        entities: items.slice(0, 5),
        weight: items.reduce((sum: number, item: any) => sum + item.count, 0) * 10,
        metadata: { entityType: type }
      };
      clusters.push(cluster);
    }
  });
  
  return clusters;
}

function identifyThematicClusters(sentences: string[]): any[] {
  const themes = new Map<string, number>();
  
  sentences.forEach(sentence => {
    const doc = compromise(sentence as any);
    const verbs = doc.verbs().out('array');
    const nouns = doc.nouns().out('array');
    
    // Simple theme detection based on verb-noun pairs
    verbs.forEach((verb: string) => {
      nouns.forEach((noun: string) => {
        const theme = `${verb} ${noun}`;
        themes.set(theme, (themes.get(theme) || 0) + 1);
      });
    });
  });
  
  return Array.from(themes.entries())
    .filter(([, count]) => count >= 2)
    .map(([theme, count]) => ({
      type: 'thematic',
      name: theme,
      frequency: count,
      weight: count * 20, // Thematic clusters get higher weight
      examples: sentences.filter(s => s.includes(theme.split(' ')[0])).slice(0, 2)
    }));
}

function mergeClusters(clusters: any[]): any[] {
  const merged = [];
  const seen = new Set<string>();
  
  clusters.forEach(cluster => {
    const key = cluster.name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      
      // Find similar clusters to merge
      const similarClusters = clusters.filter(c => 
        c !== cluster && 
        (c.name.toLowerCase().includes(key) || key.includes(c.name.toLowerCase()))
      );
      
      if (similarClusters.length > 0) {
        // Merge with first similar cluster
        const mergedCluster = {
          ...cluster,
          subclusters: similarClusters.map(c => c.name),
          weight: cluster.weight + similarClusters.reduce((sum: number, c: any) => sum + c.weight, 0)
        };
        merged.push(mergedCluster);
        similarClusters.forEach(c => seen.add(c.name.toLowerCase()));
      } else {
        merged.push(cluster);
      }
    }
  });
  
  return merged;
}

// Thematic Analysis
function analyzeThemesComprehensive(text: string, topics: any[]): any {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  const themes = {
    dominantThemes: [] as any[],
    themeDistribution: {} as Record<string, number>,
    themeCohesion: 0,
    themeDevelopment: [] as any[]
  };
  
  // Analyze each sentence for themes
  sentences.forEach((sentence, index) => {
    const sentenceThemes = extractSentenceThemes(sentence);
    themes.themeDevelopment.push({
      sentenceIndex: index,
      themes: sentenceThemes,
      position: index / Math.max(sentences.length - 1, 1)
    });
    
    sentenceThemes.forEach(theme => {
      themes.themeDistribution[theme] = (themes.themeDistribution[theme] || 0) + 1;
    });
  });
  
  // Determine dominant themes
  themes.dominantThemes = Object.entries(themes.themeDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([theme, count]) => ({
      theme,
      frequency: count,
      percentage: (count / sentences.length) * 100
    }));
  
  // Calculate theme cohesion
  themes.themeCohesion = calculateThemeCohesion(themes.themeDevelopment);
  
  return themes;
}

function extractSentenceThemes(sentence: string): string[] {
  const doc = compromise(sentence as any);
  const themes = [];
  
  // Extract action themes
  const verbs = doc.verbs().out('array');
  verbs.forEach((verb: string) => {
    if (verb.length > 3 && !['is', 'are', 'was', 'were', 'have', 'has'].includes(verb)) {
      themes.push(`action:${verb}`);
    }
  });
  
  // Extract subject themes
  const subjects = doc.match('#Noun').out('array');
  subjects.forEach((subject: string) => {
    if (subject.length > 3) {
      themes.push(`subject:${subject}`);
    }
  });
  
  // Extract emotional themes
  const emotions = extractEmotionalThemes(sentence);
  themes.push(...emotions.map(e => `emotion:${e}`));
  
  return themes;
}

function extractEmotionalThemes(sentence: string): string[] {
  const emotionalWords = {
    joy: ['happy', 'joy', 'delight', 'pleasure', 'excited'],
    sadness: ['sad', 'unhappy', 'grief', 'sorrow', 'melancholy'],
    anger: ['angry', 'furious', 'outraged', 'irritated', 'annoyed'],
    fear: ['afraid', 'scared', 'frightened', 'terrified', 'anxious']
  };
  
  const themes: string[] = [];
  Object.entries(emotionalWords).forEach(([emotion, words]) => {
    if (words.some(word => sentence.toLowerCase().includes(word))) {
      themes.push(emotion);
    }
  });
  
  return themes;
}

function calculateThemeCohesion(themeDevelopment: any[]): number {
  if (themeDevelopment.length < 2) return 1;
  
  let transitions = 0;
  let themeChanges = 0;
  
  for (let i = 1; i < themeDevelopment.length; i++) {
    const prevThemes = themeDevelopment[i - 1].themes;
    const currThemes = themeDevelopment[i].themes;
    
    transitions++;
    if (JSON.stringify(prevThemes) !== JSON.stringify(currThemes)) {
      themeChanges++;
    }
  }
  
  return 1 - (themeChanges / transitions);
}

// Domain Detection
function detectDomainComprehensive(text: string): any {
  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  const scores: Record<string, {score: number, confidence: number}> = {};
  
  Object.entries(DOMAIN_LEXICONS).forEach(([domain, lexicon]) => {
    let score = 0;
    words.forEach(word => {
      if (lexicon.includes(word)) {
        score++;
      }
    });
    scores[domain] = {
      score,
      confidence: score / Math.max(words.length, 1)
    };
  });
  
  const sortedDomains = Object.entries(scores)
    .sort((a, b) => b[1].score - a[1].score);
  
  return {
    primaryDomain: sortedDomains[0]?.[0] || 'general',
    scores,
    confidence: sortedDomains[0]?.[1]?.confidence || 0
  };
}

// Topic Coherence Calculation
function calculateTopicCoherence(topics: any[], text: string): number {
  if (topics.length === 0) return 0;
  
  let totalCoherence = 0;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  topics.forEach(topic => {
    const topicWords = topic.keywords || [];
    let topicCoherence = 0;
    
    // Check if topic words appear together in sentences
    sentences.forEach(sentence => {
      const sentenceLower = sentence.toLowerCase();
      const wordsInSentence = topicWords.filter((word: string) => 
        sentenceLower.includes(word.toLowerCase())
      );
      
      if (wordsInSentence.length > 1) {
        topicCoherence += wordsInSentence.length;
      }
    });
    
    totalCoherence += topicCoherence / Math.max(sentences.length, 1);
  });
  
  return totalCoherence / topics.length;
}

// Generate Topic Summary
function generateTopicSummary(topics: any[], thematicAnalysis: any): any {
  const dominantTopics = topics.slice(0, 3);
  const dominantThemes = thematicAnalysis.dominantThemes.slice(0, 3);
  
  return {
    overview: `Analysis reveals ${topics.length} distinct topics with ${thematicAnalysis.dominantThemes.length} major themes.`,
    keyTopics: dominantTopics.map(t => t.name).join(', '),
    thematicFocus: dominantThemes.map(t => t.theme).join(', '),
    complexity: topics.length > 5 ? 'high' : topics.length > 2 ? 'medium' : 'low',
    coherence: thematicAnalysis.themeCohesion > 0.7 ? 'high' : 
               thematicAnalysis.themeCohesion > 0.4 ? 'medium' : 'low'
  };
}

// ============================================================================
// ORIGINAL FUNCTIONS (Preserved with backward compatibility)
// ============================================================================

// Original analyzeTopics function (enhanced to use comprehensive analysis)
export function analyzeTopics(text: string, keywords: string[]): {
  dominantTopics: Array<{ topic: string; weight: number; keywords: string[] }>;
  nGrams: Array<{ phrase: string; count: number }>;
} {
  // Use comprehensive analysis but return original format
  const comprehensive = analyzeTopicsComprehensive(text, keywords);
  
  return {
    dominantTopics: comprehensive.dominantTopics,
    nGrams: comprehensive.nGrams
  };
}

// Export comprehensive topic detection for worker
export function detectTopicsInText(content: string, keywords: string[] = []) {
  return analyzeTopicsComprehensive(content, keywords);
}

// Helper to integrate comprehensive analysis with existing store
export function integrateTopicAnalysisWithStore(analyticsResult: AnalyticsResult, comprehensiveTopics: any): AnalyticsResult {
  return {
    ...analyticsResult,
    topicAnalysis: {
      ...analyticsResult.topicAnalysis,
      comprehensive: comprehensiveTopics.comprehensive,
      enhancedKeywords: comprehensiveTopics.keywords,
      entityAnalysis: comprehensiveTopics.entities,
      domainAnalysis: comprehensiveTopics.domain,
      thematicAnalysis: comprehensiveTopics.thematicAnalysis,
      coherenceScore: comprehensiveTopics.coherenceScore
    }
  };
}
// ============================================================================
// REQUIREMENT #3: Productivity Tracking (Streaks, Consistency, Volume Growth)
// ============================================================================

export function calculateProductivityMetrics(
  documents: Document[],
  analytics: Map<string, AnalyticsResult>
): ProductivityMetrics {
  if (documents.length === 0) {
    return {
      dailyWordCounts: [],
      currentStreak: 0,
      longestStreak: 0,
      totalActiveDays: 0,
      averageWordsPerDay: 0,
      consistencyScore: 0,
      volumeGrowthRate: 0,
      missedDays: 0,
      lastActiveDate: null,
    };
  }

  // Group documents by date
  const dailyData = new Map<string, { wordCount: number; documentCount: number }>();
  
  documents.forEach(doc => {
    const date = new Date(doc.createdAt).toISOString().split('T')[0];
    const docAnalytics = analytics.get(doc.id);
    const wordCount = docAnalytics?.wordCount || doc.content.split(/\s+/).filter((w: string) => w.length > 0).length;
    
    const existing = dailyData.get(date) || { wordCount: 0, documentCount: 0 };
    dailyData.set(date, {
      wordCount: existing.wordCount + wordCount,
      documentCount: existing.documentCount + 1,
    });
  });

  // Convert to sorted array
  const dailyWordCounts = Array.from(dailyData.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Calculate streaks
  const { currentStreak, longestStreak, missedDays } = calculateStreaks(dailyWordCounts);

  // Calculate consistency score (0-1)
  const consistencyScore = calculateConsistencyScore(dailyWordCounts);

  // Calculate volume growth rate
  const volumeGrowthRate = calculateVolumeGrowthRate(dailyWordCounts);

  const totalWords = dailyWordCounts.reduce((sum, d) => sum + d.wordCount, 0);
  const totalActiveDays = dailyWordCounts.length;

  return {
    dailyWordCounts,
    currentStreak,
    longestStreak,
    totalActiveDays,
    averageWordsPerDay: totalActiveDays > 0 ? totalWords / totalActiveDays : 0,
    consistencyScore,
    volumeGrowthRate,
    missedDays,
    lastActiveDate: dailyWordCounts.length > 0 ? dailyWordCounts[dailyWordCounts.length - 1].date : null,
  };
}

function calculateStreaks(dailyWordCounts: Array<{ date: string; wordCount: number }>): {
  currentStreak: number;
  longestStreak: number;
  missedDays: number;
} {
  if (dailyWordCounts.length === 0) {
    return { currentStreak: 0, longestStreak: 0, missedDays: 0 };
  }

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 1;
  let missedDays = 0;

  const today = new Date().toISOString().split('T')[0];
  const sortedDates = dailyWordCounts.map(d => d.date).sort();

  // Calculate longest streak
  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1]);
    const currDate = new Date(sortedDates[i]);
    const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      missedDays += diffDays - 1;
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  // Calculate current streak (from today backwards)
  const lastDate = sortedDates[sortedDates.length - 1];
  const daysSinceLastActive = Math.floor(
    (new Date(today).getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceLastActive <= 1) {
    currentStreak = 1;
    for (let i = sortedDates.length - 2; i >= 0; i--) {
      const prevDate = new Date(sortedDates[i]);
      const currDate = new Date(sortedDates[i + 1]);
      const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  return { currentStreak, longestStreak, missedDays };
}

function calculateConsistencyScore(dailyWordCounts: Array<{ date: string; wordCount: number }>): number {
  if (dailyWordCounts.length < 2) return 1;

  const dates = dailyWordCounts.map(d => new Date(d.date).getTime()).sort((a, b) => a - b);
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  const totalDays = Math.max(1, Math.floor((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1);
  
  // Consistency = active days / total days in range
  const activeDays = dailyWordCounts.length;
  const baseConsistency = activeDays / totalDays;

  // Also consider word count variance (lower variance = more consistent)
  const avgWords = dailyWordCounts.reduce((sum, d) => sum + d.wordCount, 0) / dailyWordCounts.length;
  const variance = dailyWordCounts.reduce((sum, d) => sum + Math.pow(d.wordCount - avgWords, 2), 0) / dailyWordCounts.length;
  const coefficientOfVariation = avgWords > 0 ? Math.sqrt(variance) / avgWords : 0;
  const varianceScore = Math.max(0, 1 - coefficientOfVariation);

  return (baseConsistency * 0.6 + varianceScore * 0.4);
}

function calculateVolumeGrowthRate(dailyWordCounts: Array<{ date: string; wordCount: number }>): number {
  if (dailyWordCounts.length < 7) return 0;

  // Compare first half vs second half average
  const midpoint = Math.floor(dailyWordCounts.length / 2);
  const firstHalf = dailyWordCounts.slice(0, midpoint);
  const secondHalf = dailyWordCounts.slice(midpoint);

  const firstAvg = firstHalf.reduce((sum, d) => sum + d.wordCount, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, d) => sum + d.wordCount, 0) / secondHalf.length;

  if (firstAvg === 0) return secondAvg > 0 ? 100 : 0;
  return ((secondAvg - firstAvg) / firstAvg) * 100;
}

// ============================================================================
// REQUIREMENT #4: Advanced Sentiment Analysis (Paragraph-level, Polarity Shifts)
// ============================================================================

const POSITIVE_WORDS = [
  'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'happy', 
  'joy', 'beautiful', 'perfect', 'brilliant', 'awesome', 'delightful', 'pleasant',
  'glad', 'pleased', 'satisfied', 'thrilled', 'excited', 'grateful', 'thankful',
  'superb', 'magnificent', 'outstanding', 'remarkable', 'impressive', 'splendid'
];

const NEGATIVE_WORDS = [
  'bad', 'terrible', 'awful', 'horrible', 'hate', 'sad', 'angry', 'ugly', 'poor', 
  'worst', 'disappointing', 'frustrating', 'annoying', 'miserable', 'depressing',
  'dreadful', 'disgusting', 'appalling', 'atrocious', 'abysmal', 'pathetic',
  'irritating', 'infuriating', 'devastating', 'heartbreaking', 'tragic'
];

const INTENSIFIERS = ['very', 'extremely', 'incredibly', 'absolutely', 'totally', 'utterly', 'highly', 'really'];
const NEGATORS = ['not', 'never', 'no', "n't", 'neither', 'nor', 'nothing', 'nobody'];

export function analyzeAdvancedSentiment(text: string) {
  const { sentences, paragraphs } = tokenizeText(text);

  if (sentences.length === 0) {
    return {
      score: 0,
      polarity: 'neutral' as const,
      intensity: 0,
      sentenceLevel: [],
      paragraphLevel: [],
      polarityShifts: [],
      volatility: 0,
      moodPatterns: [],
    };
  }

  // Analyze each sentence
  const sentenceScores = sentences.map((sentence, index) => {
    const result = analyzeSentenceWithContext(sentence);
    return { sentence, ...result, position: index };
  });

  // Analyze each paragraph
  const paragraphScores = paragraphs.map(paragraph => {
    const result = analyzeParagraphSentiment(paragraph);
    return { paragraph: paragraph.substring(0, 100) + (paragraph.length > 100 ? '...' : ''), ...result };
  });

  // Detect polarity shifts
  const polarityShifts = detectPolarityShifts(sentenceScores);

  // Calculate overall metrics
  const avgScore = sentenceScores.reduce((sum, s) => sum + s.score, 0) / sentenceScores.length;
  const polarity = avgScore > 0.1 ? 'positive' : avgScore < -0.1 ? 'negative' : 'neutral';
  const intensity = Math.abs(avgScore);

  // Calculate volatility (standard deviation)
  const variance = sentenceScores.reduce((sum, s) => sum + Math.pow(s.score - avgScore, 2), 0) / sentenceScores.length;
  const volatility = Math.sqrt(variance);

  // Detect mood patterns
  const moodPatterns = detectMoodPatterns(sentenceScores);

  return {
    score: avgScore,
    polarity,
    intensity,
    sentenceLevel: sentenceScores.map(s => ({
      sentence: s.sentence,
      score: s.score,
      polarity: s.polarity,
    })),
    paragraphLevel: paragraphScores,
    polarityShifts,
    volatility,
    moodPatterns,
  };
}

function analyzeSentenceWithContext(sentence: string): { score: number; polarity: 'positive' | 'negative' | 'neutral'; intensity: number } {
  const words = sentence.toLowerCase().split(/\s+/);
  let positiveScore = 0;
  let negativeScore = 0;
  let intensityMultiplier = 1;
  let negationActive = false;

  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[^a-z]/g, '');
    
    // Check for intensifiers
    if (INTENSIFIERS.includes(word)) {
      intensityMultiplier = 1.5;
      continue;
    }

    // Check for negators
    if (NEGATORS.some(n => word.includes(n))) {
      negationActive = true;
      continue;
    }

    // Check sentiment words
    if (POSITIVE_WORDS.includes(word)) {
      if (negationActive) {
        negativeScore += intensityMultiplier;
        negationActive = false;
      } else {
        positiveScore += intensityMultiplier;
      }
    } else if (NEGATIVE_WORDS.includes(word)) {
      if (negationActive) {
        positiveScore += intensityMultiplier;
        negationActive = false;
      } else {
        negativeScore += intensityMultiplier;
      }
    }

    intensityMultiplier = 1;
  }

  const total = positiveScore + negativeScore;
  const score = total > 0 ? (positiveScore - negativeScore) / total : 0;
  const polarity = score > 0.1 ? 'positive' : score < -0.1 ? 'negative' : 'neutral';
  const intensity = Math.min(1, (positiveScore + negativeScore) / words.length * 2);

  return { score, polarity, intensity };
}

function analyzeParagraphSentiment(paragraph: string): { score: number; polarity: 'positive' | 'negative' | 'neutral'; intensity: number } {
  const sentences = paragraph.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length === 0) return { score: 0, polarity: 'neutral', intensity: 0 };

  const sentenceScores = sentences.map(s => analyzeSentenceWithContext(s));
  const avgScore = sentenceScores.reduce((sum, s) => sum + s.score, 0) / sentenceScores.length;
  const avgIntensity = sentenceScores.reduce((sum, s) => sum + s.intensity, 0) / sentenceScores.length;
  const polarity = avgScore > 0.1 ? 'positive' : avgScore < -0.1 ? 'negative' : 'neutral';

  return { score: avgScore, polarity, intensity: avgIntensity };
}

function detectPolarityShifts(sentenceScores: Array<{ score: number; polarity: string; position: number }>) {
  const shifts: Array<{ fromPolarity: string; toPolarity: string; position: number; magnitude: number }> = [];

  for (let i = 1; i < sentenceScores.length; i++) {
    const prev = sentenceScores[i - 1];
    const curr = sentenceScores[i];

    if (prev.polarity !== curr.polarity && prev.polarity !== 'neutral' && curr.polarity !== 'neutral') {
      shifts.push({
        fromPolarity: prev.polarity,
        toPolarity: curr.polarity,
        position: curr.position,
        magnitude: Math.abs(curr.score - prev.score),
      });
    }
  }

  return shifts;
}

function detectMoodPatterns(sentenceScores: Array<{ polarity: string }>): string[] {
  const patterns: string[] = [];
  let currentMood = sentenceScores[0]?.polarity;
  let moodLength = 1;

  for (let i = 1; i < sentenceScores.length; i++) {
    if (sentenceScores[i].polarity === currentMood) {
      moodLength++;
    } else {
      if (moodLength >= 3) {
        patterns.push(`${currentMood} streak (${moodLength} sentences)`);
      }
      currentMood = sentenceScores[i].polarity;
      moodLength = 1;
    }
  }

  if (moodLength >= 3) {
    patterns.push(`${currentMood} streak (${moodLength} sentences)`);
  }

  // Detect alternating pattern
  let alternating = 0;
  for (let i = 2; i < sentenceScores.length; i++) {
    if (sentenceScores[i].polarity === sentenceScores[i - 2].polarity &&
        sentenceScores[i].polarity !== sentenceScores[i - 1].polarity) {
      alternating++;
    }
  }
  if (alternating >= 3) {
    patterns.push(`Alternating mood pattern detected`);
  }

  return patterns;
}

// ============================================================================
// REQUIREMENT #9: Topic Extraction & Drift Detection
// ============================================================================


function clusterIntoTopics(
  nounFrequency: Map<string, number>,
  keywords: string[]
): Array<{ topic: string; weight: number; keywords: string[] }> {
  const sortedNouns = Array.from(nounFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  const totalFreq = sortedNouns.reduce((sum, [, freq]) => sum + freq, 0) || 1;

  // Group similar words into topics
  const topics: Array<{ topic: string; weight: number; keywords: string[] }> = [];
  const used = new Set<string>();

  sortedNouns.forEach(([noun, freq]) => {
    if (used.has(noun)) return;

    const relatedWords = sortedNouns
      .filter(([n]) => !used.has(n) && (n.includes(noun) || noun.includes(n) || areSimilar(n, noun)))
      .map(([n]) => n);

    relatedWords.forEach(w => used.add(w));
    used.add(noun);

    const topicKeywords = [noun, ...relatedWords.slice(0, 4)];
    const weight = freq / totalFreq;

    topics.push({
      topic: noun.charAt(0).toUpperCase() + noun.slice(1),
      weight,
      keywords: topicKeywords,
    });
  });

  return topics.slice(0, 5);
}

function areSimilar(word1: string, word2: string): boolean {
  if (word1.length < 4 || word2.length < 4) return false;
  const minLen = Math.min(word1.length, word2.length);
  const commonPrefix = word1.substring(0, Math.floor(minLen * 0.6));
  return word2.startsWith(commonPrefix);
}

function extractNGramsAdvanced(words: string[], n: number, topN: number): Array<{ phrase: string; count: number }> {
  if (words.length < n) return [];

  const nGrams = new Map<string, number>();
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);

  for (let i = 0; i <= words.length - n; i++) {
    const phrase = words.slice(i, i + n).map(w => w.toLowerCase()).join(' ');
    const phraseWords = phrase.split(' ');
    
    // Skip if starts or ends with stop word
    if (stopWords.has(phraseWords[0]) || stopWords.has(phraseWords[phraseWords.length - 1])) continue;
    
    nGrams.set(phrase, (nGrams.get(phrase) || 0) + 1);
  }

  return Array.from(nGrams.entries())
    .filter(([, count]) => count > 1)
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

export function detectTopicDrift(
  documents: Document[],
  analytics: Map<string, AnalyticsResult>
): TopicAnalysis {
  const sortedDocs = [...documents].sort((a, b) => a.createdAt - b.createdAt);
  
  const topicDrift: Array<{ date: string; topics: Array<{ topic: string; weight: number }> }> = [];
  const thematicShifts: Array<{ fromTopic: string; toTopic: string; date: string; magnitude: number }> = [];

  let prevDominantTopic = '';

  sortedDocs.forEach(doc => {
    const docAnalytics = analytics.get(doc.id);
    if (!docAnalytics?.topicAnalysis?.dominantTopics) return;

    const date = new Date(doc.createdAt).toISOString().split('T')[0];
    const topics = docAnalytics.topicAnalysis.dominantTopics.map((t: { topic: string; weight: number; keywords: string[] }) => ({
      topic: t.topic,
      weight: t.weight,
    }));

    topicDrift.push({ date, topics });

    const currentDominant = topics[0]?.topic || '';
    if (prevDominantTopic && currentDominant && prevDominantTopic !== currentDominant) {
      thematicShifts.push({
        fromTopic: prevDominantTopic,
        toTopic: currentDominant,
        date,
        magnitude: Math.abs((topics[0]?.weight || 0) - 0.5),
      });
    }
    prevDominantTopic = currentDominant;
  });

  // Aggregate all topics
  const allTopics = new Map<string, { weight: number; keywords: string[] }>();
  sortedDocs.forEach(doc => {
    const docAnalytics = analytics.get(doc.id);
    const topics = docAnalytics?.topicAnalysis?.dominantTopics || [];
    topics.forEach((t) => {
      const existing = allTopics.get(t.topic) || { weight: 0, keywords: [] as string[] };
      allTopics.set(t.topic, {
        weight: existing.weight + t.weight,
        keywords: [...new Set([...existing.keywords, ...t.keywords])],
      });
    });
  });

  const dominantTopics = Array.from(allTopics.entries())
    .map(([topic, data]: [string, { weight: number; keywords: string[] }]) => ({ topic, ...data }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);

  return { dominantTopics, topicDrift, thematicShifts };
}

// ============================================================================
// REQUIREMENT #10: Filler Detection & Deliberate vs Accidental Repetition
// ============================================================================

const FILLER_WORDS = [
  'um', 'uh', 'like', 'you know', 'basically', 'actually', 'literally', 'honestly',
  'really', 'very', 'just', 'so', 'well', 'anyway', 'obviously', 'definitely',
  'totally', 'absolutely', 'kind of', 'sort of', 'i mean', 'right'
];

export function analyzeRepetition(text: string): {
  repeatedPhrases: Array<{ phrase: string; count: number; isDeliberate: boolean; context: string }>;
  fillerWords: Array<{ word: string; count: number; density: number }>;
  structuralRedundancy: number;
  overusedWords: Array<{ word: string; count: number; expectedCount: number }>;
} {
  const { words, sentences } = tokenizeText(text);
  const totalWords = words.length || 1;

  // Detect filler words
  const fillerCounts = new Map<string, number>();
  const textLower = text.toLowerCase();
  
  FILLER_WORDS.forEach(filler => {
    const regex = new RegExp(`\\b${filler}\\b`, 'gi');
    const matches = textLower.match(regex);
    if (matches && matches.length > 0) {
      fillerCounts.set(filler, matches.length);
    }
  });

  const fillerWords = Array.from(fillerCounts.entries())
    .map(([word, count]) => ({
      word,
      count,
      density: count / totalWords,
    }))
    .sort((a, b) => b.count - a.count);

  // Detect repeated phrases with deliberate vs accidental classification
  const repeatedPhrases = detectRepeatedPhrasesWithContext(words, sentences);

  // Calculate structural redundancy
  const structuralRedundancy = calculateStructuralRedundancy(sentences);

  // Find overused words
  const overusedWords = findOverusedWords(words);

  return {
    repeatedPhrases,
    fillerWords,
    structuralRedundancy,
    overusedWords,
  };
}

function detectRepeatedPhrasesWithContext(
  words: string[],
  sentences: string[]
): Array<{ phrase: string; count: number; isDeliberate: boolean; context: string }> {
  const phrases = new Map<string, { count: number; positions: number[] }>();

  // Check 3-word and 4-word phrases
  for (let len = 3; len <= 4; len++) {
    for (let i = 0; i <= words.length - len; i++) {
      const phrase = words.slice(i, i + len).join(' ').toLowerCase();
      const existing = phrases.get(phrase) || { count: 0, positions: [] };
      existing.count++;
      existing.positions.push(i);
      phrases.set(phrase, existing);
    }
  }

  return Array.from(phrases.entries())
    .filter(([, data]) => data.count >= 2)
    .map(([phrase, data]) => {
      // Heuristics for deliberate repetition:
      // 1. Rhetorical phrases often at sentence beginnings
      // 2. Emphasis phrases (2-3 occurrences often deliberate)
      // 3. Near-together repetitions are more likely deliberate
      
      const positionSpread = data.positions.length > 1
        ? data.positions[data.positions.length - 1] - data.positions[0]
        : 0;
      const avgDistance = positionSpread / (data.count - 1 || 1);
      
      const isDeliberate = (
        data.count === 2 || 
        data.count === 3 ||
        avgDistance < 50 || // Close together
        phrase.includes('and') || // Likely rhetorical
        /^(i |we |the |this |that |it )/.test(phrase) // Sentence starters
      );

      return {
        phrase,
        count: data.count,
        isDeliberate,
        context: `Found at positions: ${data.positions.slice(0, 3).join(', ')}${data.positions.length > 3 ? '...' : ''}`,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

function calculateStructuralRedundancy(sentences: string[]): number {
  if (sentences.length < 3) return 0;

  // Check for similar sentence structures
  const structures = sentences.map(s => {
    const words = s.split(/\s+/);
    return words.slice(0, 3).join(' ').toLowerCase();
  });

  const structureCounts = new Map<string, number>();
  structures.forEach(s => {
    structureCounts.set(s, (structureCounts.get(s) || 0) + 1);
  });

  const repeatedStructures = Array.from(structureCounts.values()).filter(c => c > 1).length;
  return repeatedStructures / structures.length;
}

function findOverusedWords(words: string[]): Array<{ word: string; count: number; expectedCount: number }> {
  const wordFreq = new Map<string, number>();
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'our', 'their']);

  words.forEach(word => {
    const normalized = word.toLowerCase().replace(/[^a-z]/g, '');
    if (normalized.length > 2 && !stopWords.has(normalized)) {
      wordFreq.set(normalized, (wordFreq.get(normalized) || 0) + 1);
    }
  });

  const totalContentWords = Array.from(wordFreq.values()).reduce((sum, c) => sum + c, 0);
  const uniqueWords = wordFreq.size;
  const expectedFreq = totalContentWords / uniqueWords;

  return Array.from(wordFreq.entries())
    .filter(([, count]) => count > expectedFreq * 2 && count >= 5)
    .map(([word, count]) => ({
      word,
      count,
      expectedCount: Math.round(expectedFreq),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

// ============================================================================
// REQUIREMENT #8: Stylistic Fingerprint
// ============================================================================

export function computeStylisticFingerprint(text: string): StylisticFingerprint {
  const { words, sentences } = tokenizeText(text);

  // Rhythm patterns (sentence lengths)
  const rhythmPatterns = sentences.map(s => {
    const sentenceWords = s.split(/\s+/).filter(w => w.length > 0);
    return sentenceWords.length;
  });

  // Sentence cadence
  const shortCount = rhythmPatterns.filter(l => l <= 10).length;
  const mediumCount = rhythmPatterns.filter(l => l > 10 && l <= 25).length;
  const longCount = rhythmPatterns.filter(l => l > 25).length;
  const total = rhythmPatterns.length || 1;

  const avgLength = rhythmPatterns.reduce((sum, l) => sum + l, 0) / total;
  const variance = rhythmPatterns.reduce((sum, l) => sum + Math.pow(l - avgLength, 2), 0) / total;
  const variationScore = Math.sqrt(variance) / (avgLength || 1);

  // Function word profile
  const functionWords = ['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'and', 'or', 'but', 'if', 'he', 'she', 'it', 'they', 'we', 'i', 'you'];
  const functionWordProfile: Record<string, number> = {};
  const wordCount = words.length || 1;

  functionWords.forEach(fw => {
    const count = words.filter(w => w.toLowerCase() === fw).length;
    functionWordProfile[fw] = count / wordCount;
  });

  // Punctuation profile
  const punctuationProfile: Record<string, number> = {};
  const punctuationMarks = ['.', ',', ';', ':', '!', '?', '-', '"', "'"];
  
  punctuationMarks.forEach(p => {
    const count = (text.match(new RegExp(`\\${p}`, 'g')) || []).length;
    punctuationProfile[p] = count / wordCount;
  });

  // Phrasing tendencies (common starting phrases)
  const phrasingTendencies: Array<{ pattern: string; frequency: number }> = [];
  const startingPhrases = new Map<string, number>();

  sentences.forEach(s => {
    const startWords = s.split(/\s+/).slice(0, 2).join(' ').toLowerCase();
    if (startWords.length > 3) {
      startingPhrases.set(startWords, (startingPhrases.get(startWords) || 0) + 1);
    }
  });

  Array.from(startingPhrases.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([pattern, count]) => {
      phrasingTendencies.push({ pattern, frequency: count / total });
    });

  return {
    rhythmPatterns,
    sentenceCadence: {
      shortSentenceRatio: shortCount / total,
      mediumSentenceRatio: mediumCount / total,
      longSentenceRatio: longCount / total,
      variationScore,
    },
    functionWordProfile,
    punctuationProfile,
    phrasingTendencies,
  };
}

// ============================================================================
// REQUIREMENT #13: Stylistic Evolution Tracking
// ============================================================================

export function trackStylisticEvolution(
  documents: Document[],
  analytics: Map<string, AnalyticsResult>
): StylisticEvolution {
  const sortedDocs = [...documents].sort((a, b) => a.createdAt - b.createdAt);

  const toneEvolution: Array<{ date: string; score: number; polarity: string }> = [];
  const complexityEvolution: Array<{ date: string; avgSentenceLength: number; clauseDepth: number; readability: number }> = [];
  const vocabularyEvolution: Array<{ date: string; ttr: number; uniqueWords: number; rareWordUsage: number }> = [];
  const pacingEvolution: Array<{ date: string; rhythmVariation: number; sentenceLengthStdDev: number }> = [];

  sortedDocs.forEach(doc => {
    const docAnalytics = analytics.get(doc.id);
    if (!docAnalytics) return;

    const date = new Date(doc.createdAt).toISOString().split('T')[0];

    // Tone evolution
    toneEvolution.push({
      date,
      score: docAnalytics.sentiment.score,
      polarity: docAnalytics.sentiment.polarity,
    });

    // Complexity evolution
    complexityEvolution.push({
      date,
      avgSentenceLength: docAnalytics.styleMetrics.avgSentenceLength,
      clauseDepth: docAnalytics.styleMetrics.clauseDepth || 1,
      readability: docAnalytics.readability.fleschReadingEase,
    });

    // Vocabulary evolution
    vocabularyEvolution.push({
      date,
      ttr: docAnalytics.lexicalRichness.typeTokenRatio,
      uniqueWords: docAnalytics.lexicalRichness.hapaxLegomena,
      rareWordUsage: docAnalytics.lexicalRichness.rareWordUsage || 0,
    });

    // Pacing evolution
    const rhythmPatterns = docAnalytics.styleMetrics.rhythmPatterns || [];
    const avgRhythm = rhythmPatterns.length > 0
      ? rhythmPatterns.reduce((sum: number, r: number) => sum + r, 0) / rhythmPatterns.length
      : docAnalytics.styleMetrics.avgSentenceLength;
    const rhythmVariance = rhythmPatterns.length > 0
      ? rhythmPatterns.reduce((sum: number, r: number) => sum + Math.pow(r - avgRhythm, 2), 0) / rhythmPatterns.length
      : 0;

    pacingEvolution.push({
      date,
      rhythmVariation: Math.sqrt(rhythmVariance),
      sentenceLengthStdDev: docAnalytics.styleMetrics.syntacticVariation || Math.sqrt(rhythmVariance),
    });
  });

  // Calculate sentiment stability
  const sentimentScores = toneEvolution.map(t => t.score);
  const avgSentiment = sentimentScores.reduce((sum, s) => sum + s, 0) / (sentimentScores.length || 1);
  const sentimentVariance = sentimentScores.reduce((sum, s) => sum + Math.pow(s - avgSentiment, 2), 0) / (sentimentScores.length || 1);
  const sentimentStability = 1 - Math.min(1, Math.sqrt(sentimentVariance));

  // Calculate thematic focus shift (based on vocabulary changes)
  let thematicFocusShift = 0;
  if (vocabularyEvolution.length > 1) {
    const firstHalf = vocabularyEvolution.slice(0, Math.floor(vocabularyEvolution.length / 2));
    const secondHalf = vocabularyEvolution.slice(Math.floor(vocabularyEvolution.length / 2));
    const firstAvgTTR = firstHalf.reduce((sum, v) => sum + v.ttr, 0) / firstHalf.length;
    const secondAvgTTR = secondHalf.reduce((sum, v) => sum + v.ttr, 0) / secondHalf.length;
    thematicFocusShift = Math.abs(secondAvgTTR - firstAvgTTR);
  }

  return {
    toneEvolution,
    complexityEvolution,
    vocabularyEvolution,
    pacingEvolution,
    sentimentStability,
    thematicFocusShift,
  };
}

// ============================================================================
// REQUIREMENT #6: Enhanced Readability with Edge Cases
// ============================================================================

export function calculateEnhancedReadability(text: string) {
  const { words, sentences } = tokenizeText(text);

  if (sentences.length === 0 || words.length === 0) {
    return {
      fleschReadingEase: 0,
      fleschKincaidGrade: 0,
      gunningFog: 0,
      smogIndex: 0,
      sentenceComplexity: 0,
      fragmentCount: 0,
      technicalTermDensity: 0,
    };
  }

  // Count syllables with abbreviation handling
  const totalSyllables = words.reduce((sum, word) => sum + countSyllablesAdvanced(word), 0);
  const avgSyllablesPerWord = totalSyllables / words.length;
  const avgWordsPerSentence = words.length / sentences.length;

  // Flesch Reading Ease
  const fleschReadingEase = Math.max(0, Math.min(100, 
    206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord
  ));

  // Flesch-Kincaid Grade Level
  const fleschKincaidGrade = Math.max(0,
    0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59
  );

  // Gunning Fog Index
  const complexWords = words.filter(word => countSyllablesAdvanced(word) >= 3).length;
  const percentComplexWords = (complexWords / words.length) * 100;
  const gunningFog = Math.max(0, 0.4 * (avgWordsPerSentence + percentComplexWords));

  // SMOG Index
  const polysyllableCount = words.filter(word => countSyllablesAdvanced(word) >= 3).length;
  const smogIndex = Math.max(0, 1.0430 * Math.sqrt(polysyllableCount * (30 / sentences.length)) + 3.1291);

  // Sentence complexity (average clause depth estimate)
  const sentenceComplexity = calculateSentenceComplexity(sentences);

  // Fragment detection
  const fragmentCount = detectFragments(sentences);

  // Technical term density
  const technicalTermDensity = calculateTechnicalTermDensity(words);

  return {
    fleschReadingEase,
    fleschKincaidGrade,
    gunningFog,
    smogIndex,
    sentenceComplexity,
    fragmentCount,
    technicalTermDensity,
  };
}

// Common abbreviations that should be treated specially
const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'vs', 'etc', 'inc', 'ltd', 'corp',
  'usa', 'uk', 'eu', 'un', 'nato', 'nasa', 'fbi', 'cia', 'dna', 'html', 'css', 'api'
]);

function countSyllablesAdvanced(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  
  if (word.length === 0) return 0;
  if (word.length <= 3) return 1;
  
  // Handle abbreviations
  if (ABBREVIATIONS.has(word)) {
    return word.length; // Each letter is a syllable for abbreviations
  }

  const vowels = 'aeiouy';
  let count = 0;
  let previousWasVowel = false;

  for (let i = 0; i < word.length; i++) {
    const isVowel = vowels.includes(word[i]);
    if (isVowel && !previousWasVowel) {
      count++;
    }
    previousWasVowel = isVowel;
  }

  // Adjust for silent 'e'
  if (word.endsWith('e') && !word.endsWith('le')) {
    count--;
  }

  // Handle special endings
  if (word.endsWith('le') && word.length > 2 && !vowels.includes(word[word.length - 3])) {
    count++;
  }

  return Math.max(1, count);
}

function calculateSentenceComplexity(sentences: string[]): number {
  const subordinators = ['because', 'although', 'while', 'since', 'if', 'when', 'where', 'that', 'which', 'who', 'whom', 'whose', 'whereas', 'unless', 'until', 'after', 'before'];
  
  let totalComplexity = 0;

  sentences.forEach(sentence => {
    const sentenceLower = sentence.toLowerCase();
    let complexity = 1;
    
    subordinators.forEach(sub => {
      const regex = new RegExp(`\\b${sub}\\b`, 'g');
      const matches = sentenceLower.match(regex);
      if (matches) {
        complexity += matches.length * 0.5;
      }
    });

    // Count commas as complexity indicator
    const commas = (sentence.match(/,/g) || []).length;
    complexity += commas * 0.2;

    totalComplexity += complexity;
  });

  return totalComplexity / (sentences.length || 1);
}

function detectFragments(sentences: string[]): number {
  let fragmentCount = 0;

  sentences.forEach(sentence => {
    const words = sentence.split(/\s+/).filter(w => w.length > 0);
    
    // Heuristics for fragments:
    // 1. Very short sentences (< 4 words) without a verb
    // 2. Starting with subordinating conjunction without main clause
    
    if (words.length < 4) {
      const doc = compromise(sentence);
      const verbs = doc.verbs().length;
      if (verbs === 0) {
        fragmentCount++;
      }
    }
  });

  return fragmentCount;
}

function calculateTechnicalTermDensity(words: string[]): number {
  const technicalPatterns = [
    /^[a-z]+tion$/i,  // -tion words
    /^[a-z]+ism$/i,   // -ism words
    /^[a-z]+ology$/i, // -ology words
    /^[a-z]+ization$/i, // -ization words
    /^[a-z]{10,}$/i,  // Very long words
  ];

  let technicalCount = 0;

  words.forEach(word => {
    if (technicalPatterns.some(pattern => pattern.test(word))) {
      technicalCount++;
    }
  });

  return technicalCount / (words.length || 1);
}

// ============================================================================
// REQUIREMENT #7: Advanced Sentence Structure Analysis
// ============================================================================

export function analyzeAdvancedSentenceStructure(text: string) {
  const { sentences, words } = tokenizeText(text);

  if (sentences.length === 0) {
    return {
      clauseDepth: 0,
      coordinationFrequency: 0,
      syntacticVariation: 0,
      sentenceLengthDistribution: { short: 0, medium: 0, long: 0 },
    };
  }

  // Calculate clause depth
  const subordinators = ['because', 'although', 'while', 'since', 'if', 'when', 'where', 'that', 'which', 'who'];
  let totalClauseDepth = 0;

  sentences.forEach(sentence => {
    const sentenceLower = sentence.toLowerCase();
    let depth = 1;
    subordinators.forEach(sub => {
      const regex = new RegExp(`\\b${sub}\\b`, 'g');
      const matches = sentenceLower.match(regex);
      if (matches) depth += matches.length;
    });
    totalClauseDepth += depth;
  });

  const clauseDepth = totalClauseDepth / sentences.length;

  // Calculate coordination frequency
  const coordinators = ['and', 'or', 'but', 'nor', 'yet', 'so'];
  let coordinationCount = 0;
  const textLower = text.toLowerCase();
  
  coordinators.forEach(coord => {
    const regex = new RegExp(`\\b${coord}\\b`, 'g');
    const matches = textLower.match(regex);
    if (matches) coordinationCount += matches.length;
  });

  const coordinationFrequency = coordinationCount / sentences.length;

  // Calculate syntactic variation
  const sentenceLengths = sentences.map(s => s.split(/\s+/).filter(w => w.length > 0).length);
  const avgLength = sentenceLengths.reduce((sum, len) => sum + len, 0) / sentenceLengths.length;
  const variance = sentenceLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / sentenceLengths.length;
  const syntacticVariation = Math.sqrt(variance);

  // Sentence length distribution
  const shortCount = sentenceLengths.filter(l => l <= 10).length;
  const mediumCount = sentenceLengths.filter(l => l > 10 && l <= 25).length;
  const longCount = sentenceLengths.filter(l => l > 25).length;

  return {
    clauseDepth,
    coordinationFrequency,
    syntacticVariation,
    sentenceLengthDistribution: {
      short: shortCount / sentences.length,
      medium: mediumCount / sentences.length,
      long: longCount / sentences.length,
    },
  };
}

// ============================================================================
// REQUIREMENT #11: Grammar Pattern Tracking
// ============================================================================

export function analyzeGrammarPatternsComprehensive(text: string) {
  const doc = compromise(text);
  const { words } = tokenizeText(text);

  if (words.length === 0) {
    return {
      tenseConsistency: 0,
      pronounUsage: {},
      verbFormDistribution: {},
      modifierDensity: 0,
    };
  }

  // Tense analysis
  const verbs = doc.verbs();
  const pastTense = verbs.toPastTense().length;
  const presentTense = verbs.toPresentTense().length;
  const futureTense = doc.match('will #Verb').length + doc.match('going to #Verb').length;
  const totalVerbs = pastTense + presentTense + futureTense || 1;

  const maxTense = Math.max(pastTense, presentTense, futureTense);
  const tenseConsistency = maxTense / totalVerbs;

  // Pronoun usage
  const pronouns = doc.pronouns().out('array') as string[];
  const pronounUsage: Record<string, number> = {};
  pronouns.forEach(pronoun => {
    const normalized = pronoun.toLowerCase();
    pronounUsage[normalized] = (pronounUsage[normalized] || 0) + 1;
  });

  // Verb form distribution
  const verbFormDistribution: Record<string, number> = {
    past: pastTense,
    present: presentTense,
    future: futureTense,
    infinitive: doc.match('to #Verb').length,
    gerund: doc.match('#Gerund').length,
  };

  // Modifier density
  const adjectives = doc.adjectives().length;
  const adverbs = doc.adverbs().length;
  const modifierDensity = (adjectives + adverbs) / words.length;

  return {
    tenseConsistency,
    pronounUsage,
    verbFormDistribution,
    modifierDensity,
  };
}

// ============================================================================
// REQUIREMENT #23: Uncertainty Indicators
// ============================================================================

export function calculateUncertaintyIndicators(
  text: string,
  analytics: Partial<AnalyticsResult>
): {
  sentimentConfidence: number;
  readabilityConfidence: number;
  topicConfidence: number;
  overallReliability: number;
  warnings: string[];
} {
  const { words, sentences } = tokenizeText(text);
  const warnings: string[] = [];

  // Base confidence on text length
  let sentimentConfidence = Math.min(1, words.length / 100);
  let readabilityConfidence = Math.min(1, sentences.length / 5);
  let topicConfidence = Math.min(1, words.length / 200);

  // Warnings for short text
  if (words.length < 50) {
    warnings.push('Text is very short - metrics may be unreliable');
    sentimentConfidence *= 0.5;
  }

  if (sentences.length < 3) {
    warnings.push('Few sentences - readability metrics may be inaccurate');
    readabilityConfidence *= 0.5;
  }

  // Check for mixed signals
  if (analytics.sentiment?.volatility && analytics.sentiment.volatility > 0.5) {
    warnings.push('High sentiment volatility detected - overall sentiment score may not represent the text well');
    sentimentConfidence *= 0.8;
  }

  // Check for extreme values
  if (analytics.readability?.fleschReadingEase && 
      (analytics.readability.fleschReadingEase < 10 || analytics.readability.fleschReadingEase > 90)) {
    warnings.push('Extreme readability score - verify text structure');
    readabilityConfidence *= 0.8;
  }

  // Overall reliability
  const overallReliability = (sentimentConfidence + readabilityConfidence + topicConfidence) / 3;

  return {
    sentimentConfidence: Math.round(sentimentConfidence * 100) / 100,
    readabilityConfidence: Math.round(readabilityConfidence * 100) / 100,
    topicConfidence: Math.round(topicConfidence * 100) / 100,
    overallReliability: Math.round(overallReliability * 100) / 100,
    warnings,
  };
}

// ============================================================================
// REQUIREMENT #12: Document Comparison with Normalization
// ============================================================================

export function compareDocumentsAdvanced(
  doc1: Document,
  doc2: Document,
  analytics1: AnalyticsResult,
  analytics2: AnalyticsResult
) {
  // Normalize metrics by word count for fair comparison
  const norm1WordCount = analytics1.wordCount || 1;
  const norm2WordCount = analytics2.wordCount || 1;

  const doc1Normalized = {
    sentimentPerWord: analytics1.sentiment.score,
    complexityPerSentence: analytics1.styleMetrics.avgSentenceLength,
    vocabularyDensity: analytics1.lexicalRichness.typeTokenRatio,
  };

  const doc2Normalized = {
    sentimentPerWord: analytics2.sentiment.score,
    complexityPerSentence: analytics2.styleMetrics.avgSentenceLength,
    vocabularyDensity: analytics2.lexicalRichness.typeTokenRatio,
  };

  // Stylistic signature comparison
  const fp1 = analytics1.stylisticFingerprint;
  const fp2 = analytics2.stylisticFingerprint;

  let stylisticSignatureComparison = undefined;
  if (fp1 && fp2) {
    const rhythmSimilarity = calculateArraySimilarity(
      fp1.rhythmPatterns.slice(0, 10),
      fp2.rhythmPatterns.slice(0, 10)
    );

    const functionWordSimilarity = calculateObjectSimilarity(
      fp1.functionWordProfile,
      fp2.functionWordProfile
    );

    const punctuationSimilarity = calculateObjectSimilarity(
      fp1.punctuationProfile,
      fp2.punctuationProfile
    );

    const overallSimilarity = (rhythmSimilarity + functionWordSimilarity + punctuationSimilarity) / 3;

    stylisticSignatureComparison = {
      rhythmSimilarity,
      functionWordSimilarity,
      punctuationSimilarity,
      overallSimilarity,
    };
  }

  // Sentiment distribution comparison
  const sent1 = analytics1.sentiment.sentenceLevel || [];
  const sent2 = analytics2.sentiment.sentenceLevel || [];

  const doc1Distribution = {
    positive: sent1.filter((s: { polarity: string }) => s.polarity === 'positive').length / (sent1.length || 1),
    neutral: sent1.filter((s: { polarity: string }) => s.polarity === 'neutral').length / (sent1.length || 1),
    negative: sent1.filter((s: { polarity: string }) => s.polarity === 'negative').length / (sent1.length || 1),
  };

  const doc2Distribution = {
    positive: sent2.filter((s: { polarity: string }) => s.polarity === 'positive').length / (sent2.length || 1),
    neutral: sent2.filter((s: { polarity: string }) => s.polarity === 'neutral').length / (sent2.length || 1),
    negative: sent2.filter((s: { polarity: string }) => s.polarity === 'negative').length / (sent2.length || 1),
  };

  return {
    doc1Id: doc1.id,
    doc2Id: doc2.id,
    toneDifference: Math.abs(analytics1.sentiment.score - analytics2.sentiment.score),
    vocabularyDifference: Math.abs(analytics1.lexicalRichness.typeTokenRatio - analytics2.lexicalRichness.typeTokenRatio),
    readabilityDifference: Math.abs(analytics1.readability.fleschReadingEase - analytics2.readability.fleschReadingEase),
    complexityDifference: Math.abs(analytics1.styleMetrics.avgSentenceLength - analytics2.styleMetrics.avgSentenceLength),
    sentimentDifference: Math.abs(analytics1.sentiment.intensity - analytics2.sentiment.intensity),
    normalizedMetrics: {
      doc1Normalized,
      doc2Normalized,
    },
    stylisticSignatureComparison,
    sentimentDistributionComparison: {
      doc1Distribution,
      doc2Distribution,
    },
    timestamp: Date.now(),
  };
}

function calculateArraySimilarity(arr1: number[], arr2: number[]): number {
  if (arr1.length === 0 || arr2.length === 0) return 0;

  const minLen = Math.min(arr1.length, arr2.length);
  let sumDiff = 0;
  let maxVal = 1;

  for (let i = 0; i < minLen; i++) {
    sumDiff += Math.abs(arr1[i] - arr2[i]);
    maxVal = Math.max(maxVal, arr1[i], arr2[i]);
  }

  return 1 - (sumDiff / (minLen * maxVal));
}

function calculateObjectSimilarity(obj1: Record<string, number>, obj2: Record<string, number>): number {
  const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
  if (allKeys.size === 0) return 1;

  let sumDiff = 0;
  allKeys.forEach(key => {
    const val1 = obj1[key] || 0;
    const val2 = obj2[key] || 0;
    sumDiff += Math.abs(val1 - val2);
  });

  return Math.max(0, 1 - sumDiff / allKeys.size);
}

// ============================================================================
// Helper: Get Length Band (Requirement #16)
// ============================================================================

export function getLengthBand(wordCount: number): 'micro' | 'short' | 'medium' | 'long' | 'extended' {
  if (wordCount < 100) return 'micro';
  if (wordCount < 500) return 'short';
  if (wordCount < 2000) return 'medium';
  if (wordCount < 5000) return 'long';
  return 'extended';
}
