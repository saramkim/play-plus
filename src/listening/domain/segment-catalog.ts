import type { V2SubtitleCue } from '@storage/v2/type';

import {
  resolveCue,
  toMilliseconds,
  type ResolvedLearningCue,
} from '@/content/features/learning-playback/learning-playback';
import { createSupportAlignmentIndex } from '@/content/features/learning-playback/support-alignment';
import { countListeningGraphemes } from '@/listening/domain/grapheme';
import {
  createListeningSegmentKey,
  listeningSourceKeySchema,
  type ListeningSegmentKey,
  type ListeningSourceKey,
} from '@/listening/domain/source-identity';
import {
  cleanListeningSpokenText,
  hasListeningSpokenContent,
} from '@/listening/domain/spoken-text';

export const LISTENING_SEGMENT_LIMITS = {
  MAX_DURATION_MS: 9000,
  MAX_GAP_MS: 700,
  MAX_GRAPHEMES: 120,
  MIN_DURATION_MS: 800,
  MIN_GRAPHEMES: 2,
} as const;

export const LISTENING_MISSION_MAX_SEGMENTS = 10;

export interface ListeningAlignedSupport {
  sourceIndices: number[];
  text: string;
}

export interface ListeningPracticeSegment {
  alignedSupport?: ListeningAlignedSupport;
  answerText: string;
  cleanedTextParts: string[];
  endMs: number;
  segmentKey: ListeningSegmentKey;
  sourceIndices: number[];
  sourceKey: ListeningSourceKey;
  startMs: number;
}

export type ListeningProgressState = 'attempted' | 'cleared' | 'mastered';

export interface ListeningCatalogProgressItem {
  state: ListeningProgressState;
}

interface BuildListeningSegmentCatalogInput {
  learningCues: readonly V2SubtitleCue[];
  learningDelaySeconds?: number;
  sourceKey: ListeningSourceKey;
  supportCues?: readonly V2SubtitleCue[];
  supportDelaySeconds?: number;
}

interface PreparedListeningCue {
  cleanedText: string;
  eligible: boolean;
  resolved: ResolvedLearningCue;
}

interface ListeningSegmentDraft {
  answerText: string;
  cleanedTextParts: string[];
  endMs: number;
  sourceIndices: number[];
  startMs: number;
}

const completionPunctuationPattern = /[.?!。？！]$/u;
const dialoguePrefixPattern = /^[-–—](?=.*[\p{L}\p{N}])/u;

export const buildListeningSegmentCatalog = async ({
  learningCues,
  learningDelaySeconds = 0,
  sourceKey: sourceKeyValue,
  supportCues = [],
  supportDelaySeconds = 0,
}: BuildListeningSegmentCatalogInput): Promise<ListeningPracticeSegment[]> => {
  const sourceKey = listeningSourceKeySchema.parse(sourceKeyValue);
  const learningDelayMs = toMilliseconds(learningDelaySeconds);
  const preparedCues = learningCues.map((cue, sourceIndex): PreparedListeningCue => {
    const cleanedText = cleanListeningSpokenText(cue.text);
    const unresolvedDelayCue = resolveCue(cue, sourceIndex);
    return {
      cleanedText,
      eligible: hasListeningSpokenContent(cleanedText),
      resolved: {
        ...unresolvedDelayCue,
        startMs: unresolvedDelayCue.startMs + learningDelayMs,
        endMs: unresolvedDelayCue.endMs + learningDelayMs,
      },
    };
  });
  const drafts = createListeningSegmentDrafts(preparedCues);
  const supportAlignment = createSupportAlignmentIndex(
    [...supportCues],
    supportDelaySeconds
  );

  return Promise.all(
    drafts.map(async (draft): Promise<ListeningPracticeSegment> => {
      const alignedSupport = supportAlignment.align(createSyntheticLearningCue(draft));
      return {
        answerText: draft.answerText,
        cleanedTextParts: [...draft.cleanedTextParts],
        endMs: draft.endMs,
        segmentKey: await createListeningSegmentKey({
          sourceKey,
          sourceIndices: draft.sourceIndices,
          cleanedTextParts: draft.cleanedTextParts,
        }),
        sourceIndices: [...draft.sourceIndices],
        sourceKey,
        startMs: draft.startMs,
        ...(alignedSupport
          ? {
              alignedSupport: {
                sourceIndices: alignedSupport.cues.map(({ sourceIndex }) => sourceIndex),
                text: alignedSupport.text,
              },
            }
          : {}),
      };
    })
  );
};

export const findListeningSegmentContainingTime = (
  catalog: readonly ListeningPracticeSegment[],
  currentTimeMs: number
) => {
  return catalog
    .filter(({ endMs, startMs }) => startMs <= currentTimeMs && currentTimeMs <= endMs)
    .sort(compareContainingSegments)[0];
};

export const findNextListeningSegmentInGap = (
  catalog: readonly ListeningPracticeSegment[],
  currentTimeMs: number
) => {
  return catalog
    .filter(({ startMs }) => startMs > currentTimeMs)
    .sort(compareSourceIntervals)[0];
};

export const findListeningStartSegment = (
  catalog: readonly ListeningPracticeSegment[],
  currentTimeMs: number
) => {
  return (
    findListeningSegmentContainingTime(catalog, currentTimeMs) ??
    findNextListeningSegmentInGap(catalog, currentTimeMs)
  );
};

export const findListeningContinueSegment = (
  catalog: readonly ListeningPracticeSegment[],
  progress: Readonly<Record<string, ListeningCatalogProgressItem>>
) => {
  return (
    catalog.find(({ segmentKey }) => progress[segmentKey] === undefined) ??
    catalog.find(({ segmentKey }) => progress[segmentKey]?.state === 'attempted') ??
    catalog[0]
  );
};

export const selectListeningMissionSegments = (
  catalog: readonly ListeningPracticeSegment[],
  start: ListeningSegmentKey | number
) => {
  const startIndex =
    typeof start === 'number'
      ? start
      : catalog.findIndex(({ segmentKey }) => segmentKey === start);

  if (!Number.isSafeInteger(startIndex) || startIndex < 0 || startIndex >= catalog.length) {
    return [];
  }

  return catalog.slice(startIndex, startIndex + LISTENING_MISSION_MAX_SEGMENTS);
};

const createListeningSegmentDrafts = (
  preparedCues: readonly PreparedListeningCue[]
): ListeningSegmentDraft[] => {
  const drafts: ListeningSegmentDraft[] = [];
  let sourceIndex = 0;

  while (sourceIndex < preparedCues.length) {
    const firstCue = preparedCues[sourceIndex];
    if (!firstCue.eligible) {
      sourceIndex += 1;
      continue;
    }

    const group = [firstCue];
    let nextSourceIndex = sourceIndex + 1;
    while (
      nextSourceIndex < preparedCues.length &&
      canAppendListeningCue(group, preparedCues[nextSourceIndex])
    ) {
      group.push(preparedCues[nextSourceIndex]);
      nextSourceIndex += 1;
    }

    const draft = prepareListeningSegmentDraft(group);
    if (isEligibleListeningSegment(draft)) drafts.push(draft);
    sourceIndex = nextSourceIndex;
  }

  return drafts;
};

const canAppendListeningCue = (
  group: readonly PreparedListeningCue[],
  nextCue: PreparedListeningCue
) => {
  if (!nextCue.eligible) return false;

  const answerText = joinCleanedText(group);
  if (completionPunctuationPattern.test(answerText)) return false;
  if (dialoguePrefixPattern.test(nextCue.cleanedText.trim())) return false;

  const currentCue = group.at(-1)!;
  if (uncoveredGapMs(currentCue.resolved, nextCue.resolved) > LISTENING_SEGMENT_LIMITS.MAX_GAP_MS) {
    return false;
  }

  const combinedGroup = [...group, nextCue];
  const { endMs, startMs } = getResolvedInterval(combinedGroup);
  if (closedIntervalDurationMs(startMs, endMs) > LISTENING_SEGMENT_LIMITS.MAX_DURATION_MS) {
    return false;
  }

  return countListeningGraphemes(joinCleanedText(combinedGroup)) <= LISTENING_SEGMENT_LIMITS.MAX_GRAPHEMES;
};

const prepareListeningSegmentDraft = (
  group: readonly PreparedListeningCue[]
): ListeningSegmentDraft => {
  const { endMs, startMs } = getResolvedInterval(group);
  return {
    answerText: joinCleanedText(group),
    cleanedTextParts: group.map(({ cleanedText }) => cleanedText),
    endMs,
    sourceIndices: group.map(({ resolved }) => resolved.sourceIndex),
    startMs,
  };
};

const isEligibleListeningSegment = (draft: ListeningSegmentDraft) => {
  const graphemeCount = countListeningGraphemes(draft.answerText);
  const durationMs = closedIntervalDurationMs(draft.startMs, draft.endMs);
  return (
    graphemeCount >= LISTENING_SEGMENT_LIMITS.MIN_GRAPHEMES &&
    graphemeCount <= LISTENING_SEGMENT_LIMITS.MAX_GRAPHEMES &&
    durationMs >= LISTENING_SEGMENT_LIMITS.MIN_DURATION_MS &&
    durationMs <= LISTENING_SEGMENT_LIMITS.MAX_DURATION_MS
  );
};

const joinCleanedText = (group: readonly PreparedListeningCue[]) => {
  return group.map(({ cleanedText }) => cleanedText).join(' ');
};

const getResolvedInterval = (group: readonly PreparedListeningCue[]) => ({
  startMs: Math.min(...group.map(({ resolved }) => resolved.startMs)),
  endMs: Math.max(...group.map(({ resolved }) => resolved.endMs)),
});

const createSyntheticLearningCue = (draft: ListeningSegmentDraft): ResolvedLearningCue => ({
  cue: {
    start: draft.startMs / 1000,
    end: draft.endMs / 1000,
    text: draft.answerText,
  },
  sourceIndex: draft.sourceIndices[0],
  startMs: draft.startMs,
  endMs: draft.endMs,
});

const uncoveredGapMs = (currentCue: ResolvedLearningCue, nextCue: ResolvedLearningCue) => {
  return Math.max(0, nextCue.startMs - currentCue.endMs - 1);
};

const closedIntervalDurationMs = (startMs: number, endMs: number) => endMs - startMs + 1;

const compareContainingSegments = (
  left: ListeningPracticeSegment,
  right: ListeningPracticeSegment
) => {
  return right.startMs - left.startMs || left.sourceIndices[0] - right.sourceIndices[0];
};

const compareSourceIntervals = (
  left: ListeningPracticeSegment,
  right: ListeningPracticeSegment
) => {
  return left.startMs - right.startMs || left.sourceIndices[0] - right.sourceIndices[0];
};
