import type { CachedSubtitle, SubtitleCache } from './opensubtitles-client';

const CACHE_KEY = 'openSubtitlesCache';

export interface SessionStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const normalizeCachedSubtitle = (value: unknown, fileId: number): CachedSubtitle | null => {
  if (
    isRecord(value) &&
    value.fileId === fileId &&
    typeof value.fileName === 'string' &&
    typeof value.text === 'string'
  ) {
    return { fileId, fileName: value.fileName, text: value.text };
  }
  return null;
};

const getCache = async (storage: SessionStorageArea): Promise<Record<string, CachedSubtitle>> => {
  const stored = (await storage.get(CACHE_KEY))[CACHE_KEY];
  if (!isRecord(stored)) return {};

  return Object.entries(stored).reduce<Record<string, CachedSubtitle>>((cache, [key, value]) => {
    const fileId = Number(key);
    if (!Number.isSafeInteger(fileId) || fileId < 1) return cache;
    const entry = normalizeCachedSubtitle(value, fileId);
    if (entry) cache[key] = entry;
    return cache;
  }, {});
};

export const createOpenSubtitlesSessionCache = (storage: SessionStorageArea): SubtitleCache => {
  let mutationQueue: Promise<void> = Promise.resolve();
  const enqueueMutation = (mutation: () => Promise<void>) => {
    mutationQueue = mutationQueue.then(mutation, mutation);
    return mutationQueue;
  };

  return {
    async get(fileId) {
      const entry = (await getCache(storage))[fileId];
      return entry ?? null;
    },
    set(entry) {
      return enqueueMutation(async () => {
        const cache = await getCache(storage);
        await storage.set({
          [CACHE_KEY]: {
            ...cache,
            [entry.fileId]: entry,
          },
        });
      });
    },
    clear() {
      return enqueueMutation(() => storage.remove(CACHE_KEY));
    },
  };
};
