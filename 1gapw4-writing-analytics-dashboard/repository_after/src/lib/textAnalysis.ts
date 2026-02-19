import compromise from 'compromise';

export interface TokenizationResult {
  words: string[];
  sentences: string[];
  paragraphs: string[];
}

export function tokenizeText(text: string): TokenizationResult {
  if (!text || text.trim().length === 0) {
    return { words: [], sentences: [], paragraphs: [] };
  }

  const doc = compromise(text);
  
  const paragraphs = text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const sentences = doc.sentences().out('array') as string[];
  
  const words = doc.terms().out('array') as string[];

  return { words, sentences, paragraphs };
}

export function countBasicMetrics(text: string) {
  const { words, sentences, paragraphs } = tokenizeText(text);
  
  return {
    wordCount: words.length,
    characterCount: text.length,
    sentenceCount: sentences.length,
    paragraphCount: paragraphs.length,
  };
}

export function analyzeSentiment(text: string): { score: number; polarity: 'positive' | 'negative' | 'neutral'; intensity: number } {
  if (!text || text.trim().length === 0) {
    return { score: 0, polarity: 'neutral' as const, intensity: 0 };
  }

  const doc = compromise(text);
  
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
  const score = totalSentimentWords > 0 
    ? (positiveCount - negativeCount) / totalSentimentWords 
    : 0;
  
  const polarity: 'positive' | 'negative' | 'neutral' = score > 0.1 ? 'positive' : score < -0.1 ? 'negative' : 'neutral';
  const intensity = Math.abs(score);
  
  return { score, polarity, intensity };
}

export function calculateReadability(text: string) {
  const { words, sentences } = tokenizeText(text);
  
  if (sentences.length === 0 || words.length === 0) {
    return {
      fleschReadingEase: 0,
      fleschKincaidGrade: 0,
      gunningFog: 0,
      smogIndex: 0,
    };
  }

  const totalSyllables = words.reduce((sum, word) => sum + countSyllables(word), 0);
  const avgSyllablesPerWord = totalSyllables / words.length;
  const avgWordsPerSentence = words.length / sentences.length;

  const fleschReadingEase = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;
  
  const fleschKincaidGrade = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;
  
  const complexWords = words.filter(word => countSyllables(word) >= 3).length;
  const percentComplexWords = (complexWords / words.length) * 100;
  const gunningFog = 0.4 * (avgWordsPerSentence + percentComplexWords);
  
  const polysyllableCount = words.filter(word => countSyllables(word) >= 3).length;
  const smogIndex = 1.0430 * Math.sqrt(polysyllableCount * (30 / sentences.length)) + 3.1291;

  return {
    fleschReadingEase: Math.max(0, Math.min(100, fleschReadingEase)),
    fleschKincaidGrade: Math.max(0, fleschKincaidGrade),
    gunningFog: Math.max(0, gunningFog),
    smogIndex: Math.max(0, smogIndex),
  };
}

function countSyllables(word: string): number {
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

export function calculateLexicalRichness(text: string) {
  const { words } = tokenizeText(text);
  
  if (words.length === 0) {
    return {
      typeTokenRatio: 0,
      hapaxLegomena: 0,
      vocabularyDiversity: 0,
    };
  }

  const wordFrequency = new Map<string, number>();
  words.forEach(word => {
    const normalized = word.toLowerCase();
    wordFrequency.set(normalized, (wordFrequency.get(normalized) || 0) + 1);
  });

  const uniqueWords = wordFrequency.size;
  const typeTokenRatio = uniqueWords / words.length;
  
  const hapaxLegomena = Array.from(wordFrequency.values()).filter(count => count === 1).length;
  
  const vocabularyDiversity = uniqueWords / Math.sqrt(words.length);

  return {
    typeTokenRatio,
    hapaxLegomena,
    vocabularyDiversity,
  };
}

export function analyzeStyleMetrics(text: string) {
  const { words, sentences } = tokenizeText(text);
  
  if (sentences.length === 0 || words.length === 0) {
    return {
      avgSentenceLength: 0,
      avgWordLength: 0,
      passiveVoiceCount: 0,
      punctuationDensity: 0,
    };
  }

  const avgSentenceLength = words.length / sentences.length;
  
  const totalWordLength = words.reduce((sum, word) => sum + word.length, 0);
  const avgWordLength = totalWordLength / words.length;
  
  const doc = compromise(text);
  const passiveVoiceCount = doc.match('#Verb (was|were|been) #PastTense').length;
  
  const punctuationMarks = text.match(/[.,;:!?]/g) || [];
  const punctuationDensity = punctuationMarks.length / words.length;

  return {
    avgSentenceLength,
    avgWordLength,
    passiveVoiceCount,
    punctuationDensity,
  };
}

export function extractKeywords(text: string, topN: number = 10): string[] {
  const doc = compromise(text);
  
  const nouns = doc.nouns().out('array') as string[];
  const verbs = doc.verbs().out('array') as string[];
  const adjectives = doc.adjectives().out('array') as string[];
  
  const allKeywords = [...nouns, ...verbs, ...adjectives];
  
  const frequency = new Map<string, number>();
  allKeywords.forEach(word => {
    const normalized = word.toLowerCase();
    frequency.set(normalized, (frequency.get(normalized) || 0) + 1);
  });
  
  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word]) => word);
}

export function detectRepeatedPhrases(text: string, minLength: number = 3): Array<{ phrase: string; count: number }> {
  const { words } = tokenizeText(text);
  
  const phrases = new Map<string, number>();
  
  for (let i = 0; i <= words.length - minLength; i++) {
    const phrase = words.slice(i, i + minLength).join(' ').toLowerCase();
    phrases.set(phrase, (phrases.get(phrase) || 0) + 1);
  }
  
  return Array.from(phrases.entries())
    .filter(([, count]) => count > 1)
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

export function analyzeGrammarPatterns(text: string) {
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

  const verbs = doc.verbs();
  const pastTense = verbs.toPastTense().length;
  const presentTense = verbs.toPresentTense().length;
  const futureTense = doc.match('will #Verb').length;
  const totalVerbs = pastTense + presentTense + futureTense || 1;
  
  const maxTense = Math.max(pastTense, presentTense, futureTense);
  const tenseConsistency = maxTense / totalVerbs;

  const pronouns = doc.pronouns().out('array') as string[];
  const pronounUsage: Record<string, number> = {};
  pronouns.forEach(pronoun => {
    const normalized = pronoun.toLowerCase();
    pronounUsage[normalized] = (pronounUsage[normalized] || 0) + 1;
  });

  const verbFormDistribution = {
    past: pastTense,
    present: presentTense,
    future: futureTense,
  };

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
