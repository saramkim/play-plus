import type { V2SubtitleCue } from '@storage/v2/type';
import { describe, expect, it } from 'vitest';

import {
  createRegisteredSubtitlePreviewCues,
  filterRegisteredSubtitlePreviewCues,
  getRegisteredSubtitlePreviewTimeRange,
} from './registered-subtitle-preview-model';

describe('registered subtitle preview model', () => {
  it('creates canonical plain text in source order and applies metadata delay once', () => {
    const cues: V2SubtitleCue[] = [
      { start: 5.1234, end: 6.2346, text: '<i>First &amp; cue</i>' },
      { start: 2, end: 3, text: ' <b> </b> ' },
      { start: 1, end: 2, text: '  Second cue  ' },
    ];

    expect(createRegisteredSubtitlePreviewCues(cues, -0.1112)).toEqual([
      {
        endTime: 6.123,
        sourceIndex: 0,
        startTime: 5.012,
        text: 'First & cue',
      },
      {
        endTime: 1.889,
        sourceIndex: 2,
        startTime: 0.889,
        text: 'Second cue',
      },
    ]);
    expect(cues[0]).toEqual({
      start: 5.1234,
      end: 6.2346,
      text: '<i>First &amp; cue</i>',
    });
  });

  it('filters trimmed case-insensitive text without changing source order', () => {
    const cues = createRegisteredSubtitlePreviewCues(
      [
        { start: 4, end: 5, text: 'Alpha first' },
        { start: 1, end: 2, text: 'Beta' },
        { start: 3, end: 4, text: 'Another ALPHA' },
      ],
      0
    );

    expect(filterRegisteredSubtitlePreviewCues(cues, '  alpha ')).toEqual([
      cues[0],
      cues[2],
    ]);
    expect(filterRegisteredSubtitlePreviewCues(cues, '')).toBe(cues);
  });

  it('reports the complete effective range and handles an empty preview', () => {
    const cues = createRegisteredSubtitlePreviewCues(
      [
        { start: 5, end: 7, text: 'First in source order' },
        { start: 1, end: 3, text: 'Earlier cue' },
      ],
      0.5
    );

    expect(getRegisteredSubtitlePreviewTimeRange(cues)).toEqual({
      endTime: 7.5,
      startTime: 1.5,
    });
    expect(getRegisteredSubtitlePreviewTimeRange([])).toBeUndefined();
  });
});
