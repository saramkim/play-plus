import type { V2SubtitleCue } from '@storage/v2/type';
import { describe, expect, it } from 'vitest';

import {
  createLearningSubtitleOverviewCues,
  createSubtitleOverviewCues,
} from './subtitle-overview';

describe('subtitle overview cues', () => {
  it('strips markup, excludes empty text, and preserves source order and indices', () => {
    const cues: V2SubtitleCue[] = [
      { start: 5, end: 6, text: '<i>First &amp; cue</i>' },
      { start: 2, end: 3, text: ' <b> </b> ' },
      { start: 1, end: 2, text: '  Second cue  ' },
    ];

    expect(createSubtitleOverviewCues(cues, 0)).toEqual([
      { sourceIndex: 0, startTime: 5, endTime: 6, text: 'First & cue' },
      { sourceIndex: 2, startTime: 1, endTime: 2, text: 'Second cue' },
    ]);
  });

  it('applies delay exactly once and rounds effective boundaries to one millisecond', () => {
    const cues: V2SubtitleCue[] = [{ start: 1.2344, end: 2.3456, text: 'Delayed' }];

    expect(createSubtitleOverviewCues(cues, 0.1112)).toEqual([
      { sourceIndex: 0, startTime: 1.346, endTime: 2.457, text: 'Delayed' },
    ]);
    expect(createSubtitleOverviewCues(cues, -0.1112)).toEqual([
      { sourceIndex: 0, startTime: 1.123, endTime: 2.234, text: 'Delayed' },
    ]);
    expect(cues[0]).toEqual({ start: 1.2344, end: 2.3456, text: 'Delayed' });
  });

  it('aligns support text to each learning cue with source indices and sanitized text', () => {
    const learningCues: V2SubtitleCue[] = [
      { start: 0, end: 1, text: '<i>Learning one</i>' },
      { start: 5, end: 6, text: 'Learning two' },
    ];
    const supportCues: V2SubtitleCue[] = [
      { start: 0, end: 0.4, text: '<b>Support one</b>' },
      { start: 0.4, end: 1, text: 'Support two' },
    ];

    expect(createLearningSubtitleOverviewCues(learningCues, 0, supportCues, 0)).toEqual([
      {
        sourceIndex: 0,
        startTime: 0,
        endTime: 1,
        text: 'Learning one',
        alignedSupport: {
          sourceIndices: [0, 1],
          text: 'Support one\nSupport two',
        },
      },
      {
        sourceIndex: 1,
        startTime: 5,
        endTime: 6,
        text: 'Learning two',
      },
    ]);
  });

  it('applies each role delay once before support alignment', () => {
    const learningCues: V2SubtitleCue[] = [{ start: 1, end: 2, text: 'Learning' }];
    const supportCues: V2SubtitleCue[] = [{ start: 0, end: 1, text: 'Support' }];

    expect(createLearningSubtitleOverviewCues(learningCues, 1, supportCues, 2)).toEqual([
      {
        sourceIndex: 0,
        startTime: 2,
        endTime: 3,
        text: 'Learning',
        alignedSupport: { sourceIndices: [0], text: 'Support' },
      },
    ]);
  });

  it('sanitizes every support cue only once for a large overview snapshot', () => {
    const cueCount = 250;
    let supportTextReads = 0;
    const learningCues = Array.from({ length: cueCount }, (_, index) => ({
      start: index * 10,
      end: index * 10 + 1,
      text: `Learning ${index}`,
    }));
    const supportCues = Array.from({ length: cueCount }, (_, index) => {
      const supportCue = {
        start: index * 10,
        end: index * 10 + 1,
      } as V2SubtitleCue;
      Object.defineProperty(supportCue, 'text', {
        enumerable: true,
        get: () => {
          supportTextReads += 1;
          return `<i>Support ${index}</i>`;
        },
      });
      return supportCue;
    });

    const result = createLearningSubtitleOverviewCues(
      learningCues,
      0,
      supportCues,
      0
    );

    expect(result).toHaveLength(cueCount);
    expect(result.at(-1)?.alignedSupport?.text).toBe(`Support ${cueCount - 1}`);
    expect(supportTextReads).toBe(cueCount);
  });
});
