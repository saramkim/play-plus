import { useCallback, useEffect, useRef, useState } from 'react';

import type { V2LearningCardStorageApi } from '@storage/v2/learning-card-storage';
import type { LearningCard } from '@storage/v2/type';
import type { Language } from '@utils/constants';
import { getCoupangPlayVideoId } from '@utils/coupang-play';
import { stripTags, toFixedTime } from '@utils/helper';

import type { SubtitleOverviewRow } from './subtitle-overview-model';

export interface SubtitleOverviewSavedCueContext {
  learningLanguage: Language;
  videoId: string | null;
}

export interface SubtitleOverviewSavedCueInput extends SubtitleOverviewSavedCueContext {
  endTime: number;
  startTime: number;
  text: string;
}

export interface UseSubtitleOverviewSavedStateInput extends SubtitleOverviewSavedCueContext {
  cardRevision: number;
  storage: Pick<V2LearningCardStorageApi, 'get'>;
}

interface LoadedSavedKeys {
  contextKey: string;
  keys: ReadonlySet<string>;
}

interface OptimisticSavedKey {
  generation: number;
  revision: number;
}

interface OptimisticSavedKeys {
  contextKey: string;
  entries: ReadonlyMap<string, OptimisticSavedKey>;
}

interface SavedStateAuthority {
  contextKey: string;
  revision: number;
}

const EMPTY_SAVED_KEYS: ReadonlySet<string> = new Set();
const EMPTY_OPTIMISTIC_KEYS: ReadonlyMap<string, OptimisticSavedKey> = new Map();

export const createSubtitleOverviewSavedCueKey = ({
  endTime,
  learningLanguage,
  startTime,
  text,
  videoId,
}: SubtitleOverviewSavedCueInput): string | undefined => {
  const normalizedVideoId = normalizeVideoId(videoId);
  const plainText = stripTags(text);
  if (
    normalizedVideoId === null ||
    plainText.length === 0 ||
    !Number.isFinite(startTime) ||
    !Number.isFinite(endTime)
  ) {
    return undefined;
  }

  return JSON.stringify([
    normalizedVideoId,
    learningLanguage,
    toFixedTime(startTime),
    toFixedTime(endTime),
    plainText,
  ]);
};

export const createSubtitleOverviewSavedCueIndex = (
  cards: readonly LearningCard[],
  context: SubtitleOverviewSavedCueContext
): ReadonlySet<string> => {
  const normalizedVideoId = normalizeVideoId(context.videoId);
  if (normalizedVideoId === null) return EMPTY_SAVED_KEYS;

  const keys = new Set<string>();
  for (const card of cards) {
    if (!('learning' in card.content) || card.source.endTime === undefined) continue;
    if (card.content.learning.language !== context.learningLanguage) continue;

    const cardVideoId = normalizeVideoId(getCoupangPlayVideoId(card.source.url));
    if (cardVideoId !== normalizedVideoId) continue;

    const key = createSubtitleOverviewSavedCueKey({
      endTime: card.source.endTime,
      learningLanguage: card.content.learning.language,
      startTime: card.source.startTime,
      text: card.content.learning.text,
      videoId: cardVideoId,
    });
    if (key !== undefined) keys.add(key);
  }
  return keys;
};

export const createSubtitleOverviewSavedRowKey = (
  row: SubtitleOverviewRow,
  context: SubtitleOverviewSavedCueContext
): string | undefined => {
  if (row.learningSourceIndex === undefined) return undefined;
  return createSubtitleOverviewSavedCueKey({
    ...context,
    endTime: row.cue.endTime,
    startTime: row.cue.startTime,
    text: row.cue.text,
  });
};

export const isSubtitleOverviewRowSaved = (
  savedCueIndex: ReadonlySet<string>,
  row: SubtitleOverviewRow,
  context: SubtitleOverviewSavedCueContext
) => {
  const key = createSubtitleOverviewSavedRowKey(row, context);
  return key !== undefined && savedCueIndex.has(key);
};

export const useSubtitleOverviewSavedState = ({
  cardRevision,
  learningLanguage,
  storage,
  videoId,
}: UseSubtitleOverviewSavedStateInput) => {
  const contextKey = createContextKey({ learningLanguage, videoId });
  const authorityRef = useRef<SavedStateAuthority>({ contextKey, revision: cardRevision });
  authorityRef.current = { contextKey, revision: cardRevision };
  const generationRef = useRef(0);
  const [loaded, setLoaded] = useState<LoadedSavedKeys>({
    contextKey,
    keys: EMPTY_SAVED_KEYS,
  });
  const [optimistic, setOptimistic] = useState<OptimisticSavedKeys>({
    contextKey,
    entries: EMPTY_OPTIMISTIC_KEYS,
  });

  useEffect(() => {
    const generation = ++generationRef.current;
    const revision = cardRevision;
    let active = true;

    void Promise.resolve()
      .then(() => storage.get())
      .then(
        (cards) => {
          if (!active || generationRef.current !== generation) return;
          const keys = createSubtitleOverviewSavedCueIndex(cards, {
            learningLanguage,
            videoId,
          });
          setLoaded({ contextKey, keys });
          setOptimistic((current) =>
            reconcileOptimisticKeys(current, {
              contextKey,
              generation,
              keys,
              revision,
            })
          );
        },
        () => {
          if (!active || generationRef.current !== generation) return;
          setLoaded({ contextKey, keys: EMPTY_SAVED_KEYS });
          setOptimistic({ contextKey, entries: EMPTY_OPTIMISTIC_KEYS });
        }
      );

    return () => {
      active = false;
    };
  }, [cardRevision, contextKey, learningLanguage, storage, videoId]);

  const isSaved = useCallback(
    (row: SubtitleOverviewRow) => {
      const key = createSubtitleOverviewSavedRowKey(row, { learningLanguage, videoId });
      if (key === undefined) return false;
      return (
        (loaded.contextKey === contextKey && loaded.keys.has(key)) ||
        (optimistic.contextKey === contextKey && optimistic.entries.has(key))
      );
    }, [contextKey, learningLanguage, loaded, optimistic, videoId]
  );

  const markSaved = useCallback(
    (row: SubtitleOverviewRow) => {
      const authority = authorityRef.current;
      if (authority.contextKey !== contextKey || authority.revision !== cardRevision) return;
      const key = createSubtitleOverviewSavedRowKey(row, { learningLanguage, videoId });
      if (key === undefined) return;
      const marker = {
        generation: generationRef.current,
        revision: cardRevision,
      };
      setOptimistic((current) => {
        const entries = new Map(
          current.contextKey === contextKey ? current.entries : EMPTY_OPTIMISTIC_KEYS
        );
        entries.set(key, marker);
        return { contextKey, entries };
      });
    }, [cardRevision, contextKey, learningLanguage, videoId]
  );

  return { isSaved, markSaved };
};

const reconcileOptimisticKeys = (
  current: OptimisticSavedKeys,
  loaded: LoadedSavedKeys & { generation: number; revision: number }
): OptimisticSavedKeys => {
  if (current.contextKey !== loaded.contextKey) {
    return { contextKey: loaded.contextKey, entries: EMPTY_OPTIMISTIC_KEYS };
  }

  const entries = new Map(current.entries);
  for (const [key, marker] of entries) {
    const loadedAfterMarker =
      loaded.revision > marker.revision ||
      (loaded.revision === marker.revision && loaded.generation > marker.generation);
    if (loaded.keys.has(key) || loadedAfterMarker) entries.delete(key);
  }
  return entries.size === current.entries.size ? current : { ...current, entries };
};

const createContextKey = ({ learningLanguage, videoId }: SubtitleOverviewSavedCueContext) =>
  JSON.stringify([normalizeVideoId(videoId), learningLanguage]);

const normalizeVideoId = (videoId: string | null) => videoId?.toLowerCase() ?? null;
