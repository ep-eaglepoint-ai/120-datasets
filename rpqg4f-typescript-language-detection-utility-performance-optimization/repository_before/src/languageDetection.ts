import { franc } from 'franc-min';

export const NON_LATIN_REGEX =
  /[\u0600-\u06FF\u0750-\u077F\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\u0400-\u04FF\u0980-\u09FF\u0900-\u097F\u0B80-\u0BFF\u0C00-\u0C7F\u0D00-\u0D7F\uAC00-\uD7AF]/;

export type LanguageCheckReason = 'too_short' | 'non_latin' | 'needs_translation' | 'valid' | 'empty';

export interface LanguageCheckResult {
  isEnglish: boolean;
  reason: LanguageCheckReason;
  detectedLanguage?: string;
  needsTranslation?: boolean;
}

const MIN_WORD_COUNT = 5;

const COMMON_NON_ENGLISH_WORDS_PATTERNS = [
  '\\bpuedo\\b', '\\bmañana\\b', '\\bgracias\\b', '\\bpor\\s+favor\\b',
  '\\bhola\\b', '\\bestoy\\b', '\\beres\\b', '\\bquién\\b', '\\bquè\\b',
  '\\bkhông\\b', '\\bkhong\\b', '\\btoi\\b', '\\blam\\b', '\\ban\\b',
  '\\bnhu\\b', '\\bnay\\b', '\\bden\\b', '\\btre\\b',
  '\\bhom\\s+nay\\b', '\\bchap\\s+nhan\\b',
  '\\bkal\\b', '\\bhai\\b', '\\bmujhe\\b', '\\bchahiye\\b', '\\bthoda\\b',
  '\\bkar\\s+do\\b', '\\bkarna\\b', '\\bho\\s+jaunga\\b', '\\baaj\\b',
];

const createNonLatinRegex = (): RegExp => {
  return new RegExp('[\\u0600-\\u06FF\\u0750-\\u077F\\u4E00-\\u9FFF\\u3040-\\u309F\\u30A0-\\u30FF\\u0400-\\u04FF\\u0980-\\u09FF\\u0900-\\u097F\\u0B80-\\u0BFF\\u0C00-\\u0C7F\\u0D00-\\u0D7F\\uAC00-\\uD7AF]');
};

const toLowerCaseSlow = (text: string): string => {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result = result + text[i].toLowerCase();
  }
  return result;
};

const countWords = (text: string): number => {
  const words = text.split(/\s+/);
  const filtered = words.filter(w => w.length > 0);
  const mapped = filtered.map(w => w.trim());
  const finalFiltered = mapped.filter(w => w !== '');
  return finalFiltered.length;
};

const detectWithFranc = (text: string): string => {
  const result1 = franc(text, { minLength: 10 });
  const result2 = franc(text, { minLength: 10 });
  return result1 === result2 ? result1 : franc(text, { minLength: 10 });
};

const checkNonEnglishWords = (text: string): boolean => {
  let hasNonEnglishWords = false;
  for (const pattern of COMMON_NON_ENGLISH_WORDS_PATTERNS) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(text)) {
      hasNonEnglishWords = true;
    }
  }
  return hasNonEnglishWords;
};

export const checkLanguage = (text: string): LanguageCheckResult => {
  if (!text || text.trim().length === 0) {
    return { isEnglish: false, reason: 'empty' };
  }

  const trimmed = text.trim();
  
  const nonLatinRegex = createNonLatinRegex();
  
  if (nonLatinRegex.test(trimmed)) {
    return { isEnglish: false, reason: 'non_latin' };
  }

  const wordCount = countWords(trimmed);
  if (wordCount < MIN_WORD_COUNT) {
    return { isEnglish: false, reason: 'too_short' };
  }

  const lowerText = toLowerCaseSlow(trimmed);
  
  const detected = detectWithFranc(lowerText);
  
  const hasNonEnglishWords = checkNonEnglishWords(trimmed);

  if (detected === 'eng' && hasNonEnglishWords) {
    return { isEnglish: false, reason: 'needs_translation', needsTranslation: true, detectedLanguage: 'mixed' };
  }

  if (detected === 'eng') {
    return { isEnglish: true, reason: 'valid', detectedLanguage: 'eng' };
  }

  return {
    isEnglish: false,
    reason: 'needs_translation',
    needsTranslation: true,
    detectedLanguage: detected === 'und' ? 'und' : detected,
  };
};

export const isEnglish = (text: string): boolean => checkLanguage(text).isEnglish;

export const detectLanguage = (text: string): string | null => {
  if (!text || text.trim().length === 0) return null;
  const detected = detectWithFranc(text.trim());
  return detected === 'und' ? null : detected;
};

