import { listeningProgressSchema, listeningSegmentKeySchema } from '@storage/v2/schema';
import type { ListeningProgressV1 } from '@storage/v2/type';
import { describe, expect, it } from 'vitest';


import {
  selectPastSegmentKeys,
  selectCurrentSegmentKeys,
  summarizeListeningProgress,
  type ReadyListeningCatalog,
} from './listening-flow-model';

describe('Listening flow selection', () => {
  it('selects only a recently completed whole segment, never a containing or future segment', () => {
    const catalog = createCatalog(4);
    expect(selectCurrentSegmentKeys({ ...catalog, currentTime: 0.5 })).toEqual([]);
    expect(selectCurrentSegmentKeys({ ...catalog, currentTime: 0.8 })).toEqual([segmentKey(0)]);
    expect(selectCurrentSegmentKeys({ ...catalog, currentTime: 1.5 })).toEqual([segmentKey(0)]);
    expect(selectCurrentSegmentKeys({ ...catalog, currentTime: 13.8 })).toEqual([segmentKey(3)]);
    expect(selectCurrentSegmentKeys({ ...catalog, currentTime: 13.801 })).toEqual([]);
    expect(selectCurrentSegmentKeys({ ...catalog, currentTime: 20 })).toEqual([]);
  });

  it('uses latest end then latest start with stable source order for overlaps', () => {
    const base = createCatalog(4);
    const catalog = { ...base, currentTime: 5, segments: base.segments.map((segment, index) => ({
      ...segment, startMs: index === 0 ? 1000 : 2000, endMs: index === 3 ? 5500 : 4000,
    })) };
    expect(selectCurrentSegmentKeys(catalog)).toEqual([segmentKey(1)]);
    expect(selectPastSegmentKeys(catalog)).toEqual(segmentKeys(0, 3));
  });

  it('bounds past candidates and does not include partly finished groups', () => {
    const catalog = createCatalog(20_005);
    const keys = selectPastSegmentKeys({ ...catalog, currentTime: 20_004.5 });
    expect(keys).toHaveLength(20_000);
    expect(keys[0]).toBe(segmentKey(4));
    expect(keys.at(-1)).toBe(segmentKey(20_003));
  });

  it('retains the nearest default even when a large source has out-of-order timings', () => {
    const catalog = createCatalog(20_005);
    const reordered = { ...catalog, currentTime: 30_000, segments: catalog.segments.map((segment, index) =>
      index === 0 ? { ...segment, startMs: 29_998_000, endMs: 29_999_000 } : segment) };
    const current = selectCurrentSegmentKeys(reordered)[0];
    expect(current).toBe(segmentKey(0));
    expect(selectPastSegmentKeys(reordered)).toContain(current);
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
    contentEpoch: 1,
    contentInstanceId: 'content-a',
    routeChangedAt: 1,
    videoId: '123e4567-e89b-12d3-a456-426614174030',
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
  videoId: '123e4567-e89b-12d3-a456-426614174030',
});

const segmentKeys = (start: number, count: number) =>
  Array.from({ length: count }, (_, index) => segmentKey(start + index));

const segmentKey = (index: number) =>
  listeningSegmentKeySchema.parse(`segment-v1-${index.toString(16).padStart(64, '0')}`);

const progressWith = (states: Record<string, 'attempted' | 'cleared' | 'mastered'>): ListeningProgressV1 => listeningProgressSchema.parse({
  version: 1,
  videos: {
    '123e4567-e89b-12d3-a456-426614174030': {
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
