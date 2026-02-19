/**
 * ============================================================================
 * ANALYTICS WEB WORKER - Background Processing for Heavy Computation
 * ============================================================================
 * 
 * [Req -21] WEB WORKER CREATED BUT NOT ACTUALLY USED:
 * - This worker is properly implemented with comprehensive analysis functions.
 * - HOWEVER, the main application (store.ts) rarely uses it:
 *   - analyzeDocument() runs synchronously on main thread
 *   - analyzeDocumentWithWorker() exists but is only used as fallback
 *   - No automatic delegation to worker for large documents
 * 
 * CURRENT STATE:
 * - Worker is loaded via: new Worker('/analytics.worker.js')
 * - Message handlers implemented: ANALYZE_TEXT, ANALYZE_BATCH, etc.
 * - Full analysis pipeline duplicated here (can cause maintenance issues)
 * 
 * TODO: Actually use the web worker:
 *   1. In store.ts, change analyzeDocument() to always use worker for docs > 1000 words
 *   2. Add automatic worker selection based on document size
 *   3. Implement proper progress reporting to UI
 *   4. Add worker pooling for batch operations
 * 
 * TODO: Improve worker architecture:
 *   - Share code between main thread and worker (avoid duplication)
 *   - Use Comlink library for easier worker communication
 *   - Implement transferable objects for large text data
 *   - Add worker termination on component unmount
 * 
 * EXAMPLE proper worker usage in store.ts:
 * ```typescript
 * analyzeDocument: async (documentId, force = false) => {
 *   const doc = get().documents.find(d => d.id === documentId);
 *   if (!doc) return;
 *   
 *   // Use worker for large documents
 *   if (doc.content.length > 5000) {
 *     return get().analyzeDocumentWithWorker(documentId);
 *   }
 *   // Otherwise use main thread for small documents
 *   // ... existing synchronous analysis
 * }
 * ```
 * 
 * ============================================================================
 */

// Web Worker for offloading heavy analytics computation (Requirement #21)
// This worker handles CPU-intensive text processing to keep the main thread responsive

self.onmessage = function(e) {
  const { type, payload } = e.data;
  
  switch (type) {
    case 'ANALYZE_TEXT':
      handleAnalyzeText(payload);
      break;
    case 'ANALYZE_BATCH':
      handleAnalyzeBatch(payload);
      break;
    case 'COMPUTE_PRODUCTIVITY':
      handleComputeProductivity(payload);
      break;
    case 'COMPUTE_EVOLUTION':
      handleComputeEvolution(payload);
      break;
    case 'DETECT_TOPICS':
      handleDetectTopics(payload);
      break;
    default:
      console.warn('Unknown message type:', type);
  }
};

function handleAnalyzeText(payload) {
  const { documentId, content } = payload;
  
  try {
    const result = analyzeTextComprehensive(content);
    
    self.postMessage({
      type: 'ANALYSIS_COMPLETE',
      payload: { documentId, result }
    });
  } catch (error) {
    self.postMessage({
      type: 'ANALYSIS_ERROR',
      payload: { documentId, error: error.message }
    });
  }
}

function handleAnalyzeBatch(payload) {
  const { documents } = payload;
  const results = [];
  
  try {
    for (const doc of documents) {
      const result = analyzeTextComprehensive(doc.content);
      results.push({ documentId: doc.id, result });
      
      // Report progress
      self.postMessage({
        type: 'BATCH_PROGRESS',
        payload: { completed: results.length, total: documents.length }
      });
    }
    
    self.postMessage({
      type: 'BATCH_COMPLETE',
      payload: { results }
    });
  } catch (error) {
    self.postMessage({
      type: 'BATCH_ERROR',
      payload: { error: error.message }
    });
  }
}

function handleComputeProductivity(payload) {
  const { dailyData } = payload;
  
  try {
    const result = computeProductivityMetrics(dailyData);
    self.postMessage({
      type: 'PRODUCTIVITY_COMPLETE',
      payload: result
    });
  } catch (error) {
    self.postMessage({
      type: 'PRODUCTIVITY_ERROR',
      payload: { error: error.message }
    });
  }
}

function handleComputeEvolution(payload) {
  const { analyticsHistory } = payload;
  
  try {
    const result = computeStylisticEvolution(analyticsHistory);
    self.postMessage({
      type: 'EVOLUTION_COMPLETE',
      payload: result
    });
  } catch (error) {
    self.postMessage({
      type: 'EVOLUTION_ERROR',
      payload: { error: error.message }
    });
  }
}

function handleDetectTopics(payload) {
  const { content, keywords } = payload;
  
  try {
    const result = detectTopicsInText(content, keywords);
    self.postMessage({
      type: 'TOPICS_COMPLETE',
      payload: result
    });
  } catch (error) {
    self.postMessage({
      type: 'TOPICS_ERROR',
      payload: { error: error.message }
    });
  }
}

function analyzeTextInWorker(text) {
  // Basic tokenization
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  // Basic metrics
  const wordCount = words.length;
  const characterCount = text.length;
  const sentenceCount = sentences.length;
  const paragraphCount = paragraphs.length;
  
  // Sentiment analysis (simplified)
  const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'happy', 'joy', 'beautiful'];
  const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'hate', 'sad', 'angry', 'ugly', 'poor', 'worst'];
  
  const textLower = text.toLowerCase();
  let positiveCount = 0;
  let negativeCount = 0;
  
  positiveWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = textLower.match(regex);
    if (matches) positiveCount += matches.length;
  });
  
  negativeWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = textLower.match(regex);
    if (matches) negativeCount += matches.length;
  });
  
  const totalSentimentWords = positiveCount + negativeCount;
  const sentimentScore = totalSentimentWords > 0 
    ? (positiveCount - negativeCount) / totalSentimentWords 
    : 0;
  
  const polarity = sentimentScore > 0.1 ? 'positive' : sentimentScore < -0.1 ? 'negative' : 'neutral';
  
  // Readability (simplified Flesch Reading Ease)
  const totalSyllables = words.reduce((sum, word) => sum + countSyllables(word), 0);
  const avgSyllablesPerWord = totalSyllables / Math.max(words.length, 1);
  const avgWordsPerSentence = words.length / Math.max(sentences.length, 1);
  const fleschReadingEase = Math.max(0, Math.min(100, 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord));
  
  // Lexical richness
  const uniqueWords = new Set(words.map(w => w.toLowerCase())).size;
  const typeTokenRatio = uniqueWords / Math.max(words.length, 1);
  
  return {
    wordCount,
    characterCount,
    sentenceCount,
    paragraphCount,
    sentiment: {
      score: sentimentScore,
      polarity,
      intensity: Math.abs(sentimentScore)
    },
    readability: {
      fleschReadingEase,
      fleschKincaidGrade: 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59,
      gunningFog: 0,
      smogIndex: 0
    },
    lexicalRichness: {
      typeTokenRatio,
      hapaxLegomena: 0,
      vocabularyDiversity: uniqueWords / Math.sqrt(Math.max(words.length, 1))
    },
    styleMetrics: {
      avgSentenceLength: avgWordsPerSentence,
      avgWordLength: words.reduce((sum, w) => sum + w.length, 0) / Math.max(words.length, 1),
      passiveVoiceCount: 0,
      punctuationDensity: (text.match(/[.,;:!?]/g) || []).length / Math.max(words.length, 1)
    }
  };
}

function countSyllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  
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
  
  if (word.endsWith('e')) {
    count--;
  }
  
  return Math.max(1, count);
}

// Comprehensive text analysis with all features
function analyzeTextComprehensive(text) {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  // Basic metrics
  const wordCount = words.length;
  const characterCount = text.length;
  const sentenceCount = sentences.length;
  const paragraphCount = paragraphs.length;
  
  // Enhanced sentiment analysis with paragraph-level
  const sentiment = analyzeAdvancedSentiment(text, sentences, paragraphs);
  
  // Enhanced readability
  const readability = calculateEnhancedReadability(text, words, sentences);
  
  // Lexical richness
  const lexicalRichness = calculateLexicalRichness(words);
  
  // Style metrics with clause depth and coordination
  const styleMetrics = analyzeStyleMetrics(text, words, sentences);
  
  // Grammar metrics
  const grammarMetrics = analyzeGrammarMetrics(text, words);
  
  // Topic analysis
  const topicAnalysis = analyzeTopics(text, words);
  
  // Repetition analysis
  const repetitionAnalysis = analyzeRepetition(text, words);
  
  // Stylistic fingerprint
  const stylisticFingerprint = computeStylisticFingerprint(text, words, sentences);
  
  // Uncertainty indicators
  const uncertaintyIndicators = calculateUncertainty(wordCount, sentenceCount, sentiment);
  
  return {
    wordCount,
    characterCount,
    sentenceCount,
    paragraphCount,
    sentiment,
    readability,
    lexicalRichness,
    styleMetrics,
    grammarMetrics,
    topicAnalysis,
    repetitionAnalysis,
    stylisticFingerprint,
    uncertaintyIndicators
  };
}

// Advanced sentiment with paragraph-level and polarity shifts
function analyzeAdvancedSentiment(text, sentences, paragraphs) {
  const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'happy', 'joy', 'beautiful', 'perfect', 'brilliant', 'awesome', 'delightful', 'pleasant', 'glad', 'pleased', 'satisfied', 'thrilled', 'excited'];
  const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'hate', 'sad', 'angry', 'ugly', 'poor', 'worst', 'disappointing', 'frustrating', 'annoying', 'miserable', 'depressing', 'dreadful', 'disgusting'];
  const intensifiers = ['very', 'extremely', 'incredibly', 'absolutely', 'totally', 'utterly', 'highly', 'really'];
  const negators = ['not', 'never', 'no', "n't", 'neither', 'nor'];
  
  // Sentence-level sentiment
  const sentenceLevel = sentences.map(sentence => {
    const result = analyzeSentenceSentiment(sentence, positiveWords, negativeWords, intensifiers, negators);
    return { sentence: sentence.substring(0, 100), ...result };
  });
  
  // Paragraph-level sentiment
  const paragraphLevel = paragraphs.map(paragraph => {
    const result = analyzeSentenceSentiment(paragraph, positiveWords, negativeWords, intensifiers, negators);
    return { paragraph: paragraph.substring(0, 100), ...result };
  });
  
  // Detect polarity shifts
  const polarityShifts = [];
  for (let i = 1; i < sentenceLevel.length; i++) {
    const prev = sentenceLevel[i - 1];
    const curr = sentenceLevel[i];
    if (prev.polarity !== curr.polarity && prev.polarity !== 'neutral' && curr.polarity !== 'neutral') {
      polarityShifts.push({
        fromPolarity: prev.polarity,
        toPolarity: curr.polarity,
        position: i,
        magnitude: Math.abs(curr.score - prev.score)
      });
    }
  }
  
  // Overall metrics
  const avgScore = sentenceLevel.length > 0 
    ? sentenceLevel.reduce((sum, s) => sum + s.score, 0) / sentenceLevel.length 
    : 0;
  const polarity = avgScore > 0.1 ? 'positive' : avgScore < -0.1 ? 'negative' : 'neutral';
  const intensity = Math.abs(avgScore);
  
  // Volatility
  const variance = sentenceLevel.length > 0 
    ? sentenceLevel.reduce((sum, s) => sum + Math.pow(s.score - avgScore, 2), 0) / sentenceLevel.length 
    : 0;
  const volatility = Math.sqrt(variance);
  
  // Mood patterns
  const moodPatterns = detectMoodPatterns(sentenceLevel);
  
  return {
    score: avgScore,
    polarity,
    intensity,
    sentenceLevel,
    paragraphLevel,
    polarityShifts,
    volatility,
    moodPatterns
  };
}

function analyzeSentenceSentiment(text, positiveWords, negativeWords, intensifiers, negators) {
  const words = text.toLowerCase().split(/\s+/);
  let positiveScore = 0;
  let negativeScore = 0;
  let intensityMultiplier = 1;
  let negationActive = false;
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[^a-z]/g, '');
    
    if (intensifiers.includes(word)) {
      intensityMultiplier = 1.5;
      continue;
    }
    
    if (negators.some(n => word.includes(n))) {
      negationActive = true;
      continue;
    }
    
    if (positiveWords.includes(word)) {
      if (negationActive) {
        negativeScore += intensityMultiplier;
        negationActive = false;
      } else {
        positiveScore += intensityMultiplier;
      }
    } else if (negativeWords.includes(word)) {
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

function detectMoodPatterns(sentenceLevel) {
  const patterns = [];
  if (sentenceLevel.length < 3) return patterns;
  
  let currentMood = sentenceLevel[0]?.polarity;
  let moodLength = 1;
  
  for (let i = 1; i < sentenceLevel.length; i++) {
    if (sentenceLevel[i].polarity === currentMood) {
      moodLength++;
    } else {
      if (moodLength >= 3) {
        patterns.push(`${currentMood} streak (${moodLength} sentences)`);
      }
      currentMood = sentenceLevel[i].polarity;
      moodLength = 1;
    }
  }
  
  if (moodLength >= 3) {
    patterns.push(`${currentMood} streak (${moodLength} sentences)`);
  }
  
  return patterns;
}

// Enhanced readability with fragment detection
function calculateEnhancedReadability(text, words, sentences) {
  const totalSyllables = words.reduce((sum, word) => sum + countSyllables(word), 0);
  const avgSyllablesPerWord = totalSyllables / Math.max(words.length, 1);
  const avgWordsPerSentence = words.length / Math.max(sentences.length, 1);
  
  const fleschReadingEase = Math.max(0, Math.min(100, 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord));
  const fleschKincaidGrade = Math.max(0, 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59);
  
  const complexWords = words.filter(word => countSyllables(word) >= 3).length;
  const percentComplexWords = (complexWords / Math.max(words.length, 1)) * 100;
  const gunningFog = Math.max(0, 0.4 * (avgWordsPerSentence + percentComplexWords));
  
  const polysyllableCount = complexWords;
  const smogIndex = Math.max(0, 1.0430 * Math.sqrt(polysyllableCount * (30 / Math.max(sentences.length, 1))) + 3.1291);
  
  // Sentence complexity
  const subordinators = ['because', 'although', 'while', 'since', 'if', 'when', 'where', 'that', 'which', 'who'];
  let totalComplexity = 0;
  sentences.forEach(sentence => {
    const sentenceLower = sentence.toLowerCase();
    let complexity = 1;
    subordinators.forEach(sub => {
      const regex = new RegExp(`\\b${sub}\\b`, 'g');
      const matches = sentenceLower.match(regex);
      if (matches) complexity += matches.length * 0.5;
    });
    totalComplexity += complexity;
  });
  const sentenceComplexity = totalComplexity / Math.max(sentences.length, 1);
  
  // Fragment detection
  let fragmentCount = 0;
  sentences.forEach(sentence => {
    const sentenceWords = sentence.split(/\s+/).filter(w => w.length > 0);
    if (sentenceWords.length < 4) {
      const hasVerb = /\b(is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|must|shall|can)\b/i.test(sentence);
      if (!hasVerb) fragmentCount++;
    }
  });
  
  // Technical term density
  const technicalPatterns = [/[a-z]+tion$/i, /[a-z]+ism$/i, /[a-z]+ology$/i, /[a-z]{10,}/i];
  let technicalCount = 0;
  words.forEach(word => {
    if (technicalPatterns.some(pattern => pattern.test(word))) technicalCount++;
  });
  const technicalTermDensity = technicalCount / Math.max(words.length, 1);
  
  return {
    fleschReadingEase,
    fleschKincaidGrade,
    gunningFog,
    smogIndex,
    sentenceComplexity,
    fragmentCount,
    technicalTermDensity
  };
}

// Lexical richness calculation
function calculateLexicalRichness(words) {
  const wordFrequency = new Map();
  words.forEach(word => {
    const normalized = word.toLowerCase();
    wordFrequency.set(normalized, (wordFrequency.get(normalized) || 0) + 1);
  });
  
  const uniqueWords = wordFrequency.size;
  const typeTokenRatio = uniqueWords / Math.max(words.length, 1);
  const hapaxLegomena = Array.from(wordFrequency.values()).filter(count => count === 1).length;
  const vocabularyDiversity = uniqueWords / Math.sqrt(Math.max(words.length, 1));
  
  // Repetition rate
  const repeatedWords = Array.from(wordFrequency.values()).filter(count => count > 1).length;
  const repetitionRate = repeatedWords / Math.max(wordFrequency.size, 1);
  
  // Rare word usage
  const rareWords = Array.from(wordFrequency.values()).filter(count => count <= 2).length;
  const rareWordUsage = rareWords / Math.max(wordFrequency.size, 1);
  
  // Moving average TTR (simplified)
  const windowSize = Math.min(100, words.length);
  let maTTR = typeTokenRatio;
  if (words.length >= windowSize) {
    const windowWords = words.slice(0, windowSize);
    const windowUnique = new Set(windowWords.map(w => w.toLowerCase())).size;
    maTTR = windowUnique / windowSize;
  }
  
  return {
    typeTokenRatio,
    movingAverageTTR: maTTR,
    hapaxLegomena,
    repetitionRate,
    rareWordUsage,
    vocabularyDiversity
  };
}

// Style metrics with clause depth and coordination
function analyzeStyleMetrics(text, words, sentences) {
  const avgSentenceLength = words.length / Math.max(sentences.length, 1);
  const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / Math.max(words.length, 1);
  
  // Passive voice detection
  const passivePattern = /\b(was|were|been|being)\s+\w+ed\b/gi;
  const passiveMatches = text.match(passivePattern) || [];
  const passiveVoiceCount = passiveMatches.length;
  
  // Punctuation density
  const punctuationMarks = text.match(/[.,;:!?]/g) || [];
  const punctuationDensity = punctuationMarks.length / Math.max(words.length, 1);
  
  // Clause depth
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
  const clauseDepth = totalClauseDepth / Math.max(sentences.length, 1);
  
  // Coordination frequency
  const coordinators = ['and', 'or', 'but', 'nor', 'yet', 'so'];
  let coordinationCount = 0;
  const textLower = text.toLowerCase();
  coordinators.forEach(coord => {
    const regex = new RegExp(`\\b${coord}\\b`, 'g');
    const matches = textLower.match(regex);
    if (matches) coordinationCount += matches.length;
  });
  const coordinationFrequency = coordinationCount / Math.max(sentences.length, 1);
  
  // Syntactic variation
  const sentenceLengths = sentences.map(s => s.split(/\s+/).filter(w => w.length > 0).length);
  const avgLength = sentenceLengths.reduce((sum, len) => sum + len, 0) / Math.max(sentenceLengths.length, 1);
  const variance = sentenceLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / Math.max(sentenceLengths.length, 1);
  const syntacticVariation = Math.sqrt(variance);
  
  // Rhythm patterns
  const rhythmPatterns = sentenceLengths;
  
  // Function word ratio
  const functionWords = ['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'and', 'or', 'but', 'if', 'he', 'she', 'it', 'they', 'we', 'i', 'you'];
  let functionWordCount = 0;
  words.forEach(word => {
    if (functionWords.includes(word.toLowerCase())) functionWordCount++;
  });
  const functionWordRatio = functionWordCount / Math.max(words.length, 1);
  
  // Sentence length distribution
  const shortCount = sentenceLengths.filter(l => l <= 10).length;
  const mediumCount = sentenceLengths.filter(l => l > 10 && l <= 25).length;
  const longCount = sentenceLengths.filter(l => l > 25).length;
  const total = Math.max(sentenceLengths.length, 1);
  
  return {
    avgSentenceLength,
    avgWordLength,
    passiveVoiceCount,
    punctuationDensity,
    clauseDepth,
    coordinationFrequency,
    syntacticVariation,
    rhythmPatterns,
    functionWordRatio,
    sentenceLengthDistribution: {
      short: shortCount / total,
      medium: mediumCount / total,
      long: longCount / total
    }
  };
}

// Grammar metrics
function analyzeGrammarMetrics(text, words) {
  // Tense analysis (simplified)
  const pastIndicators = /\b(was|were|had|did|\w+ed)\b/gi;
  const presentIndicators = /\b(is|are|has|does|am)\b/gi;
  const futureIndicators = /\b(will|shall|going to)\b/gi;
  
  const pastCount = (text.match(pastIndicators) || []).length;
  const presentCount = (text.match(presentIndicators) || []).length;
  const futureCount = (text.match(futureIndicators) || []).length;
  const totalVerbs = pastCount + presentCount + futureCount || 1;
  
  const maxTense = Math.max(pastCount, presentCount, futureCount);
  const tenseConsistency = maxTense / totalVerbs;
  
  // Pronoun usage
  const pronounPatterns = /\b(i|me|my|mine|we|us|our|ours|you|your|yours|he|him|his|she|her|hers|it|its|they|them|their|theirs)\b/gi;
  const pronounMatches = text.match(pronounPatterns) || [];
  const pronounUsage = {};
  pronounMatches.forEach(pronoun => {
    const normalized = pronoun.toLowerCase();
    pronounUsage[normalized] = (pronounUsage[normalized] || 0) + 1;
  });
  
  // Verb form distribution
  const verbFormDistribution = {
    past: pastCount,
    present: presentCount,
    future: futureCount
  };
  
  // Modifier density
  const adjectivePattern = /\b\w+ly\b|\b(very|quite|rather|extremely|incredibly)\b/gi;
  const modifierMatches = text.match(adjectivePattern) || [];
  const modifierDensity = modifierMatches.length / Math.max(words.length, 1);
  
  return {
    tenseConsistency,
    pronounUsage,
    verbFormDistribution,
    modifierDensity
  };
}

// Topic analysis
function analyzeTopics(text, words) {
  // Extract content words (nouns, verbs, adjectives - simplified)
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'our', 'their', 'as', 'so', 'if', 'then', 'than', 'when', 'where', 'who', 'what', 'which', 'how', 'why']);
  
  const contentWords = words.filter(w => {
    const normalized = w.toLowerCase().replace(/[^a-z]/g, '');
    return normalized.length > 3 && !stopWords.has(normalized);
  });
  
  // Word frequency for keywords
  const wordFreq = new Map();
  contentWords.forEach(word => {
    const normalized = word.toLowerCase().replace(/[^a-z]/g, '');
    wordFreq.set(normalized, (wordFreq.get(normalized) || 0) + 1);
  });
  
  const keywords = Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word);
  
  // Simple topic clustering
  const totalFreq = Array.from(wordFreq.values()).reduce((sum, c) => sum + c, 0) || 1;
  const dominantTopics = Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word, count]) => ({
      topic: word.charAt(0).toUpperCase() + word.slice(1),
      weight: count / totalFreq,
      keywords: [word]
    }));
  
  // N-grams
  const nGrams = [];
  for (let i = 0; i <= words.length - 2; i++) {
    const phrase = words.slice(i, i + 2).map(w => w.toLowerCase()).join(' ');
    const existing = nGrams.find(n => n.phrase === phrase);
    if (existing) {
      existing.count++;
    } else {
      nGrams.push({ phrase, count: 1 });
    }
  }
  const topNGrams = nGrams
    .filter(n => n.count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  return {
    keywords,
    dominantTopics,
    nGrams: topNGrams
  };
}

// Repetition analysis
function analyzeRepetition(text, words) {
  // Filler words
  const fillerWords = ['um', 'uh', 'like', 'you know', 'basically', 'actually', 'literally', 'honestly', 'really', 'very', 'just', 'so', 'well', 'anyway', 'obviously', 'definitely'];
  const textLower = text.toLowerCase();
  const fillerCounts = [];
  
  fillerWords.forEach(filler => {
    const regex = new RegExp(`\\b${filler}\\b`, 'gi');
    const matches = textLower.match(regex);
    if (matches && matches.length > 0) {
      fillerCounts.push({
        word: filler,
        count: matches.length,
        density: matches.length / Math.max(words.length, 1)
      });
    }
  });
  
  // Repeated phrases (3-word)
  const phrases = new Map();
  for (let i = 0; i <= words.length - 3; i++) {
    const phrase = words.slice(i, i + 3).join(' ').toLowerCase();
    const existing = phrases.get(phrase) || { count: 0, positions: [] };
    existing.count++;
    existing.positions.push(i);
    phrases.set(phrase, existing);
  }
  
  const repeatedPhrases = Array.from(phrases.entries())
    .filter(([, data]) => data.count >= 2)
    .map(([phrase, data]) => {
      const avgDistance = data.positions.length > 1 
        ? (data.positions[data.positions.length - 1] - data.positions[0]) / (data.count - 1)
        : 0;
      const isDeliberate = data.count <= 3 || avgDistance < 50;
      return {
        phrase,
        count: data.count,
        isDeliberate,
        context: `Positions: ${data.positions.slice(0, 3).join(', ')}`
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  // Structural redundancy
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const structures = sentences.map(s => s.split(/\s+/).slice(0, 3).join(' ').toLowerCase());
  const structureCounts = new Map();
  structures.forEach(s => structureCounts.set(s, (structureCounts.get(s) || 0) + 1));
  const repeatedStructures = Array.from(structureCounts.values()).filter(c => c > 1).length;
  const structuralRedundancy = repeatedStructures / Math.max(structures.length, 1);
  
  // Overused words
  const wordFreq = new Map();
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'it', 'this', 'that', 'i', 'you', 'he', 'she', 'we', 'they']);
  words.forEach(word => {
    const normalized = word.toLowerCase().replace(/[^a-z]/g, '');
    if (normalized.length > 2 && !stopWords.has(normalized)) {
      wordFreq.set(normalized, (wordFreq.get(normalized) || 0) + 1);
    }
  });
  
  const totalContentWords = Array.from(wordFreq.values()).reduce((sum, c) => sum + c, 0);
  const uniqueContentWords = wordFreq.size;
  const expectedFreq = totalContentWords / Math.max(uniqueContentWords, 1);
  
  const overusedWords = Array.from(wordFreq.entries())
    .filter(([, count]) => count > expectedFreq * 2 && count >= 5)
    .map(([word, count]) => ({ word, count, expectedCount: Math.round(expectedFreq) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  return {
    repeatedPhrases,
    fillerWords: fillerCounts.sort((a, b) => b.count - a.count),
    structuralRedundancy,
    overusedWords
  };
}

// Stylistic fingerprint
function computeStylisticFingerprint(text, words, sentences) {
  const rhythmPatterns = sentences.map(s => s.split(/\s+/).filter(w => w.length > 0).length);
  
  const shortCount = rhythmPatterns.filter(l => l <= 10).length;
  const mediumCount = rhythmPatterns.filter(l => l > 10 && l <= 25).length;
  const longCount = rhythmPatterns.filter(l => l > 25).length;
  const total = Math.max(rhythmPatterns.length, 1);
  
  const avgLength = rhythmPatterns.reduce((sum, l) => sum + l, 0) / total;
  const variance = rhythmPatterns.reduce((sum, l) => sum + Math.pow(l - avgLength, 2), 0) / total;
  const variationScore = Math.sqrt(variance) / Math.max(avgLength, 1);
  
  // Function word profile
  const functionWords = ['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'and', 'or', 'but', 'if', 'he', 'she', 'it', 'they', 'we', 'i', 'you'];
  const functionWordProfile = {};
  const wordCount = Math.max(words.length, 1);
  
  functionWords.forEach(fw => {
    const count = words.filter(w => w.toLowerCase() === fw).length;
    functionWordProfile[fw] = count / wordCount;
  });
  
  // Punctuation profile
  const punctuationProfile = {};
  const punctuationMarks = ['.', ',', ';', ':', '!', '?', '-', '"', "'"];
  
  punctuationMarks.forEach(p => {
    const count = (text.match(new RegExp(`\\${p}`, 'g')) || []).length;
    punctuationProfile[p] = count / wordCount;
  });
  
  // Phrasing tendencies
  const startingPhrases = new Map();
  sentences.forEach(s => {
    const startWords = s.split(/\s+/).slice(0, 2).join(' ').toLowerCase();
    if (startWords.length > 3) {
      startingPhrases.set(startWords, (startingPhrases.get(startWords) || 0) + 1);
    }
  });
  
  const phrasingTendencies = Array.from(startingPhrases.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([pattern, count]) => ({ pattern, frequency: count / total }));
  
  return {
    rhythmPatterns,
    sentenceCadence: {
      shortSentenceRatio: shortCount / total,
      mediumSentenceRatio: mediumCount / total,
      longSentenceRatio: longCount / total,
      variationScore
    },
    functionWordProfile,
    punctuationProfile,
    phrasingTendencies
  };
}

// Uncertainty indicators
function calculateUncertainty(wordCount, sentenceCount, sentiment) {
  const warnings = [];
  
  let sentimentConfidence = Math.min(1, wordCount / 100);
  let readabilityConfidence = Math.min(1, sentenceCount / 5);
  let topicConfidence = Math.min(1, wordCount / 200);
  
  if (wordCount < 50) {
    warnings.push('Text is very short - metrics may be unreliable');
    sentimentConfidence *= 0.5;
  }
  
  if (sentenceCount < 3) {
    warnings.push('Few sentences - readability metrics may be inaccurate');
    readabilityConfidence *= 0.5;
  }
  
  if (sentiment.volatility > 0.5) {
    warnings.push('High sentiment volatility detected');
    sentimentConfidence *= 0.8;
  }
  
  const overallReliability = (sentimentConfidence + readabilityConfidence + topicConfidence) / 3;
  
  return {
    sentimentConfidence: Math.round(sentimentConfidence * 100) / 100,
    readabilityConfidence: Math.round(readabilityConfidence * 100) / 100,
    topicConfidence: Math.round(topicConfidence * 100) / 100,
    overallReliability: Math.round(overallReliability * 100) / 100,
    warnings
  };
}

// Productivity metrics calculation
function computeProductivityMetrics(dailyData) {
  if (!dailyData || dailyData.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalActiveDays: dailyData.length,
      averageWordsPerDay: 0,
      consistencyScore: 0,
      volumeGrowthRate: 0,
      missedDays: 0
    };
  }
  
  const sortedDates = dailyData.map(d => d.date).sort();
  
  // Calculate streaks
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 1;
  let missedDays = 0;
  
  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1]);
    const currDate = new Date(sortedDates[i]);
    const diffDays = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      missedDays += diffDays - 1;
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);
  
  // Current streak
  const today = new Date().toISOString().split('T')[0];
  const lastDate = sortedDates[sortedDates.length - 1];
  const daysSinceLastActive = Math.floor((new Date(today) - new Date(lastDate)) / (1000 * 60 * 60 * 24));
  
  if (daysSinceLastActive <= 1) {
    currentStreak = 1;
    for (let i = sortedDates.length - 2; i >= 0; i--) {
      const prevDate = new Date(sortedDates[i]);
      const currDate = new Date(sortedDates[i + 1]);
      const diffDays = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) currentStreak++;
      else break;
    }
  }
  
  // Consistency score
  const totalWords = dailyData.reduce((sum, d) => sum + d.wordCount, 0);
  const avgWords = totalWords / dailyData.length;
  const variance = dailyData.reduce((sum, d) => sum + Math.pow(d.wordCount - avgWords, 2), 0) / dailyData.length;
  const cv = avgWords > 0 ? Math.sqrt(variance) / avgWords : 0;
  const consistencyScore = Math.max(0, 1 - cv);
  
  // Volume growth rate
  let volumeGrowthRate = 0;
  if (dailyData.length >= 7) {
    const midpoint = Math.floor(dailyData.length / 2);
    const firstHalf = dailyData.slice(0, midpoint);
    const secondHalf = dailyData.slice(midpoint);
    const firstAvg = firstHalf.reduce((sum, d) => sum + d.wordCount, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, d) => sum + d.wordCount, 0) / secondHalf.length;
    volumeGrowthRate = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
  }
  
  return {
    currentStreak,
    longestStreak,
    totalActiveDays: dailyData.length,
    averageWordsPerDay: avgWords,
    consistencyScore,
    volumeGrowthRate,
    missedDays
  };
}

// Stylistic evolution calculation
function computeStylisticEvolution(analyticsHistory) {
  const toneEvolution = [];
  const complexityEvolution = [];
  const vocabularyEvolution = [];
  const pacingEvolution = [];
  
  analyticsHistory.forEach(item => {
    const date = item.date;
    const analytics = item.analytics;
    
    toneEvolution.push({
      date,
      score: analytics.sentiment?.score || 0,
      polarity: analytics.sentiment?.polarity || 'neutral'
    });
    
    complexityEvolution.push({
      date,
      avgSentenceLength: analytics.styleMetrics?.avgSentenceLength || 0,
      clauseDepth: analytics.styleMetrics?.clauseDepth || 1,
      readability: analytics.readability?.fleschReadingEase || 0
    });
    
    vocabularyEvolution.push({
      date,
      ttr: analytics.lexicalRichness?.typeTokenRatio || 0,
      uniqueWords: analytics.lexicalRichness?.hapaxLegomena || 0,
      rareWordUsage: analytics.lexicalRichness?.rareWordUsage || 0
    });
    
    const rhythmPatterns = analytics.styleMetrics?.rhythmPatterns || [];
    const avgRhythm = rhythmPatterns.length > 0 
      ? rhythmPatterns.reduce((sum, r) => sum + r, 0) / rhythmPatterns.length 
      : analytics.styleMetrics?.avgSentenceLength || 0;
    const rhythmVariance = rhythmPatterns.length > 0 
      ? rhythmPatterns.reduce((sum, r) => sum + Math.pow(r - avgRhythm, 2), 0) / rhythmPatterns.length 
      : 0;
    
    pacingEvolution.push({
      date,
      rhythmVariation: Math.sqrt(rhythmVariance),
      sentenceLengthStdDev: analytics.styleMetrics?.syntacticVariation || Math.sqrt(rhythmVariance)
    });
  });
  
  // Calculate sentiment stability
  const sentimentScores = toneEvolution.map(t => t.score);
  const avgSentiment = sentimentScores.reduce((sum, s) => sum + s, 0) / Math.max(sentimentScores.length, 1);
  const sentimentVariance = sentimentScores.reduce((sum, s) => sum + Math.pow(s - avgSentiment, 2), 0) / Math.max(sentimentScores.length, 1);
  const sentimentStability = 1 - Math.min(1, Math.sqrt(sentimentVariance));
  
  // Thematic focus shift
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
    thematicFocusShift
  };
}

// Topic detection helper
function detectTopicsInText(content, keywords) {
  const words = content.split(/\s+/).filter(w => w.length > 0);
  return analyzeTopics(content, words);
}
