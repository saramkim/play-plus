import { cleanListeningSpokenText } from '@/listening/domain/spoken-text';

import { splitListeningGraphemes } from './grapheme';

export type ListeningAnswerJudgment = 'correct' | 'almost' | 'try-again';

export type NormalizedListeningAnswer = {
  readable: string;
  compact: string;
};

const DOUBLE_QUOTE_PATTERN = /[\u00ab\u00bb\u201c\u201d\u201e\u201f\u301d\u301e\uff02]/gu;
const APOSTROPHE_PATTERN = /[\u2018\u2019\u201a\u201b\u2039\u203a\u02bc\uff07]/gu;
const HYPHEN_PATTERN = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\ufe58\ufe63\uff0d]/gu;
const PUNCTUATION_PATTERN = /\p{P}+/gu;
const WHITESPACE_PATTERN = /\s+/gu;
const SHARP_S_PATTERN = /\u00df/gu;
const FINAL_SIGMA_PATTERN = /\u03c2/gu;

export const normalizeListeningAnswer = (
  input: string,
  learningLanguage: string
): NormalizedListeningAnswer => {
  const plainText = cleanListeningSpokenText(input).normalize('NFKC');
  const caseFolded = foldListeningCase(plainText, learningLanguage);
  const canonicalized = caseFolded
    .replace(DOUBLE_QUOTE_PATTERN, '"')
    .replace(APOSTROPHE_PATTERN, "'")
    .replace(HYPHEN_PATTERN, '-');
  const readable = normalizeWhitespace(canonicalized.replace(PUNCTUATION_PATTERN, ''));

  return {
    readable,
    compact: readable.replace(WHITESPACE_PATTERN, ''),
  };
};

export const judgeListeningAnswer = (
  expected: string,
  actual: string,
  learningLanguage: string
): ListeningAnswerJudgment => {
  const normalizedExpected = normalizeListeningAnswer(expected, learningLanguage).compact;
  const normalizedActual = normalizeListeningAnswer(actual, learningLanguage).compact;

  if (normalizedExpected.length === 0 || normalizedActual.length === 0) return 'try-again';
  if (normalizedExpected === normalizedActual) return 'correct';

  const expectedGraphemes = splitListeningGraphemes(normalizedExpected);
  const actualGraphemes = splitListeningGraphemes(normalizedActual);
  const distance = calculateListeningLevenshteinDistance(expectedGraphemes, actualGraphemes);
  const threshold = getListeningAlmostThreshold(expectedGraphemes.length, actualGraphemes.length);

  return distance <= threshold ? 'almost' : 'try-again';
};

export const getListeningAlmostThreshold = (expectedLength: number, actualLength: number): number => {
  return Math.max(1, Math.floor(Math.max(expectedLength, actualLength) * 0.15));
};

export const calculateListeningLevenshteinDistance = (
  expected: readonly string[],
  actual: readonly string[]
): number => {
  if (expected.length === 0) return actual.length;
  if (actual.length === 0) return expected.length;

  let previous = Array.from({ length: actual.length + 1 }, (_, index) => index);

  for (let expectedIndex = 0; expectedIndex < expected.length; expectedIndex += 1) {
    const current = [expectedIndex + 1];

    for (let actualIndex = 0; actualIndex < actual.length; actualIndex += 1) {
      const substitutionCost = expected[expectedIndex] === actual[actualIndex] ? 0 : 1;
      current.push(
        Math.min(
          current[actualIndex] + 1,
          previous[actualIndex + 1] + 1,
          previous[actualIndex] + substitutionCost
        )
      );
    }

    previous = current;
  }

  return previous[actual.length];
};

const foldListeningCase = (input: string, learningLanguage: string): string => {
  const locale = getCanonicalLocale(learningLanguage);

  // Legacy and provider language labels are not guaranteed to be valid BCP 47.
  // Locale-neutral Unicode lowercasing is the deterministic fallback for them.
  const lowercased = locale === undefined ? input.toLowerCase() : input.toLocaleLowerCase(locale);

  // These full-fold mappings are not performed by JavaScript lowercasing.
  return lowercased.replace(SHARP_S_PATTERN, 'ss').replace(FINAL_SIGMA_PATTERN, '\u03c3');
};

const getCanonicalLocale = (learningLanguage: string): string | undefined => {
  const candidate = learningLanguage.trim();

  if (candidate.length === 0) return undefined;

  try {
    return Intl.getCanonicalLocales(candidate)[0];
  } catch {
    return undefined;
  }
};

const normalizeWhitespace = (input: string): string => input.replace(WHITESPACE_PATTERN, ' ').trim();
