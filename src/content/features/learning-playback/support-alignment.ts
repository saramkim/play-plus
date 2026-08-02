import { V2SubtitleCue } from '@storage/v2/type';

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

export const alignSupportCues = ({
  learningCue,
  supportCues,
  supportDelaySeconds = 0,
}: AlignSupportCuesInput): SupportAlignment | undefined => {
  const candidates = createSupportCandidates(supportCues, supportDelaySeconds)
    .filter((candidate) => isWithinSupportWindow(learningCue, candidate))
    .map((candidate) => scoreCandidate(learningCue, candidate))
    .filter(({ score }) => score >= SUPPORT_ALIGNMENT.SCORE_THRESHOLD)
    .sort(compareSupportAlignments);

  return candidates[0];
};

const createSupportCandidates = (cues: V2SubtitleCue[], delaySeconds: number) => {
  const candidates: ResolvedLearningCue[][] = [];

  for (let startIndex = 0; startIndex < cues.length; startIndex += 1) {
    const firstCue = cues[startIndex];
    if (firstCue.text.trim().length === 0) continue;

    const group = [resolveCue(firstCue, startIndex, delaySeconds)];
    candidates.push([...group]);

    for (
      let sourceIndex = startIndex + 1;
      sourceIndex < cues.length && group.length < SUPPORT_ALIGNMENT.MAX_CUE_COUNT;
      sourceIndex += 1
    ) {
      const nextCue = cues[sourceIndex];
      if (nextCue.text.trim().length === 0) break;

      const resolvedNext = resolveCue(nextCue, sourceIndex, delaySeconds);
      if (internalGap(group.at(-1)!, resolvedNext) > SUPPORT_ALIGNMENT.MAX_INTERNAL_GAP_MS) break;

      group.push(resolvedNext);
      candidates.push([...group]);
    }
  }

  return candidates;
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
  cues: ResolvedLearningCue[]
): SupportAlignment => {
  const group = getGroupInterval(cues);
  const learningDuration = intervalDuration(learningCue.startMs, learningCue.endMs);
  const groupDuration = intervalDuration(group.startMs, group.endMs);
  const overlapDurationMs = Math.max(
    0,
    Math.min(learningCue.endMs, group.endMs) - Math.max(learningCue.startMs, group.startMs) + 1
  );
  const unionDuration = learningDuration + groupDuration - overlapDurationMs;
  const overlapIoU = overlapDurationMs / unionDuration;
  const centerDistanceMs = Math.abs(
    (learningCue.startMs + learningCue.endMs) / 2 - (group.startMs + group.endMs) / 2
  );
  const centerProximity = 1 - Math.min(centerDistanceMs / SUPPORT_ALIGNMENT.WINDOW_MS, 1);
  const totalInternalGapMs = cues.slice(1).reduce((total, cue, index) => {
    return total + internalGap(cues[index], cue);
  }, 0);
  const compactness = 1 - Math.min(totalInternalGapMs / groupDuration, 1);
  const rawScore =
    SUPPORT_ALIGNMENT.WEIGHTS.OVERLAP_IOU * overlapIoU +
    SUPPORT_ALIGNMENT.WEIGHTS.CENTER_PROXIMITY * centerProximity +
    SUPPORT_ALIGNMENT.WEIGHTS.COMPACTNESS * compactness;

  return {
    cues,
    text: cues.map(({ cue }) => cue.text).join('\n'),
    score: roundScore(rawScore),
    overlapDurationMs,
    centerDistanceMs,
  };
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
