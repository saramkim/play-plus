import { normalizeListeningAnswer } from './answer';
import { splitListeningGraphemes } from './grapheme';
import { cleanListeningSpokenText } from './spoken-text';

export const LISTENING_HINT_MASK = '＿';

export type ListeningHintLevel = 1 | 2 | 3 | 4;

export type ListeningHint = {
  level: ListeningHintLevel;
  text: string;
};

export type ListeningHintInput = {
  expected: string;
  learningLanguage: string;
  support?: string;
};

export const createListeningHint = (
  level: ListeningHintLevel,
  input: ListeningHintInput
): ListeningHint | undefined => {
  const normalizedExpected = normalizeListeningAnswer(input.expected, input.learningLanguage).readable;

  if (level === 1) return { level, text: createShapeHint(normalizedExpected) };
  if (level === 2) return { level, text: createFirstGraphemesHint(normalizedExpected) };
  if (level === 3) return hasSupport(input.support) ? { level, text: input.support } : undefined;

  return { level, text: cleanListeningSpokenText(input.expected) };
};

export const createListeningHintSequence = (input: ListeningHintInput): ListeningHint[] => {
  const levels: ListeningHintLevel[] = hasSupport(input.support) ? [1, 2, 3, 4] : [1, 2, 4];

  return levels.flatMap((level) => {
    const hint = createListeningHint(level, input);
    return hint === undefined ? [] : [hint];
  });
};

const createShapeHint = (expected: string): string => {
  return splitListeningGraphemes(expected)
    .map((grapheme) => (isWhitespace(grapheme) ? grapheme : LISTENING_HINT_MASK))
    .join('');
};

const createFirstGraphemesHint = (expected: string): string => {
  const graphemes = splitListeningGraphemes(expected);
  const tokenCount = expected.split(' ').filter((token) => token.length > 0).length;

  if (tokenCount < 2) {
    return graphemes
      .map((grapheme, index) => {
        if (isWhitespace(grapheme) || index % 4 === 0) return grapheme;
        return LISTENING_HINT_MASK;
      })
      .join('');
  }

  let revealNext = true;

  return graphemes
    .map((grapheme) => {
      if (isWhitespace(grapheme)) {
        revealNext = true;
        return grapheme;
      }

      if (revealNext) {
        revealNext = false;
        return grapheme;
      }

      return LISTENING_HINT_MASK;
    })
    .join('');
};

const hasSupport = (support: string | undefined): support is string => support !== undefined && support.trim().length > 0;

const isWhitespace = (grapheme: string): boolean => /^\s+$/u.test(grapheme);
