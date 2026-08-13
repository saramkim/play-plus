import { describe, expect, expectTypeOf, it } from 'vitest';

import { createDefaultListeningProgress } from './default';
import {
  createV2ListeningProgressStorage,
  ListeningMissionResult,
  V2ListeningProgressStorageArea,
} from './listening-progress-storage';
import {
  ListeningProgressState,
  ListeningProgressV1,
  ListeningSegmentKey,
  ListeningSourceKey,
} from './type';

const VIDEO_A = '123e4567-e89b-12d3-a456-426614174000';
const VIDEO_B = '123e4567-e89b-12d3-a456-426614174001';
const SOURCE_A: ListeningSourceKey = 'native:en';
const SOURCE_B: ListeningSourceKey =
  'registered:subtitle-11111111-1111-4111-8111-111111111111';
const SEGMENT_A = `segment-v1-${'a'.repeat(64)}` as ListeningSegmentKey;
const SEGMENT_B = `segment-v1-${'b'.repeat(64)}` as ListeningSegmentKey;
const EARLIER = '2026-08-09T01:00:00.000+12:00';
const PRACTICED_AT = '2026-08-09T02:00:00.000+12:00';
const LATER = '2026-08-09T03:00:00.000+12:00';

describe('v2 listening progress storage', () => {
  it('accepts the production Chrome local storage shape', () => {
    expectTypeOf(chrome.storage.local).toMatchTypeOf<V2ListeningProgressStorageArea>();
  });

  it('strictly reads the required progress key and fails when it is missing or invalid', async () => {
    await expect(createV2ListeningProgressStorage(new FakeLocalStorage()).get()).rejects.toThrow();
    await expect(
      createV2ListeningProgressStorage(
        new FakeLocalStorage({ listeningProgress: { version: 1, videos: {}, answer: 'forbidden' } })
      ).get()
    ).rejects.toThrow();
  });

  it('records a Later or Reveal-only attempted visit with zero submitted attempts', async () => {
    const storage = storageWithEmptyProgress();
    const api = createV2ListeningProgressStorage(storage);

    const progress = await api.recordMissionResult(
      missionResult({
        bestCombo: 0,
        items: [missionItem(SEGMENT_A, 'attempted', 0)],
      })
    );

    expect(progress.videos[VIDEO_A].sources[SOURCE_A]).toEqual({
      segmenterVersion: 1,
      bestCombo: 0,
      lastPracticedAt: PRACTICED_AT,
      items: {
        [SEGMENT_A]: {
          state: 'attempted',
          totalAttempts: 0,
          lastPracticedAt: PRACTICED_AT,
        },
      },
    });
    expect(storage.setCalls).toHaveLength(1);
    expect(storage.setCalls[0]).toEqual({ listeningProgress: progress });
  });

  it('accepts only valid mission-state and submitted-attempt combinations', async () => {
    const cases = [
      ['attempted', 0, true],
      ['attempted', 1, true],
      ['cleared', 0, false],
      ['cleared', 1, true],
      ['mastered', 0, false],
      ['mastered', 1, true],
    ] as const;

    for (const [achievedState, submittedAttemptIncrement, accepted] of cases) {
      const storage = storageWithEmptyProgress();
      const api = createV2ListeningProgressStorage(storage);
      const operation = api.recordMissionResult(
        missionResult({
          items: [missionItem(SEGMENT_A, achievedState, submittedAttemptIncrement)],
        })
      );

      if (accepted) {
        await expect(operation).resolves.toBeDefined();
        expect(storage.getCalls).toEqual(['listeningProgress']);
        expect(storage.setCalls).toHaveLength(1);
      } else {
        await expect(operation).rejects.toThrow();
        expect(storage.getCalls).toEqual([]);
        expect(storage.setCalls).toEqual([]);
      }
    }
  });

  it('records every segment in one full-object write', async () => {
    const storage = storageWithEmptyProgress();
    const api = createV2ListeningProgressStorage(storage);

    await api.recordMissionResult(
      missionResult({
        items: [missionItem(SEGMENT_A, 'cleared', 2), missionItem(SEGMENT_B, 'mastered', 1)],
      })
    );

    expect(storage.setCalls).toHaveLength(1);
    expect(
      Object.keys(
        (storage.values.listeningProgress as ListeningProgressV1).videos[VIDEO_A].sources[
          SOURCE_A
        ]!.items
      )
    ).toEqual([SEGMENT_A, SEGMENT_B]);
  });

  it('merges state monotonically, adds attempts, takes max combo, and keeps latest timestamps', async () => {
    const storage = storageWithEmptyProgress();
    const api = createV2ListeningProgressStorage(storage);

    await api.recordMissionResult(
      missionResult({
        practicedAt: PRACTICED_AT,
        bestCombo: 5,
        items: [missionItem(SEGMENT_A, 'mastered', 2)],
      })
    );
    await api.recordMissionResult(
      missionResult({
        practicedAt: EARLIER,
        bestCombo: 3,
        items: [missionItem(SEGMENT_A, 'attempted', 0)],
      })
    );
    const progress = await api.recordMissionResult(
      missionResult({
        practicedAt: LATER,
        bestCombo: 7,
        items: [missionItem(SEGMENT_A, 'cleared', 1)],
      })
    );

    expect(progress.videos[VIDEO_A].sources[SOURCE_A]).toEqual({
      segmenterVersion: 1,
      bestCombo: 7,
      lastPracticedAt: LATER,
      items: {
        [SEGMENT_A]: {
          state: 'mastered',
          totalAttempts: 3,
          lastPracticedAt: LATER,
        },
      },
    });
    expect(storage.setCalls).toHaveLength(3);
  });

  it('keeps an existing higher state and attempt count for attempted visits without submissions', async () => {
    for (const state of ['cleared', 'mastered'] as const) {
      const storage = new FakeLocalStorage({
        listeningProgress: progressWithItem({ state, totalAttempts: 2 }),
      });
      const api = createV2ListeningProgressStorage(storage);

      const progress = await api.recordMissionResult(
        missionResult({ items: [missionItem(SEGMENT_A, 'attempted', 0)] })
      );

      expect(progress.videos[VIDEO_A].sources[SOURCE_A]!.items[SEGMENT_A]).toMatchObject({
        state,
        totalAttempts: 2,
      });
      expect(storage.setCalls).toHaveLength(1);
    }
  });

  it('serializes concurrent mutations in invocation order', async () => {
    const storage = storageWithEmptyProgress();
    const api = createV2ListeningProgressStorage(storage);

    await Promise.all([
      api.recordMissionResult(
        missionResult({ items: [missionItem(SEGMENT_A, 'attempted', 1)] })
      ),
      api.recordMissionResult(
        missionResult({ items: [missionItem(SEGMENT_A, 'cleared', 2)] })
      ),
      api.recordMissionResult(
        missionResult({ items: [missionItem(SEGMENT_A, 'mastered', 3)] })
      ),
    ]);

    expect(
      storage.setCalls.map(
        ({ listeningProgress }) =>
          (listeningProgress as ListeningProgressV1).videos[VIDEO_A].sources[SOURCE_A]!.items[
            SEGMENT_A
          ]!.totalAttempts
      )
    ).toEqual([1, 3, 6]);
    expect(storage.getCalls).toEqual(['listeningProgress', 'listeningProgress', 'listeningProgress']);
  });

  it('serializes record, clear-video, and clear-all operations in invocation order', async () => {
    const storage = storageWithEmptyProgress();
    const api = createV2ListeningProgressStorage(storage);

    const [recorded, clearedVideo, recordedOther, clearedAll] = await Promise.all([
      api.recordMissionResult(missionResult()),
      api.clearVideo(VIDEO_A),
      api.recordMissionResult(
        missionResult({
          videoId: VIDEO_B,
          learningSourceKey: SOURCE_B,
          items: [missionItem(SEGMENT_B, 'cleared', 1)],
        })
      ),
      api.clearAll(),
    ]);

    expect(recorded.videos).toHaveProperty(VIDEO_A);
    expect(clearedVideo).toEqual(createDefaultListeningProgress());
    expect(recordedOther.videos).toHaveProperty(VIDEO_B);
    expect(clearedAll).toEqual(createDefaultListeningProgress());
    expect(storage.values.listeningProgress).toEqual(createDefaultListeningProgress());
    expect(storage.getCalls).toEqual([
      'listeningProgress',
      'listeningProgress',
      'listeningProgress',
      'listeningProgress',
    ]);
  });

  it('rejects invalid input without reading or writing', async () => {
    const invalidVideoIds = [
      '',
      ' ',
      'video-a',
      `https://www.coupangplay.com/play/${VIDEO_A}`,
      '123e4567-e89b-12d3-a456-42661417400z',
    ];
    const invalidResults: unknown[] = [
      missionResult({ items: [missionItem(SEGMENT_A, 'attempted', -1)] }),
      missionResult({ items: [missionItem(SEGMENT_A, 'attempted', 1.5)] }),
      missionResult({ items: [missionItem(SEGMENT_A, 'attempted', Number.MAX_SAFE_INTEGER + 1)] }),
      missionResult({ practicedAt: '2026-08-09T02:00:00' }),
      ...invalidVideoIds.map((videoId) => missionResult({ videoId })),
      missionResult({ learningSourceKey: 'native:invalid' as ListeningSourceKey }),
      missionResult({
        items: [missionItem('segment-v1-invalid' as ListeningSegmentKey, 'attempted', 0)],
      }),
      missionResult({ items: [] }),
      missionResult({
        items: [missionItem(SEGMENT_A, 'attempted', 0), missionItem(SEGMENT_A, 'cleared', 1)],
      }),
      { ...missionResult(), answer: 'must not cross the storage boundary' },
      {
        ...missionResult(),
        items: [{ ...missionItem(SEGMENT_A, 'attempted', 0), attemptText: 'forbidden' }],
      },
    ];

    for (const invalidResult of invalidResults) {
      const storage = storageWithEmptyProgress();
      const api = createV2ListeningProgressStorage(storage);

      await expect(
        api.recordMissionResult(invalidResult as ListeningMissionResult)
      ).rejects.toThrow();
      expect(storage.getCalls).toEqual([]);
      expect(storage.setCalls).toEqual([]);
    }
  });

  it('protects total-attempt overflow without writing', async () => {
    const progress = progressWithItem({ totalAttempts: Number.MAX_SAFE_INTEGER });
    const storage = new FakeLocalStorage({ listeningProgress: progress });
    const api = createV2ListeningProgressStorage(storage);

    await expect(
      api.recordMissionResult(
        missionResult({ items: [missionItem(SEGMENT_A, 'mastered', 1)] })
      )
    ).rejects.toThrow('attempt count overflow');

    expect(storage.values.listeningProgress).toEqual(progress);
    expect(storage.setCalls).toEqual([]);
  });

  it('fails every mutation closed when persisted progress is missing or invalid', async () => {
    const invalidValues = [
      {},
      { listeningProgress: { version: 1, videos: { [VIDEO_A]: { sources: {} } }, history: [] } },
    ];

    for (const values of invalidValues) {
      const storage = new FakeLocalStorage(values);
      const api = createV2ListeningProgressStorage(storage);

      await expect(api.recordMissionResult(missionResult())).rejects.toThrow();
      await expect(api.clearVideo(VIDEO_A)).rejects.toThrow();
      await expect(api.clearAll()).rejects.toThrow();
      expect(storage.setCalls).toEqual([]);
    }
  });

  it('allows later queued mutations after a write failure', async () => {
    const storage = storageWithEmptyProgress();
    const api = createV2ListeningProgressStorage(storage);
    storage.failNextWrite = true;

    await expect(api.recordMissionResult(missionResult())).rejects.toThrow('Injected write failure');
    const recovered = await api.recordMissionResult(
      missionResult({ items: [missionItem(SEGMENT_B, 'cleared', 1)] })
    );

    expect(recovered.videos[VIDEO_A].sources[SOURCE_A]!.items).toEqual({
      [SEGMENT_B]: {
        state: 'cleared',
        totalAttempts: 1,
        lastPracticedAt: PRACTICED_AT,
      },
    });
    expect(storage.getCalls).toEqual(['listeningProgress', 'listeningProgress']);
  });

  it('allows clear-video and clear-all to retry after their writes fail', async () => {
    const storage = storageWithEmptyProgress();
    const api = createV2ListeningProgressStorage(storage);
    await api.recordMissionResult(missionResult());

    storage.failNextWrite = true;
    await expect(api.clearVideo(VIDEO_A)).rejects.toThrow('Injected write failure');
    expect(storage.values.listeningProgress).toHaveProperty(`videos.${VIDEO_A}`);
    await expect(api.clearVideo(VIDEO_A)).resolves.toEqual(createDefaultListeningProgress());

    await api.recordMissionResult(
      missionResult({
        videoId: VIDEO_B,
        learningSourceKey: SOURCE_B,
        items: [missionItem(SEGMENT_B, 'cleared', 1)],
      })
    );
    storage.failNextWrite = true;
    await expect(api.clearAll()).rejects.toThrow('Injected write failure');
    expect(storage.values.listeningProgress).toHaveProperty(`videos.${VIDEO_B}`);
    await expect(api.clearAll()).resolves.toEqual(createDefaultListeningProgress());
  });

  it('clears only the exact video namespace and then clears all progress', async () => {
    const storage = storageWithEmptyProgress();
    const api = createV2ListeningProgressStorage(storage);

    await api.recordMissionResult(missionResult());
    await api.recordMissionResult(
      missionResult({
        videoId: VIDEO_B,
        learningSourceKey: SOURCE_B,
        items: [missionItem(SEGMENT_B, 'cleared', 1)],
      })
    );

    const oneVideo = await api.clearVideo(VIDEO_A);
    expect(oneVideo.videos).not.toHaveProperty(VIDEO_A);
    expect(oneVideo.videos).toHaveProperty(VIDEO_B);

    const empty = await api.clearAll();
    expect(empty).toEqual(createDefaultListeningProgress());
    expect(storage.setCalls).toHaveLength(4);
  });

  it('strictly validates clear-video identities before reading or writing', async () => {
    const invalidVideoIds = [
      '',
      ' ',
      'video-a',
      `https://www.coupangplay.com/play/${VIDEO_A}`,
      '123e4567-e89b-12d3-a456-42661417400z',
    ];

    for (const videoId of invalidVideoIds) {
      const storage = storageWithEmptyProgress();
      const api = createV2ListeningProgressStorage(storage);

      await expect(api.clearVideo(videoId)).rejects.toThrow();
      expect(storage.getCalls).toEqual([]);
      expect(storage.setCalls).toEqual([]);
    }
  });
});

class FakeLocalStorage implements V2ListeningProgressStorageArea {
  values: Record<string, unknown>;
  getCalls: (string | string[] | null)[] = [];
  setCalls: Record<string, unknown>[] = [];
  failNextWrite = false;

  constructor(values: Record<string, unknown> = {}) {
    this.values = structuredClone(values);
  }

  async get(keys: string | string[] | null = null) {
    this.getCalls.push(structuredClone(keys));
    if (keys === null) return structuredClone(this.values);
    const requested = Array.isArray(keys) ? keys : [keys];
    return Object.fromEntries(
      requested
        .filter((key) => Object.prototype.hasOwnProperty.call(this.values, key))
        .map((key) => [key, structuredClone(this.values[key])])
    );
  }

  async set(items: Record<string, unknown>) {
    if (this.failNextWrite) {
      this.failNextWrite = false;
      throw new Error('Injected write failure');
    }
    const cloned = structuredClone(items);
    this.setCalls.push(cloned);
    Object.assign(this.values, cloned);
  }
}

const storageWithEmptyProgress = () =>
  new FakeLocalStorage({ listeningProgress: createDefaultListeningProgress() });

const missionResult = (
  overrides: Partial<ListeningMissionResult> = {}
): ListeningMissionResult => ({
  videoId: VIDEO_A,
  learningSourceKey: SOURCE_A,
  segmenterVersion: 1,
  practicedAt: PRACTICED_AT,
  bestCombo: 2,
  items: [missionItem(SEGMENT_A, 'mastered', 1)],
  ...overrides,
});

const missionItem = (
  segmentKey: ListeningSegmentKey,
  achievedState: ListeningMissionResult['items'][number]['achievedState'],
  submittedAttemptIncrement: number
) => ({ segmentKey, achievedState, submittedAttemptIncrement });

const progressWithItem = (overrides: Partial<StoredProgressItem> = {}): ListeningProgressV1 => ({
  version: 1,
  videos: {
    [VIDEO_A]: {
      sources: {
        [SOURCE_A]: {
          segmenterVersion: 1,
          bestCombo: 2,
          lastPracticedAt: PRACTICED_AT,
          items: {
            [SEGMENT_A]: {
              state: 'cleared',
              totalAttempts: 1,
              lastPracticedAt: PRACTICED_AT,
              ...overrides,
            },
          },
        },
      },
    },
  },
});

interface StoredProgressItem {
  state: ListeningProgressState;
  totalAttempts: number;
  lastPracticedAt: string;
}
