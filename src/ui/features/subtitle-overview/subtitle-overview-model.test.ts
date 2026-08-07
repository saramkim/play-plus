import type { SubtitleOverviewCue } from '@utils/message/type';
import { describe, expect, it } from 'vitest';

import {
  createSubtitleOverviewRows,
  filterSubtitleOverviewCues,
  filterSubtitleOverviewRows,
  findActiveSubtitleOverviewCue,
  findActiveSubtitleOverviewRow,
  getSubtitleOverviewRowTimeRange,
  getSubtitleOverviewTimeRange,
  isSameContentVideoIdentity,
} from './subtitle-overview-model';
import type { SubtitleOverviewTracksLike } from './subtitle-overview-model';

const cues: SubtitleOverviewCue[] = [
  { sourceIndex: 0, startTime: 1, endTime: 2, text: ' First sentence ' },
  { sourceIndex: 1, startTime: 3, endTime: 4, text: 'SECOND sentence' },
  { sourceIndex: 2, startTime: 5, endTime: 6, text: '   ' },
];

const tracks: SubtitleOverviewTracksLike = {
  learning: {
    cues: [
      {
        sourceIndex: 4,
        startTime: 3,
        endTime: 5,
        text: 'First learning cue',
        alignedSupport: {
          sourceIndices: [10, 11],
          text: '첫 번째 도움 자막',
        },
      },
      {
        sourceIndex: 7,
        startTime: 8,
        endTime: 9,
        text: 'Second learning cue',
      },
    ],
  },
  support: {
    cues: [
      { sourceIndex: 10, startTime: 2, endTime: 4, text: 'First support cue' },
      { sourceIndex: 11, startTime: 4, endTime: 6, text: 'Second support cue' },
      { sourceIndex: 12, startTime: 10, endTime: 12, text: 'Unpaired support cue' },
    ],
  },
};

describe('subtitle overview model', () => {
  it('builds together and learning rows from every learning cue in source order', () => {
    const togetherRows = createSubtitleOverviewRows(tracks, 'together');
    const learningRows = createSubtitleOverviewRows(tracks, 'learning');

    expect(togetherRows.map(({ key }) => key)).toEqual(['learning:4', 'learning:7']);
    expect(togetherRows[0]).toMatchObject({
      alignedSupport: {
        sourceIndices: [10, 11],
        text: '첫 번째 도움 자막',
      },
      anchorRole: 'learning',
      learningSourceIndex: 4,
    });
    expect(togetherRows[1].alignedSupport).toBeUndefined();
    expect(learningRows.map(({ key }) => key)).toEqual(['learning:4', 'learning:7']);
    expect(learningRows.every(({ alignedSupport }) => alignedSupport === undefined)).toBe(true);
  });

  it('builds support rows from the full support track, including unpaired cues', () => {
    const supportRows = createSubtitleOverviewRows(tracks, 'support');

    expect(supportRows.map(({ key }) => key)).toEqual([
      'support:10',
      'support:11',
      'support:12',
    ]);
    expect(supportRows.every(({ anchorRole }) => anchorRole === 'support')).toBe(true);
    expect(supportRows.every(({ learningSourceIndex }) => learningSourceIndex === undefined)).toBe(
      true
    );
    expect(createSubtitleOverviewRows({ ...tracks, support: null }, 'support')).toEqual([]);
  });

  it('searches every visible row text without reordering the mode rows', () => {
    const togetherRows = createSubtitleOverviewRows(tracks, 'together');
    const learningRows = createSubtitleOverviewRows(tracks, 'learning');

    expect(filterSubtitleOverviewRows(togetherRows, '  도움 자막 ')).toEqual([
      togetherRows[0],
    ]);
    expect(filterSubtitleOverviewRows(learningRows, '도움 자막')).toEqual([]);
    expect(filterSubtitleOverviewRows(togetherRows, 'LEARNING CUE')).toEqual(togetherRows);
  });

  it('uses the selected mode anchors for range, count, and current row', () => {
    const learningRows = createSubtitleOverviewRows(tracks, 'together');
    const supportRows = createSubtitleOverviewRows(tracks, 'support');

    expect(learningRows).toHaveLength(2);
    expect(getSubtitleOverviewRowTimeRange(learningRows)).toEqual({
      startTime: 3,
      endTime: 9,
    });
    expect(findActiveSubtitleOverviewRow(learningRows, 4)).toBe(learningRows[0]);

    expect(supportRows).toHaveLength(3);
    expect(getSubtitleOverviewRowTimeRange(supportRows)).toEqual({
      startTime: 2,
      endTime: 12,
    });
    expect(findActiveSubtitleOverviewRow(supportRows, 5)).toBe(supportRows[1]);
  });

  it('filters non-empty cue text with a trimmed case-insensitive substring without reordering', () => {
    expect(filterSubtitleOverviewCues(cues, '  SENTENCE ')).toEqual([cues[0], cues[1]]);
    expect(filterSubtitleOverviewCues(cues, 'second')).toEqual([cues[1]]);
    expect(filterSubtitleOverviewCues(cues, '   ')).toEqual([cues[0], cues[1]]);
  });

  it('uses 1ms closed intervals and returns no cue in a gap', () => {
    expect(findActiveSubtitleOverviewCue(cues, 1.0004)).toBe(cues[0]);
    expect(findActiveSubtitleOverviewCue(cues, 2.0004)).toBe(cues[0]);
    expect(findActiveSubtitleOverviewCue(cues, 2.001)).toBeUndefined();
  });

  it('prefers the latest start and then the lower source index for overlapping cues', () => {
    const overlapping: SubtitleOverviewCue[] = [
      { sourceIndex: 4, startTime: 1, endTime: 5, text: 'earlier' },
      { sourceIndex: 9, startTime: 2, endTime: 4, text: 'same start, higher index' },
      { sourceIndex: 3, startTime: 2, endTime: 3, text: 'same start, lower index' },
    ];

    expect(findActiveSubtitleOverviewCue(overlapping, 2.5)).toBe(overlapping[2]);
  });

  it('calculates the full effective time range independently of source ordering', () => {
    expect(
      getSubtitleOverviewTimeRange([
        { sourceIndex: 0, startTime: 8, endTime: 9, text: 'later' },
        { sourceIndex: 1, startTime: -1, endTime: 2, text: 'earlier' },
      ])
    ).toEqual({ startTime: -1, endTime: 9 });
    expect(getSubtitleOverviewTimeRange([])).toBeUndefined();
  });

  it('compares every content and video identity field', () => {
    const identity = {
      contentInstanceId: 'content-a',
      routeChangedAt: 10,
      videoId: 'video-a',
      videoRevision: 2,
    };

    expect(isSameContentVideoIdentity(identity, { ...identity })).toBe(true);
    expect(isSameContentVideoIdentity(identity, { ...identity, videoRevision: 3 })).toBe(false);
    expect(isSameContentVideoIdentity(identity, { ...identity, routeChangedAt: 11 })).toBe(false);
  });
});
