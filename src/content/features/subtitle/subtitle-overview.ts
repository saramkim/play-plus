import type { V2SubtitleCue } from '@storage/v2/type';
import { stripTags, toFixedTime } from '@utils/helper';
import type {
  SubtitleOverviewCue,
  SubtitleOverviewLearningCue,
} from '@utils/message/type';

import { resolveCue } from '@/content/features/learning-playback/learning-playback';
import { createSupportAlignmentIndex } from '@/content/features/learning-playback/support-alignment';

export const createSubtitleOverviewCues = (
  cues: V2SubtitleCue[],
  delaySeconds: number
): SubtitleOverviewCue[] => {
  return cues.flatMap((cue, sourceIndex) => {
    const text = stripTags(cue.text);
    if (text.length === 0) return [];

    return [
      {
        sourceIndex,
        startTime: toFixedTime(cue.start + delaySeconds) / 1000,
        endTime: toFixedTime(cue.end + delaySeconds) / 1000,
        text,
      },
    ];
  });
};

export const createLearningSubtitleOverviewCues = (
  learningCues: V2SubtitleCue[],
  learningDelaySeconds: number,
  supportCues: V2SubtitleCue[] = [],
  supportDelaySeconds = 0
): SubtitleOverviewLearningCue[] => {
  const supportAlignmentIndex = createSupportAlignmentIndex(
    supportCues,
    supportDelaySeconds
  );

  return learningCues.flatMap((cue, sourceIndex) => {
    const text = stripTags(cue.text);
    if (text.length === 0) return [];

    const alignedSupport = supportAlignmentIndex.align(
      resolveCue(cue, sourceIndex, learningDelaySeconds)
    );

    return [
      {
        sourceIndex,
        startTime: toFixedTime(cue.start + learningDelaySeconds) / 1000,
        endTime: toFixedTime(cue.end + learningDelaySeconds) / 1000,
        text,
        ...(alignedSupport
          ? {
              alignedSupport: {
                sourceIndices: alignedSupport.cues.map(({ sourceIndex }) => sourceIndex),
                text: alignedSupport.text,
              },
            }
          : {}),
      },
    ];
  });
};
