import type { V2SubtitleCue } from '@storage/v2/type';
import { stripTags, toFixedTime } from '@utils/helper';

export interface RegisteredSubtitlePreviewCue {
  endTime: number;
  sourceIndex: number;
  startTime: number;
  text: string;
}

export const createRegisteredSubtitlePreviewCues = (
  cues: V2SubtitleCue[],
  delaySeconds: number
): RegisteredSubtitlePreviewCue[] =>
  cues.flatMap((cue, sourceIndex) => {
    const text = stripTags(cue.text);
    if (text.length === 0) return [];

    return [
      {
        endTime: toFixedTime(cue.end + delaySeconds) / 1000,
        sourceIndex,
        startTime: toFixedTime(cue.start + delaySeconds) / 1000,
        text,
      },
    ];
  });

export const filterRegisteredSubtitlePreviewCues = (
  cues: RegisteredSubtitlePreviewCue[],
  searchText: string
) => {
  const query = searchText.trim().toLowerCase();
  if (query === '') return cues;
  return cues.filter(({ text }) => text.toLowerCase().includes(query));
};

export const getRegisteredSubtitlePreviewTimeRange = (
  cues: RegisteredSubtitlePreviewCue[]
) => {
  if (cues.length === 0) return undefined;

  return cues.reduce(
    (range, cue) => ({
      endTime: Math.max(range.endTime, cue.endTime),
      startTime: Math.min(range.startTime, cue.startTime),
    }),
    { endTime: cues[0].endTime, startTime: cues[0].startTime }
  );
};
