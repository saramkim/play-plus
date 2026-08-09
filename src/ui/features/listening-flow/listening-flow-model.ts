import type { ListeningProgressV1 } from '@storage/v2/type';
import type {
  ListeningCatalogResponse,
  ListeningCatalogSegmentSummary,
} from '@utils/message/type';

import type { ListeningSegmentKey } from '@/listening/domain/source-identity';

export type ReadyListeningCatalog = Extract<ListeningCatalogResponse, { status: 'ready' }>;

export type ListeningProgressSummary = Readonly<{
  bestCombo: number;
  cleared: number;
  lastPracticedAt?: string;
  mastered: number;
  total: number;
}>;

const MAX_MISSION_SEGMENTS = 10;

export const summarizeListeningProgress = (
  catalog: ReadyListeningCatalog,
  progress: ListeningProgressV1
): ListeningProgressSummary => {
  const source = getExactSourceProgress(catalog, progress);
  let cleared = 0;
  let mastered = 0;

  for (const { segmentKey } of catalog.segments) {
    const state = source?.items[segmentKey]?.state;
    if (state === 'cleared' || state === 'mastered') cleared += 1;
    if (state === 'mastered') mastered += 1;
  }

  return Object.freeze({
    bestCombo: source?.bestCombo ?? 0,
    cleared,
    lastPracticedAt: source?.lastPracticedAt,
    mastered,
    total: catalog.segments.length,
  });
};

export const selectContinueSegmentKeys = (
  catalog: ReadyListeningCatalog,
  progress: ListeningProgressV1
) => {
  const source = getExactSourceProgress(catalog, progress);
  const earliestUnrecorded = catalog.segments.findIndex(
    ({ segmentKey }) => source === undefined || !hasOwn(source.items, segmentKey)
  );
  if (earliestUnrecorded >= 0) return selectConsecutiveSegmentKeys(catalog.segments, earliestUnrecorded);

  const earliestBelowCleared = catalog.segments.findIndex(
    ({ segmentKey }) => source?.items[segmentKey]?.state === 'attempted'
  );
  return selectConsecutiveSegmentKeys(
    catalog.segments,
    earliestBelowCleared >= 0 ? earliestBelowCleared : 0
  );
};

export const selectCurrentSegmentKeys = (catalog: ReadyListeningCatalog) => {
  const currentMs = catalog.currentTime * 1000;
  let containingIndex = -1;

  catalog.segments.forEach((segment, index) => {
    if (segment.startMs > currentMs || segment.endMs < currentMs) return;
    if (containingIndex < 0 || segment.startMs > catalog.segments[containingIndex].startMs) {
      containingIndex = index;
    }
  });

  if (containingIndex >= 0) {
    return selectConsecutiveSegmentKeys(catalog.segments, containingIndex);
  }

  const nextIndex = catalog.segments.findIndex(({ startMs }) => startMs > currentMs);
  return nextIndex < 0 ? [] : selectConsecutiveSegmentKeys(catalog.segments, nextIndex);
};

export const selectNextMissionSegmentKeys = (
  catalog: ReadyListeningCatalog,
  progress: ListeningProgressV1,
  priorFinalSegmentKey: ListeningSegmentKey
) => {
  const previousIndex = catalog.segments.findIndex(
    ({ segmentKey }) => segmentKey === priorFinalSegmentKey
  );
  if (previousIndex >= 0) {
    return selectConsecutiveSegmentKeys(catalog.segments, previousIndex + 1);
  }
  return selectContinueSegmentKeys(catalog, progress);
};

export const selectConsecutiveSegmentKeys = (
  segments: readonly ListeningCatalogSegmentSummary[],
  startIndex: number
) =>
  segments
    .slice(startIndex, startIndex + MAX_MISSION_SEGMENTS)
    .map(({ segmentKey }) => segmentKey);

const getExactSourceProgress = (
  catalog: ReadyListeningCatalog,
  progress: ListeningProgressV1
) => {
  const source = progress.videos[catalog.videoId]?.sources[catalog.sourceKey];
  return source?.segmenterVersion === catalog.segmenterVersion ? source : undefined;
};

const hasOwn = (value: object, key: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(value, key);
