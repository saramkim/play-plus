import { z } from 'zod';

import { createDefaultListeningProgress } from './default';
import {
  listeningProgressSchema,
  listeningProgressStateSchema,
  listeningSegmentKeySchema,
  listeningSourceKeySchema,
  listeningVideoIdSchema,
  nonnegativeSafeIntegerSchema,
  offsetDateTimeSchema,
} from './schema';
import { ListeningProgressState, ListeningProgressV1 } from './type';

export interface V2ListeningProgressStorageArea {
  get: (keys?: string | string[] | null) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
}

const missionProgressItemSchema = z
  .object({
    segmentKey: listeningSegmentKeySchema,
    achievedState: listeningProgressStateSchema,
    submittedAttemptIncrement: nonnegativeSafeIntegerSchema,
  })
  .strict();

export const listeningMissionResultSchema = z
  .object({
    videoId: listeningVideoIdSchema,
    learningSourceKey: listeningSourceKeySchema,
    segmenterVersion: z.literal(1),
    practicedAt: offsetDateTimeSchema,
    bestCombo: nonnegativeSafeIntegerSchema,
    items: z.array(missionProgressItemSchema).min(1),
  })
  .strict()
  .superRefine(({ items }, context) => {
    const segmentKeys = new Set<string>();
    items.forEach(({ segmentKey }, index) => {
      if (segmentKeys.has(segmentKey)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Mission progress contains a duplicate segment key',
          path: ['items', index, 'segmentKey'],
        });
      }
      segmentKeys.add(segmentKey);
    });
  });

export type ListeningMissionResult = z.infer<typeof listeningMissionResultSchema>;

export interface V2ListeningProgressStorageApi {
  get: () => Promise<ListeningProgressV1>;
  recordMissionResult: (result: ListeningMissionResult) => Promise<ListeningProgressV1>;
  clearVideo: (videoId: string) => Promise<ListeningProgressV1>;
  clearAll: () => Promise<ListeningProgressV1>;
}

const STATE_RANK: Record<ListeningProgressState, number> = {
  attempted: 0,
  cleared: 1,
  mastered: 2,
};

export const createV2ListeningProgressStorage = (
  storage: V2ListeningProgressStorageArea
): V2ListeningProgressStorageApi => {
  let mutationQueue: Promise<void> = Promise.resolve();

  const get = async () => {
    const result = await storage.get('listeningProgress');
    return listeningProgressSchema.parse(result.listeningProgress);
  };

  const enqueueMutation = <T>(mutation: () => Promise<T>) => {
    const result = mutationQueue.then(mutation);
    mutationQueue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  };

  const write = async (progress: ListeningProgressV1) => {
    const parsedProgress = listeningProgressSchema.parse(progress);
    await storage.set({ listeningProgress: parsedProgress });
    return parsedProgress;
  };

  return {
    get,
    recordMissionResult: async (result) => {
      const parsedResult = listeningMissionResultSchema.parse(result);
      return enqueueMutation(async () => {
        const progress = await get();
        return write(mergeMissionResult(progress, parsedResult));
      });
    },
    clearVideo: async (videoId) => {
      const parsedVideoId = listeningVideoIdSchema.parse(videoId);
      return enqueueMutation(async () => {
        const progress = await get();
        const { [parsedVideoId]: _removed, ...videos } = progress.videos;
        return write({ ...progress, videos });
      });
    },
    clearAll: () => {
      return enqueueMutation(async () => {
        await get();
        return write(createDefaultListeningProgress());
      });
    },
  };
};

const mergeMissionResult = (
  progress: ListeningProgressV1,
  result: ListeningMissionResult
): ListeningProgressV1 => {
  const currentVideo = progress.videos[result.videoId];
  const currentSource = currentVideo?.sources[result.learningSourceKey];
  const items = { ...currentSource?.items };

  for (const update of result.items) {
    const currentItem = items[update.segmentKey];
    items[update.segmentKey] = {
      state: higherState(currentItem?.state, update.achievedState),
      totalAttempts: addAttempts(currentItem?.totalAttempts ?? 0, update.submittedAttemptIncrement),
      lastPracticedAt: latestTimestamp(currentItem?.lastPracticedAt, result.practicedAt),
    };
  }

  return listeningProgressSchema.parse({
    ...progress,
    videos: {
      ...progress.videos,
      [result.videoId]: {
        sources: {
          ...currentVideo?.sources,
          [result.learningSourceKey]: {
            segmenterVersion: result.segmenterVersion,
            bestCombo: Math.max(currentSource?.bestCombo ?? 0, result.bestCombo),
            lastPracticedAt: latestTimestamp(currentSource?.lastPracticedAt, result.practicedAt),
            items,
          },
        },
      },
    },
  });
};

const higherState = (
  current: ListeningProgressState | undefined,
  candidate: ListeningProgressState
) => {
  if (current === undefined || STATE_RANK[candidate] > STATE_RANK[current]) return candidate;
  return current;
};

const addAttempts = (current: number, increment: number) => {
  const total = current + increment;
  if (!Number.isSafeInteger(total)) throw new Error('Listening progress attempt count overflow');
  return total;
};

const latestTimestamp = (current: string | undefined, candidate: string) => {
  if (current === undefined || Date.parse(candidate) > Date.parse(current)) return candidate;
  return current;
};
