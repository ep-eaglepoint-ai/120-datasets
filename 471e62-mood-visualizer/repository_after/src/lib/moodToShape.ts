import { ShapeProperties, ShapeType, AnimationType, PatternType } from './types';
import { hashString } from '../utils/hash';

type Sentiment = 'positive' | 'negative' | 'neutral';

const SHAPES: ShapeType[] = ['circle', 'triangle', 'square', 'pentagon', 'hexagon'];
const ANIMATIONS: AnimationType[] = ['rotate', 'pulse', 'bounce', 'wave', 'jitter'];
const PATTERNS: PatternType[] = ['solid', 'gradient', 'striped', 'dotted'];

const COLOR_PALETTES = {
  positive: ['#FFD700', '#FFA500', '#FF6347', '#32CD32', '#FFD700'],
  negative: ['#DC143C', '#000000', '#2F4F4F', '#8B0000', '#4B0082'],
  neutral: ['#87CEEB', '#228B22', '#4682B4', '#708090', '#20B2AA'],
};

const POSITIVE_KEYWORDS = ['happy', 'joy', 'excited', 'love', 'great', 'awesome', 'wonderful', 'cheerful', 'delighted', 'ecstatic', 'thrilled', 'glad', 'pleased', 'content', 'blissful'];
const NEGATIVE_KEYWORDS = ['sad', 'angry', 'anxious', 'stressed', 'terrible', 'bad', 'upset', 'worried', 'frustrated', 'depressed', 'miserable', 'furious', 'annoyed', 'fearful', 'scared'];
const CALM_KEYWORDS = ['calm', 'peaceful', 'relaxed', 'serene', 'tranquil', 'zen', 'meditative', 'quiet', 'still', 'composed'];

function analyzeSentiment(text: string): Sentiment {
  const lower = text.toLowerCase();
  const posCount = POSITIVE_KEYWORDS.filter(w => lower.includes(w)).length;
  const negCount = NEGATIVE_KEYWORDS.filter(w => lower.includes(w)).length;
  const calmCount = CALM_KEYWORDS.filter(w => lower.includes(w)).length;
  
  if (calmCount > 0 && calmCount >= posCount && calmCount >= negCount) {
    return 'neutral';
  }
  
  if (posCount > negCount) return 'positive';
  if (negCount > posCount) return 'negative';
  return 'neutral';
}

function getMoodColor(text: string, sentiment: Sentiment, seed: number): string {
  const lower = text.toLowerCase();
  
  if (lower.includes('happy') || lower.includes('joy') || lower.includes('cheerful')) {
    return '#FFD700';
  }
  if (lower.includes('excited') || lower.includes('thrilled') || lower.includes('ecstatic')) {
    return '#FFA500';
  }
  if (lower.includes('sad') || lower.includes('depressed') || lower.includes('melancholy')) {
    return '#000000';
  }
  if (lower.includes('angry') || lower.includes('furious') || lower.includes('rage')) {
    return '#DC143C';
  }
  if (lower.includes('anxious') || lower.includes('worried') || lower.includes('stressed')) {
    return '#8B0000';
  }
  if (lower.includes('calm') || lower.includes('peaceful') || lower.includes('serene')) {
    return '#87CEEB';
  }
  if (lower.includes('relaxed') || lower.includes('tranquil')) {
    return '#228B22';
  }
  
  const palette = COLOR_PALETTES[sentiment];
  return palette[Math.floor(seed / 1000) % palette.length];
}

export function moodToShape(mood: string): ShapeProperties {
  if (!mood || mood.trim() === '') {
    throw new Error('Mood cannot be empty');
  }
  
  const sanitized = mood.trim().slice(0, 100);
  const seed = hashString(sanitized);
  
  const shapeIndex = seed % SHAPES.length;
  const animationIndex = Math.floor(seed / 10) % ANIMATIONS.length;
  const patternIndex = Math.floor(seed / 100) % PATTERNS.length;
  
  const sentiment = analyzeSentiment(sanitized);
  const colorPalette = COLOR_PALETTES[sentiment];
  const primaryColor = getMoodColor(sanitized, sentiment, seed);
  
  let secondaryColor: string;
  const primaryColorIndex = colorPalette.indexOf(primaryColor);
  if (primaryColorIndex >= 0) {
    secondaryColor = colorPalette[(primaryColorIndex + 1) % colorPalette.length];
  } else {
    const secondaryIndex = Math.floor(seed / 2000) % colorPalette.length;
    secondaryColor = colorPalette[secondaryIndex];
  }
  
  const size = 80 + ((seed % 12) * 10);
  const wordCount = sanitized.split(/\s+/).length;
  const speed = Math.min(10, Math.max(1, wordCount));
  
  return {
    type: SHAPES[shapeIndex],
    primaryColor,
    secondaryColor,
    size,
    animation: ANIMATIONS[animationIndex],
    speed,
    pattern: PATTERNS[patternIndex],
  };
}
