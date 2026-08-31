import { normalizeListeningAnswer } from './answer';
import { splitListeningGraphemes } from './grapheme';
import { LISTENING_HINT_MASK } from './hint';

export type SubmittedAnswerScaffoldPart =
  | Readonly<{ graphemeCount: number; kind: 'blank' }>
  | Readonly<{ kind: 'matched'; text: string }>
  | Readonly<{ kind: 'whitespace'; text: string }>;

export type SubmittedAnswerScaffold = Readonly<{
  parts: readonly SubmittedAnswerScaffoldPart[];
  strategy: 'grapheme-lcs' | 'token-lcs';
  visualText: string;
}>;

export type SubmittedAnswerScaffoldInput = Readonly<{
  expected: string;
  learningLanguage: string;
  submitted: string;
}>;

export const createSubmittedAnswerScaffold = ({
  expected,
  learningLanguage,
  submitted,
}: SubmittedAnswerScaffoldInput): SubmittedAnswerScaffold => {
  const normalizedExpected = normalizeListeningAnswer(expected, learningLanguage).readable;
  const normalizedSubmitted = normalizeListeningAnswer(submitted, learningLanguage).readable;
  const expectedTokens = splitTokens(normalizedExpected);
  const strategy = expectedTokens.length >= 2 ? 'token-lcs' : 'grapheme-lcs';
  const expectedUnits =
    strategy === 'token-lcs' ? expectedTokens : splitListeningGraphemes(normalizedExpected);
  const submittedUnits =
    strategy === 'token-lcs'
      ? splitTokens(normalizedSubmitted)
      : splitListeningGraphemes(normalizedSubmitted);
  const matchedExpectedIndices = new Set(
    findEarlierLongestCommonSubsequence(expectedUnits, submittedUnits).expectedIndices
  );
  const parts =
    strategy === 'token-lcs'
      ? createTokenParts(expectedUnits, matchedExpectedIndices)
      : createGraphemeParts(expectedUnits, matchedExpectedIndices);
  const frozenParts = Object.freeze(parts.map((part) => Object.freeze(part)));

  return Object.freeze({
    parts: frozenParts,
    strategy,
    visualText: renderVisualText(frozenParts),
  });
};

const createTokenParts = (
  expectedTokens: readonly string[],
  matchedExpectedIndices: ReadonlySet<number>
): SubmittedAnswerScaffoldPart[] => {
  const parts: SubmittedAnswerScaffoldPart[] = [];

  expectedTokens.forEach((token, index) => {
    if (index > 0) parts.push({ kind: 'whitespace', text: ' ' });
    if (matchedExpectedIndices.has(index)) {
      appendMatched(parts, token);
      return;
    }
    appendBlank(parts, splitListeningGraphemes(token).length);
  });

  return parts;
};

const createGraphemeParts = (
  expectedGraphemes: readonly string[],
  matchedExpectedIndices: ReadonlySet<number>
): SubmittedAnswerScaffoldPart[] => {
  const parts: SubmittedAnswerScaffoldPart[] = [];

  expectedGraphemes.forEach((grapheme, index) => {
    if (matchedExpectedIndices.has(index)) appendMatched(parts, grapheme);
    else appendBlank(parts, 1);
  });

  return parts;
};

const appendMatched = (parts: SubmittedAnswerScaffoldPart[], text: string) => {
  const previous = parts.at(-1);
  if (previous?.kind === 'matched') {
    parts[parts.length - 1] = { kind: 'matched', text: previous.text + text };
    return;
  }
  parts.push({ kind: 'matched', text });
};

const appendBlank = (parts: SubmittedAnswerScaffoldPart[], graphemeCount: number) => {
  if (graphemeCount === 0) return;
  const previous = parts.at(-1);
  if (previous?.kind === 'blank') {
    parts[parts.length - 1] = {
      graphemeCount: previous.graphemeCount + graphemeCount,
      kind: 'blank',
    };
    return;
  }
  parts.push({ graphemeCount, kind: 'blank' });
};

const renderVisualText = (parts: readonly SubmittedAnswerScaffoldPart[]) =>
  parts
    .map((part) =>
      part.kind === 'blank' ? LISTENING_HINT_MASK.repeat(part.graphemeCount) : part.text
    )
    .join('');

const splitTokens = (input: string) => input.split(' ').filter((token) => token.length > 0);

const findEarlierLongestCommonSubsequence = (
  expected: readonly string[],
  submitted: readonly string[]
): Alignment => {
  const rowLength = expected.length + 1;
  const expectedBits = expected.map(
    (_, index) => 1n << BigInt(expected.length - index - 1)
  );
  let previousLengths = new Uint16Array(rowLength);
  let currentLengths = new Uint16Array(rowLength);
  let previousExpectedMasks = Array<bigint>(rowLength).fill(0n);
  let currentExpectedMasks = Array<bigint>(rowLength).fill(0n);

  submitted.forEach((submittedUnit) => {
    currentLengths[0] = 0;
    currentExpectedMasks[0] = 0n;

    for (let expectedLength = 1; expectedLength <= expected.length; expectedLength += 1) {
      const expectedIndex = expectedLength - 1;
      let bestLength = currentLengths[expectedLength - 1];
      let bestExpectedMask = currentExpectedMasks[expectedLength - 1];

      if (
        isPreferredAlignment(
          previousLengths[expectedLength],
          previousExpectedMasks[expectedLength],
          bestLength,
          bestExpectedMask
        )
      ) {
        bestLength = previousLengths[expectedLength];
        bestExpectedMask = previousExpectedMasks[expectedLength];
      }

      if (expected[expectedIndex] === submittedUnit) {
        const matchedLength = previousLengths[expectedLength - 1] + 1;
        const matchedExpectedMask =
          previousExpectedMasks[expectedLength - 1] | expectedBits[expectedIndex];
        if (
          isPreferredAlignment(
            matchedLength,
            matchedExpectedMask,
            bestLength,
            bestExpectedMask
          )
        ) {
          bestLength = matchedLength;
          bestExpectedMask = matchedExpectedMask;
        }
      }

      currentLengths[expectedLength] = bestLength;
      currentExpectedMasks[expectedLength] = bestExpectedMask;
    }

    [previousLengths, currentLengths] = [currentLengths, previousLengths];
    [previousExpectedMasks, currentExpectedMasks] = [
      currentExpectedMasks,
      previousExpectedMasks,
    ];
  });

  const expectedIndices = expected.flatMap((_, index) =>
    (previousExpectedMasks[expected.length] & expectedBits[index]) === 0n ? [] : [index]
  );

  // For the preferred expected positions, the greedy embedding is the
  // lexicographically earliest submitted-position tie without per-cell paths.
  return {
    expectedIndices,
    submittedIndices: findEarliestSubmittedIndices(expected, submitted, expectedIndices),
  };
};

type Alignment = Readonly<{
  expectedIndices: readonly number[];
  submittedIndices: readonly number[];
}>;

const isPreferredAlignment = (
  candidateLength: number,
  candidateExpectedMask: bigint,
  currentLength: number,
  currentExpectedMask: bigint
) =>
  candidateLength > currentLength ||
  (candidateLength === currentLength && candidateExpectedMask > currentExpectedMask);

const findEarliestSubmittedIndices = (
  expected: readonly string[],
  submitted: readonly string[],
  expectedIndices: readonly number[]
) => {
  const submittedIndices: number[] = [];
  let submittedIndex = 0;

  for (const expectedIndex of expectedIndices) {
    while (
      submittedIndex < submitted.length &&
      submitted[submittedIndex] !== expected[expectedIndex]
    ) {
      submittedIndex += 1;
    }

    if (submittedIndex === submitted.length) {
      throw new Error('LCS alignment could not be reconstructed');
    }
    submittedIndices.push(submittedIndex);
    submittedIndex += 1;
  }

  return submittedIndices;
};
