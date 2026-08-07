import { V2SubtitleCue } from '@storage/v2/type';
import { stripTags } from '@utils/helper';

import { ResolvedLearningCue, resolveCue } from '@/content/features/learning-playback/learning-playback';

export const SUPPORT_ALIGNMENT = {
  MAX_CUE_COUNT: 3,
  MAX_INTERNAL_GAP_MS: 750,
  WINDOW_MS: 3000,
  SCORE_THRESHOLD: 0.55,
  SCORE_DECIMALS: 6,
  WEIGHTS: {
    OVERLAP_IOU: 0.7,
    CENTER_PROXIMITY: 0.2,
    COMPACTNESS: 0.1,
  },
} as const;

export interface SupportAlignment {
  cues: ResolvedLearningCue[];
  text: string;
  score: number;
  overlapDurationMs: number;
  centerDistanceMs: number;
}

interface AlignSupportCuesInput {
  learningCue: ResolvedLearningCue;
  supportCues: V2SubtitleCue[];
  supportDelaySeconds?: number;
}

interface PreparedSupportCandidate {
  cues: ResolvedLearningCue[];
  endMs: number;
  groupDurationMs: number;
  startMs: number;
  text: string;
  totalInternalGapMs: number;
}

interface SupportCandidateTimeIndex {
  candidates: PreparedSupportCandidate[];
  leafCount: number;
  maxEndMs: number[];
}

export interface SupportAlignmentIndex {
  align: (learningCue: ResolvedLearningCue) => SupportAlignment | undefined;
}

export const alignSupportCues = ({
  learningCue,
  supportCues,
  supportDelaySeconds = 0,
}: AlignSupportCuesInput): SupportAlignment | undefined => {
  return createSupportAlignmentIndex(supportCues, supportDelaySeconds).align(learningCue);
};

export const createSupportAlignmentIndex = (
  supportCues: V2SubtitleCue[],
  supportDelaySeconds = 0
): SupportAlignmentIndex => {
  const timeIndex = createSupportCandidateTimeIndex(
    createSupportCandidates(supportCues, supportDelaySeconds)
  );

  return {
    align: (learningCue) => selectSupportAlignment(learningCue, timeIndex),
  };
};

const createSupportCandidates = (cues: V2SubtitleCue[], delaySeconds: number) => {
  const resolvedCues = cues.map((cue, sourceIndex) =>
    resolveSupportCue(cue, sourceIndex, delaySeconds)
  );
  const candidates: PreparedSupportCandidate[] = [];

  for (let startIndex = 0; startIndex < cues.length; startIndex += 1) {
    const firstCue = resolvedCues[startIndex];
    if (!firstCue) continue;

    const group = [firstCue];
    candidates.push(prepareSupportCandidate(group));

    for (
      let sourceIndex = startIndex + 1;
      sourceIndex < cues.length && group.length < SUPPORT_ALIGNMENT.MAX_CUE_COUNT;
      sourceIndex += 1
    ) {
      const nextCue = resolvedCues[sourceIndex];
      if (!nextCue) break;

      if (internalGap(group.at(-1)!, nextCue) > SUPPORT_ALIGNMENT.MAX_INTERNAL_GAP_MS) break;

      group.push(nextCue);
      candidates.push(prepareSupportCandidate(group));
    }
  }

  return candidates;
};

const prepareSupportCandidate = (
  cues: ResolvedLearningCue[]
): PreparedSupportCandidate => {
  const { endMs, startMs } = getGroupInterval(cues);
  const totalInternalGapMs = cues.slice(1).reduce((total, cue, index) => {
    return total + internalGap(cues[index], cue);
  }, 0);

  return {
    cues: [...cues],
    endMs,
    groupDurationMs: intervalDuration(startMs, endMs),
    startMs,
    text: cues.map(({ cue }) => cue.text).join('\n'),
    totalInternalGapMs,
  };
};

const resolveSupportCue = (cue: V2SubtitleCue, sourceIndex: number, delaySeconds: number) => {
  const text = stripTags(cue.text);
  if (text.length === 0) return undefined;
  return resolveCue(
    {
      start: cue.start,
      end: cue.end,
      text,
      ...(cue.settings ? { settings: cue.settings } : {}),
    },
    sourceIndex,
    delaySeconds
  );
};

export const isWithinSupportWindow = (
  learningCue: ResolvedLearningCue,
  cues: ResolvedLearningCue[]
) => {
  const { endMs, startMs } = getGroupInterval(cues);
  return (
    startMs <= learningCue.endMs + SUPPORT_ALIGNMENT.WINDOW_MS &&
    endMs >= learningCue.startMs - SUPPORT_ALIGNMENT.WINDOW_MS
  );
};

const scoreCandidate = (
  learningCue: ResolvedLearningCue,
  candidate: PreparedSupportCandidate
): SupportAlignment => {
  const learningDuration = intervalDuration(learningCue.startMs, learningCue.endMs);
  const overlapDurationMs = Math.max(
    0,
    Math.min(learningCue.endMs, candidate.endMs) -
      Math.max(learningCue.startMs, candidate.startMs) +
      1
  );
  const unionDuration = learningDuration + candidate.groupDurationMs - overlapDurationMs;
  const overlapIoU = overlapDurationMs / unionDuration;
  const centerDistanceMs = Math.abs(
    (learningCue.startMs + learningCue.endMs) / 2 -
      (candidate.startMs + candidate.endMs) / 2
  );
  const centerProximity = 1 - Math.min(centerDistanceMs / SUPPORT_ALIGNMENT.WINDOW_MS, 1);
  const compactness =
    1 - Math.min(candidate.totalInternalGapMs / candidate.groupDurationMs, 1);
  const rawScore =
    SUPPORT_ALIGNMENT.WEIGHTS.OVERLAP_IOU * overlapIoU +
    SUPPORT_ALIGNMENT.WEIGHTS.CENTER_PROXIMITY * centerProximity +
    SUPPORT_ALIGNMENT.WEIGHTS.COMPACTNESS * compactness;

  return {
    cues: candidate.cues,
    text: candidate.text,
    score: roundScore(rawScore),
    overlapDurationMs,
    centerDistanceMs,
  };
};

const selectSupportAlignment = (
  learningCue: ResolvedLearningCue,
  timeIndex: SupportCandidateTimeIndex
) => {
  let best: SupportAlignment | undefined;
  for (const candidate of findSupportCandidates(learningCue, timeIndex)) {
    const alignment = scoreCandidate(learningCue, candidate);
    if (alignment.score < SUPPORT_ALIGNMENT.SCORE_THRESHOLD) continue;
    if (!best || compareSupportAlignments(alignment, best) < 0) best = alignment;
  }
  return best;
};

const createSupportCandidateTimeIndex = (
  candidates: PreparedSupportCandidate[]
): SupportCandidateTimeIndex => {
  const sortedCandidates = [...candidates].sort(
    (left, right) =>
      left.startMs - right.startMs ||
      left.endMs - right.endMs ||
      left.cues[0].sourceIndex - right.cues[0].sourceIndex ||
      left.cues.length - right.cues.length
  );
  let leafCount = 1;
  while (leafCount < sortedCandidates.length) leafCount *= 2;

  const maxEndMs = Array<number>(leafCount * 2).fill(Number.NEGATIVE_INFINITY);
  for (let index = 0; index < sortedCandidates.length; index += 1) {
    maxEndMs[leafCount + index] = sortedCandidates[index].endMs;
  }
  for (let node = leafCount - 1; node > 0; node -= 1) {
    maxEndMs[node] = Math.max(maxEndMs[node * 2], maxEndMs[node * 2 + 1]);
  }

  return { candidates: sortedCandidates, leafCount, maxEndMs };
};

const findSupportCandidates = (
  learningCue: ResolvedLearningCue,
  timeIndex: SupportCandidateTimeIndex
) => {
  const latestStartMs = learningCue.endMs + SUPPORT_ALIGNMENT.WINDOW_MS;
  const earliestEndMs = learningCue.startMs - SUPPORT_ALIGNMENT.WINDOW_MS;
  const lastCandidateIndex =
    upperBoundByStart(timeIndex.candidates, latestStartMs) - 1;
  if (lastCandidateIndex < 0) return [];

  const matches: PreparedSupportCandidate[] = [];
  collectCandidatesWithEndAtOrAfter(
    timeIndex,
    1,
    0,
    timeIndex.leafCount - 1,
    lastCandidateIndex,
    earliestEndMs,
    matches
  );
  return matches;
};

const upperBoundByStart = (
  candidates: PreparedSupportCandidate[],
  latestStartMs: number
) => {
  let lower = 0;
  let upper = candidates.length;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (candidates[middle].startMs <= latestStartMs) lower = middle + 1;
    else upper = middle;
  }
  return lower;
};

const collectCandidatesWithEndAtOrAfter = (
  timeIndex: SupportCandidateTimeIndex,
  node: number,
  left: number,
  right: number,
  lastCandidateIndex: number,
  earliestEndMs: number,
  matches: PreparedSupportCandidate[]
) => {
  if (
    left > lastCandidateIndex ||
    timeIndex.maxEndMs[node] < earliestEndMs
  ) {
    return;
  }
  if (left === right) {
    const candidate = timeIndex.candidates[left];
    if (candidate) matches.push(candidate);
    return;
  }

  const middle = Math.floor((left + right) / 2);
  collectCandidatesWithEndAtOrAfter(
    timeIndex,
    node * 2,
    left,
    middle,
    lastCandidateIndex,
    earliestEndMs,
    matches
  );
  collectCandidatesWithEndAtOrAfter(
    timeIndex,
    node * 2 + 1,
    middle + 1,
    right,
    lastCandidateIndex,
    earliestEndMs,
    matches
  );
};

export const compareSupportAlignments = (left: SupportAlignment, right: SupportAlignment) => {
  return (
    right.score - left.score ||
    right.overlapDurationMs - left.overlapDurationMs ||
    left.centerDistanceMs - right.centerDistanceMs ||
    left.cues.length - right.cues.length ||
    left.cues[0].sourceIndex - right.cues[0].sourceIndex
  );
};

const getGroupInterval = (cues: ResolvedLearningCue[]) => ({
  startMs: Math.min(...cues.map(({ startMs }) => startMs)),
  endMs: Math.max(...cues.map(({ endMs }) => endMs)),
});

const intervalDuration = (startMs: number, endMs: number) => endMs - startMs + 1;

const internalGap = (previous: ResolvedLearningCue, next: ResolvedLearningCue) => {
  return Math.max(0, next.startMs - previous.endMs - 1);
};

const roundScore = (score: number) => {
  const precision = 10 ** SUPPORT_ALIGNMENT.SCORE_DECIMALS;
  return Math.round(score * precision) / precision;
};
