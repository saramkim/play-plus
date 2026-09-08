import type { ListeningProgressV1 } from '@storage/v2/type';
import type {
  ListeningCatalogResponse,
  ListeningCatalogSegmentSummary,
} from '@utils/message/type';

export type ReadyListeningCatalog = Extract<ListeningCatalogResponse, { status: 'ready' }>;

export type ListeningProgressSummary = Readonly<{
  bestCombo: number;
  cleared: number;
  lastPracticedAt?: string;
  mastered: number;
  total: number;
}>;

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

export const LISTENING_RECENCY_MS = 10_000;
export const MAX_PAST_LISTENING_SEGMENTS = 20_000;

export const selectPastSegmentKeys = (catalog: ReadyListeningCatalog) =>
  catalog.segments
    .map((segment, index) => ({ segment, index }))
    .filter(({ segment }) => segment.endMs <= catalog.currentTime * 1000)
    .sort((a, b) => b.segment.endMs - a.segment.endMs ||
      b.segment.startMs - a.segment.startMs || a.index - b.index)
    .slice(0, MAX_PAST_LISTENING_SEGMENTS)
    .sort((a, b) => a.index - b.index)
    .map(({ segment }) => segment.segmentKey);

export const selectCurrentSegmentKeys = (catalog: ReadyListeningCatalog) => {
  const cutoffMs = catalog.currentTime * 1000;
  let selected: ListeningCatalogSegmentSummary | undefined;
  for (const segment of catalog.segments) {
    if (segment.endMs > cutoffMs || cutoffMs - segment.endMs > LISTENING_RECENCY_MS) continue;
    if (!selected || segment.endMs > selected.endMs ||
        (segment.endMs === selected.endMs && segment.startMs > selected.startMs)) {
      selected = segment;
    }
  }
  return selected ? [selected.segmentKey] : [];
};

const getExactSourceProgress = (
  catalog: ReadyListeningCatalog,
  progress: ListeningProgressV1
) => {
  const source = progress.videos[catalog.videoId]?.sources[catalog.sourceKey];
  return source?.segmenterVersion === catalog.segmenterVersion ? source : undefined;
};
