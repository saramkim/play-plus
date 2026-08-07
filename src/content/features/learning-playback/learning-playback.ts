import { V2SubtitleCue } from '@storage/v2/type';
import { stripTags } from '@utils/helper';

export interface ResolvedLearningCue {
  cue: V2SubtitleCue;
  sourceIndex: number;
  startMs: number;
  endMs: number;
}

export type LearningCueCommand = 'previous' | 'next' | 'repeat-current' | 'save';

export type LearningCueCommandResult =
  | { status: 'resolved'; cue: ResolvedLearningCue }
  | { status: 'no-target-cue' }
  | { status: 'no-current-cue' };

interface ResolveLearningCueCommandInput {
  command: LearningCueCommand;
  cues: V2SubtitleCue[];
  currentTime: number;
  delaySeconds?: number;
}

export const resolveLearningCueCommand = ({
  command,
  cues,
  currentTime,
  delaySeconds = 0,
}: ResolveLearningCueCommandInput): LearningCueCommandResult => {
  const resolvedCues = resolveNonEmptyCues(cues, delaySeconds);
  const currentTimeMs = toMilliseconds(currentTime);
  const anchor = findLearningCueAnchor(resolvedCues, currentTimeMs);

  if (command === 'repeat-current' || command === 'save') {
    return anchor ? { status: 'resolved', cue: anchor } : { status: 'no-current-cue' };
  }

  const target = anchor
    ? findAdjacentCue(resolvedCues, anchor.sourceIndex, command)
    : findGapCue(resolvedCues, currentTimeMs, command);

  return target ? { status: 'resolved', cue: target } : { status: 'no-target-cue' };
};

export const resolveNonEmptyCues = (cues: V2SubtitleCue[], delaySeconds = 0): ResolvedLearningCue[] => {
  return cues.flatMap((cue, sourceIndex) => {
    if (stripTags(cue.text).length === 0) return [];
    return [resolveCue(cue, sourceIndex, delaySeconds)];
  });
};

export const resolveCue = (
  cue: V2SubtitleCue,
  sourceIndex: number,
  delaySeconds = 0
): ResolvedLearningCue => ({
  cue,
  sourceIndex,
  startMs: toMilliseconds(cue.start + delaySeconds),
  endMs: toMilliseconds(cue.end + delaySeconds),
});

export const toMilliseconds = (seconds: number) => Math.round(seconds * 1000);

const findLearningCueAnchor = (cues: ResolvedLearningCue[], currentTimeMs: number) => {
  return cues
    .filter(({ endMs, startMs }) => startMs <= currentTimeMs && currentTimeMs <= endMs)
    .sort((left, right) => right.startMs - left.startMs || left.sourceIndex - right.sourceIndex)[0];
};

const findAdjacentCue = (
  cues: ResolvedLearningCue[],
  anchorSourceIndex: number,
  command: 'previous' | 'next'
) => {
  const anchorIndex = cues.findIndex(({ sourceIndex }) => sourceIndex === anchorSourceIndex);
  return cues[anchorIndex + (command === 'previous' ? -1 : 1)];
};

const findGapCue = (
  cues: ResolvedLearningCue[],
  currentTimeMs: number,
  command: 'previous' | 'next'
) => {
  const candidates = cues.filter(({ endMs, startMs }) =>
    command === 'previous' ? endMs < currentTimeMs : startMs > currentTimeMs
  );

  return candidates.sort((left, right) => {
    const distanceOrder =
      command === 'previous' ? right.endMs - left.endMs : left.startMs - right.startMs;
    return distanceOrder || left.sourceIndex - right.sourceIndex;
  })[0];
};
