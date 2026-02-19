import compromise from 'compromise';
import { tokenizeText } from './textAnalysis';

// Sentiment analysis at sentence level with volatility tracking
export function analyzeSentimentDetailed(text: string) {
  const { sentences } = tokenizeText(text);
  
  if (sentences.length === 0) {
    return {
      score: 0,
      polarity: 'neutral' as const,
      intensity: 0,
      sentenceLevel: [],
      volatility: 0,
      moodPatterns: [],
    };
  }

  const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'happy', 'joy', 'beautiful', 'perfect', 'brilliant', 'awesome', 'delightful'];
  const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'hate', 'sad', 'angry', 'ugly', 'poor', 'worst', 'disappointing', 'frustrating', 'annoying'];

  const sentenceScores = sentences.map(sentence => {
    const sentenceLower = sentence.toLowerCase();
    let positiveCount = 0;
    let negativeCount = 0;

    positiveWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = sentenceLower.match(regex);
      if (matches) positiveCount += matches.length;
    });

    negativeWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = sentenceLower.match(regex);
      if (matches) negativeCount += matches.length;
    });

    const totalWords = positiveCount + negativeCount;
    const score = totalWords > 0 ? (positiveCount - negativeCount) / totalWords : 0;
    const polarity = score > 0.1 ? 'positive' : score < -0.1 ? 'negative' : 'neutral';

    return { sentence, score, polarity: polarity as 'positive' | 'negative' | 'neutral' };
  });

  const avgScore = sentenceScores.reduce((sum, s) => sum + s.score, 0) / sentenceScores.length;
  const polarity = avgScore > 0.1 ? 'positive' : avgScore < -0.1 ? 'negative' : 'neutral';
  const intensity = Math.abs(avgScore);

  // Calculate volatility (standard deviation of sentence scores)
  const variance = sentenceScores.reduce((sum, s) => sum + Math.pow(s.score - avgScore, 2), 0) / sentenceScores.length;
  const volatility = Math.sqrt(variance);

  // Detect mood patterns (sequences of similar sentiment)
  const moodPatterns: string[] = [];
  let currentMood = sentenceScores[0]?.polarity;
  let moodLength = 1;

  for (let i = 1; i < sentenceScores.length; i++) {
    if (sentenceScores[i].polarity === currentMood) {
      moodLength++;
    } else {
      if (moodLength >= 3) {
        moodPatterns.push(`${currentMood} streak (${moodLength} sentences)`);
      }
      currentMood = sentenceScores[i].polarity;
      moodLength = 1;
    }
  }

  if (moodLength >= 3) {
    moodPatterns.push(`${currentMood} streak (${moodLength} sentences)`);
  }

  return {
    score: avgScore,
    polarity,
    intensity,
    sentenceLevel: sentenceScores,
    volatility,
    moodPatterns,
  };
}

// Moving Average Type-Token Ratio
export function calculateMovingAverageTTR(text: string, windowSize: number = 100): number {
  const { words } = tokenizeText(text);
  
  if (words.length < windowSize) {
    const uniqueWords = new Set(words.map(w => w.toLowerCase())).size;
    return words.length > 0 ? uniqueWords / words.length : 0;
  }

  let totalTTR = 0;
  let windowCount = 0;

  for (let i = 0; i <= words.length - windowSize; i += Math.floor(windowSize / 2)) {
    const window = words.slice(i, i + windowSize);
    const uniqueWords = new Set(window.map(w => w.toLowerCase())).size;
    totalTTR += uniqueWords / windowSize;
    windowCount++;
  }

  return windowCount > 0 ? totalTTR / windowCount : 0;
}

// Repetition rate and rare word usage
export function calculateAdvancedLexicalMetrics(text: string) {
  const { words } = tokenizeText(text);
  
  if (words.length === 0) {
    return {
      repetitionRate: 0,
      rareWordUsage: 0,
    };
  }

  const wordFrequency = new Map<string, number>();
  words.forEach(word => {
    const normalized = word.toLowerCase();
    wordFrequency.set(normalized, (wordFrequency.get(normalized) || 0) + 1);
  });

  // Repetition rate: percentage of words that appear more than once
  const repeatedWords = Array.from(wordFrequency.values()).filter(count => count > 1).length;
  const repetitionRate = repeatedWords / wordFrequency.size;

  // Rare word usage: percentage of words that appear only once or twice
  const rareWords = Array.from(wordFrequency.values()).filter(count => count <= 2).length;
  const rareWordUsage = rareWords / wordFrequency.size;

  return {
    repetitionRate,
    rareWordUsage,
  };
}

// Clause depth and coordination analysis
export function analyzeAdvancedSyntax(text: string) {
  const doc = compromise(text);
  const { sentences } = tokenizeText(text);
  
  if (sentences.length === 0) {
    return {
      clauseDepth: 0,
      coordinationFrequency: 0,
      syntacticVariation: 0,
    };
  }

  // Estimate clause depth by counting subordinating conjunctions and relative pronouns
  const subordinators = ['because', 'although', 'while', 'since', 'if', 'when', 'where', 'that', 'which', 'who'];
  let totalClauseDepth = 0;

  sentences.forEach(sentence => {
    const sentenceLower = sentence.toLowerCase();
    let depth = 1; // Base clause
    subordinators.forEach(sub => {
      const regex = new RegExp(`\\b${sub}\\b`, 'g');
      const matches = sentenceLower.match(regex);
      if (matches) depth += matches.length;
    });
    totalClauseDepth += depth;
  });

  const avgClauseDepth = totalClauseDepth / sentences.length;

  // Coordination frequency (and, or, but)
  const coordinators = ['and', 'or', 'but'];
  let coordinationCount = 0;
  const textLower = text.toLowerCase();
  coordinators.forEach(coord => {
    const regex = new RegExp(`\\b${coord}\\b`, 'g');
    const matches = textLower.match(regex);
    if (matches) coordinationCount += matches.length;
  });
  const coordinationFrequency = coordinationCount / sentences.length;

  // Syntactic variation: standard deviation of sentence lengths
  const { words } = tokenizeText(text);
  const sentenceLengths = sentences.map(s => {
    const sentenceWords = compromise(s).terms().out('array') as string[];
    return sentenceWords.length;
  });
  const avgLength = sentenceLengths.reduce((sum, len) => sum + len, 0) / sentenceLengths.length;
  const variance = sentenceLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / sentenceLengths.length;
  const syntacticVariation = Math.sqrt(variance);

  return {
    clauseDepth: avgClauseDepth,
    coordinationFrequency,
    syntacticVariation,
  };
}

// Rhythm patterns and function word analysis
export function analyzeRhythmAndStyle(text: string) {
  const { sentences, words } = tokenizeText(text);
  
  if (sentences.length === 0 || words.length === 0) {
    return {
      rhythmPatterns: [],
      functionWordRatio: 0,
    };
  }

  // Rhythm patterns: sequence of sentence lengths
  const rhythmPatterns = sentences.map(s => {
    const sentenceWords = compromise(s).terms().out('array') as string[];
    return sentenceWords.length;
  });

  // Function words (articles, prepositions, conjunctions, pronouns)
  const functionWords = ['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'and', 'or', 'but', 'if', 'he', 'she', 'it', 'they', 'we', 'i', 'you'];
  let functionWordCount = 0;
  
  words.forEach(word => {
    if (functionWords.includes(word.toLowerCase())) {
      functionWordCount++;
    }
  });

  const functionWordRatio = functionWordCount / words.length;

  return {
    rhythmPatterns,
    functionWordRatio,
  };
}

// Grammar metrics: tense, pronouns, verbs, modifiers
export function analyzeGrammarMetrics(text: string) {
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
  const pastTense = doc.verbs().toPastTense().length;
  const presentTense = doc.verbs().toPresentTense().length;
  const futureTense = doc.match('will #Verb').length;
  const totalVerbs = pastTense + presentTense + futureTense || 1;
  
  // Tense consistency: how dominant is the most common tense
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
  const verbFormDistribution = {
    past: pastTense,
    present: presentTense,
    future: futureTense,
  };

  // Modifier density (adjectives + adverbs per word)
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

// N-grams extraction
export function extractNGrams(text: string, n: number = 2, topN: number = 10): Array<{ phrase: string; count: number }> {
  const { words } = tokenizeText(text);
  
  if (words.length < n) {
    return [];
  }

  const nGrams = new Map<string, number>();
  
  for (let i = 0; i <= words.length - n; i++) {
    const phrase = words.slice(i, i + n).join(' ').toLowerCase();
    nGrams.set(phrase, (nGrams.get(phrase) || 0) + 1);
  }

  return Array.from(nGrams.entries())
    .filter(([, count]) => count > 1)
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

// Detect deliberate vs accidental repetition
export function analyzeRepeatedPhrasesAdvanced(text: string, minLength: number = 3): Array<{ phrase: string; count: number; isDeliberate: boolean }> {
  const { words } = tokenizeText(text);
  
  const phrases = new Map<string, number>();
  
  for (let i = 0; i <= words.length - minLength; i++) {
    const phrase = words.slice(i, i + minLength).join(' ').toLowerCase();
    phrases.set(phrase, (phrases.get(phrase) || 0) + 1);
  }

  return Array.from(phrases.entries())
    .filter(([, count]) => count > 1)
    .map(([phrase, count]) => {
      // Heuristic: if repeated 2-3 times, likely deliberate; if 4+, likely accidental
      const isDeliberate = count >= 2 && count <= 3 && phrase.split(' ').some(word => 
        ['very', 'really', 'so', 'much', 'many'].includes(word)
      );
      return { phrase, count, isDeliberate };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

// Calculate daily trends from multiple documents
export function calculateDailyTrends(documents: Array<{ content: string; createdAt: number; analytics?: any }>) {
  const trendsByDate = new Map<string, { wordCount: number; documentCount: number; sentiments: number[]; readabilities: number[] }>();

  documents.forEach(doc => {
    const date = new Date(doc.createdAt).toISOString().split('T')[0];
    const existing = trendsByDate.get(date) || { wordCount: 0, documentCount: 0, sentiments: [], readabilities: [] };
    
    const wordCount = doc.content.split(/\s+/).filter(w => w.length > 0).length;
    existing.wordCount += wordCount;
    existing.documentCount += 1;
    
    if (doc.analytics) {
      existing.sentiments.push(doc.analytics.sentiment?.score || 0);
      existing.readabilities.push(doc.analytics.readability?.fleschReadingEase || 0);
    }
    
    trendsByDate.set(date, existing);
  });

  return Array.from(trendsByDate.entries())
    .map(([date, data]) => ({
      date,
      wordCount: data.wordCount,
      documentCount: data.documentCount,
      avgSentiment: data.sentiments.length > 0 ? data.sentiments.reduce((a, b) => a + b, 0) / data.sentiments.length : 0,
      avgReadability: data.readabilities.length > 0 ? data.readabilities.reduce((a, b) => a + b, 0) / data.readabilities.length : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Compare two documents
export function compareDocuments(doc1Analytics: any, doc2Analytics: any) {
  return {
    doc1Id: doc1Analytics.documentId,
    doc2Id: doc2Analytics.documentId,
    toneDifference: Math.abs((doc1Analytics.sentiment?.score || 0) - (doc2Analytics.sentiment?.score || 0)),
    vocabularyDifference: Math.abs((doc1Analytics.lexicalRichness?.typeTokenRatio || 0) - (doc2Analytics.lexicalRichness?.typeTokenRatio || 0)),
    readabilityDifference: Math.abs((doc1Analytics.readability?.fleschReadingEase || 0) - (doc2Analytics.readability?.fleschReadingEase || 0)),
    complexityDifference: Math.abs((doc1Analytics.styleMetrics?.avgSentenceLength || 0) - (doc2Analytics.styleMetrics?.avgSentenceLength || 0)),
    sentimentDifference: Math.abs((doc1Analytics.sentiment?.intensity || 0) - (doc2Analytics.sentiment?.intensity || 0)),
    timestamp: Date.now(),
  };
}
