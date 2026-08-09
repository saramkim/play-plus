import { listeningProgressSchema, listeningSegmentKeySchema } from '@storage/v2/schema';
import type { ListeningProgressV1 } from '@storage/v2/type';
import { describe, expect, it } from 'vitest';


import {
  selectContinueSegmentKeys,
  selectCurrentSegmentKeys,
  selectNextMissionSegmentKeys,
  summarizeListeningProgress,
  type ReadyListeningCatalog,
} from './listening-flow-model';

describe('Listening flow selection', () => {
  it('uses earliest unrecorded, then earliest attempted, then first for Continue', () => {
    const catalog = createCatalog(12);

    expect(selectContinueSegmentKeys(catalog, progressWith({ [segmentKey(0)]: 'mastered' }))).toEqual(
      segmentKeys(1, 10)
    );
    expect(
      selectContinueSegmentKeys(
        catalog,
        progressWith({
          [segmentKey(0)]: 'cleared',
          [segmentKey(1)]: 'mastered',
          [segmentKey(2)]: 'attempted',
          [segmentKey(3)]: 'cleared',
          [segmentKey(4)]: 'cleared',
          [segmentKey(5)]: 'cleared',
          [segmentKey(6)]: 'cleared',
          [segmentKey(7)]: 'cleared',
          [segmentKey(8)]: 'cleared',
          [segmentKey(9)]: 'cleared',
          [segmentKey(10)]: 'cleared',
          [segmentKey(11)]: 'cleared',
        })
      )
    ).toEqual(segmentKeys(2, 10));
    expect(
      selectContinueSegmentKeys(
        catalog,
        progressWith(Object.fromEntries(segmentKeys(0, 12).map((key) => [key, 'cleared'])))
      )
    ).toEqual(segmentKeys(0, 10));
  });

  it('selects the latest-start containing line, then the next gap line, and none after the track', () => {
    const baseCatalog = createCatalog(4);
    const catalog: ReadyListeningCatalog = {
      ...baseCatalog,
      segments: baseCatalog.segments.map((segment, index) => {
        if (index === 1) return { ...segment, endMs: 3500 };
        if (index === 2) return { ...segment, startMs: 2500 };
        return segment;
      }),
    };

    expect(selectCurrentSegmentKeys({ ...catalog, currentTime: 2.6 })[0]).toBe(segmentKey(2));
    expect(selectCurrentSegmentKeys({ ...catalog, currentTime: 1.9 })[0]).toBe(segmentKey(1));
    expect(selectCurrentSegmentKeys({ ...catalog, currentTime: 20 })).toEqual([]);
  });

  it('uses the line after the prior final key for Next 10 and falls back safely after refresh', () => {
    const catalog = createCatalog(12);

    expect(selectNextMissionSegmentKeys(catalog, EMPTY_PROGRESS, segmentKey(8))).toEqual(
      segmentKeys(9, 3)
    );
    expect(selectNextMissionSegmentKeys(catalog, EMPTY_PROGRESS, segmentKey(11))).toEqual([]);
    expect(selectNextMissionSegmentKeys(catalog, EMPTY_PROGRESS, segmentKey(99))).toEqual(
      segmentKeys(0, 10)
    );
  });

  it('summarizes only current catalog keys in the exact namespace', () => {
    const catalog = createCatalog(3);
    const progress = progressWith({
      [segmentKey(0)]: 'attempted',
      [segmentKey(1)]: 'cleared',
      [segmentKey(2)]: 'mastered',
      [segmentKey(99)]: 'mastered',
    });

    expect(summarizeListeningProgress(catalog, progress)).toEqual({
      bestCombo: 7,
      cleared: 2,
      lastPracticedAt: '2026-08-09T12:00:00+00:00',
      mastered: 1,
      total: 3,
    });
    expect(
      summarizeListeningProgress(
        { ...catalog, sourceKey: 'native:ko' },
        progress
      )
    ).toEqual({ bestCombo: 0, cleared: 0, lastPracticedAt: undefined, mastered: 0, total: 3 });
  });
});

const createCatalog = (count: number): ReadyListeningCatalog => ({
  currentTime: 0,
  identity: {
    contentInstanceId: 'content-a',
    routeChangedAt: 1,
    videoId: 'video-a',
    videoRevision: 1,
  },
  segmenterVersion: 1,
  segments: Array.from({ length: count }, (_, index) => ({
    endMs: index * 1000 + 800,
    segmentKey: segmentKey(index),
    startMs: index * 1000,
  })),
  sourceKey: 'native:en',
  status: 'ready',
  subtitleRevision: 2,
  supportAvailable: true,
  videoId: 'video-a',
});

const segmentKeys = (start: number, count: number) =>
  Array.from({ length: count }, (_, index) => segmentKey(start + index));

const segmentKey = (index: number) =>
  listeningSegmentKeySchema.parse(`segment-v1-${index.toString(16).padStart(64, '0')}`);

const progressWith = (states: Record<string, 'attempted' | 'cleared' | 'mastered'>): ListeningProgressV1 => listeningProgressSchema.parse({
  version: 1,
  videos: {
    'video-a': {
      sources: {
        'native:en': {
          bestCombo: 7,
          items: Object.fromEntries(
            Object.entries(states).map(([segmentKey, state]) => [
              segmentKey,
              {
                lastPracticedAt: '2026-08-09T12:00:00+00:00',
                state,
                totalAttempts: state === 'attempted' ? 0 : 1,
              },
            ])
          ),
          lastPracticedAt: '2026-08-09T12:00:00+00:00',
          segmenterVersion: 1,
        },
      },
    },
  },
});

const EMPTY_PROGRESS: ListeningProgressV1 = { version: 1, videos: {} };
