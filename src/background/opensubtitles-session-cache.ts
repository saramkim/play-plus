import type { CachedSubtitle, SubtitleCache } from './opensubtitles-client';

const CACHE_KEY = 'openSubtitlesCache';
const CACHE_ENTRY_FIELDS = [
  'cachedAt',
  'fileId',
  'fileName',
  'lastAccessedAt',
  'text',
] as const;

export const OPEN_SUBTITLES_CACHE_MAX_ENTRIES = 8;
export const OPEN_SUBTITLES_CACHE_MAX_PAYLOAD_BYTES = 4 * 1024 * 1024;
export const OPEN_SUBTITLES_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface StoredSubtitle extends CachedSubtitle {
  cachedAt: number;
  lastAccessedAt: number;
}

type StoredCache = Record<string, StoredSubtitle>;

export interface SessionStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isTimestamp = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
};

const normalizeStoredSubtitle = (
  value: unknown,
  fileId: number,
  now: number
): StoredSubtitle | null => {
  if (!isRecord(value)) return null;
  const fields = Object.keys(value).sort();
  if (
    fields.length !== CACHE_ENTRY_FIELDS.length ||
    fields.some((field, index) => field !== CACHE_ENTRY_FIELDS[index]) ||
    value.fileId !== fileId ||
    typeof value.fileName !== 'string' ||
    !value.fileName.trim() ||
    typeof value.text !== 'string' ||
    !isTimestamp(value.cachedAt) ||
    !isTimestamp(value.lastAccessedAt) ||
    value.cachedAt > now ||
    value.lastAccessedAt < value.cachedAt ||
    value.lastAccessedAt > now ||
    now - value.cachedAt >= OPEN_SUBTITLES_CACHE_TTL_MS
  ) {
    return null;
  }

  return {
    fileId,
    fileName: value.fileName,
    text: value.text,
    cachedAt: value.cachedAt,
    lastAccessedAt: value.lastAccessedAt,
  };
};

const getPayloadByteLength = (cache: StoredCache) => {
  return new TextEncoder().encode(JSON.stringify(cache)).byteLength;
};

const getEvictionOrder = (cache: StoredCache) => {
  return Object.values(cache).sort(
    (left, right) =>
      left.lastAccessedAt - right.lastAccessedAt || left.fileId - right.fileId
  );
};

const enforceBounds = (cache: StoredCache) => {
  const bounded = { ...cache };
  for (const entry of getEvictionOrder(bounded)) {
    if (
      Object.keys(bounded).length <= OPEN_SUBTITLES_CACHE_MAX_ENTRIES &&
      getPayloadByteLength(bounded) <= OPEN_SUBTITLES_CACHE_MAX_PAYLOAD_BYTES
    ) {
      break;
    }
    delete bounded[entry.fileId];
  }
  return bounded;
};

const readCache = async (storage: SessionStorageArea, now: number) => {
  const stored = (await storage.get(CACHE_KEY))[CACHE_KEY];
  if (!isRecord(stored)) {
    return { cache: {} as StoredCache, changed: stored !== undefined };
  }

  const cache: StoredCache = {};
  let changed = false;
  for (const [key, value] of Object.entries(stored)) {
    const fileId = Number(key);
    if (!Number.isSafeInteger(fileId) || fileId < 1 || key !== String(fileId)) {
      changed = true;
      continue;
    }
    const entry = normalizeStoredSubtitle(value, fileId, now);
    if (!entry) {
      changed = true;
      continue;
    }
    cache[key] = entry;
  }

  const bounded = enforceBounds(cache);
  if (Object.keys(bounded).length !== Object.keys(cache).length) changed = true;
  return { cache: bounded, changed };
};

const writeCache = (storage: SessionStorageArea, cache: StoredCache) => {
  if (Object.keys(cache).length === 0) return storage.remove(CACHE_KEY);
  return storage.set({ [CACHE_KEY]: cache });
};

export const createOpenSubtitlesSessionCache = (
  storage: SessionStorageArea,
  now: () => number = Date.now
): SubtitleCache => {
  let mutationQueue: Promise<void> = Promise.resolve();
  const enqueueMutation = <T>(mutation: () => Promise<T>) => {
    const result = mutationQueue.then(mutation, mutation);
    mutationQueue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  };

  return {
    get(fileId) {
      return enqueueMutation(async () => {
        const timestamp = now();
        const { cache, changed } = await readCache(storage, timestamp);
        const entry = cache[fileId];
        if (!entry) {
          if (changed) await writeCache(storage, cache);
          return null;
        }

        const updated = {
          ...entry,
          lastAccessedAt: timestamp,
        };
        await writeCache(storage, enforceBounds({ ...cache, [fileId]: updated }));
        return { fileId: updated.fileId, fileName: updated.fileName, text: updated.text };
      });
    },
    set(entry) {
      return enqueueMutation(async () => {
        const timestamp = now();
        const { cache, changed } = await readCache(storage, timestamp);
        if (
          !Number.isSafeInteger(entry.fileId) ||
          entry.fileId < 1 ||
          typeof entry.fileName !== 'string' ||
          !entry.fileName.trim() ||
          typeof entry.text !== 'string'
        ) {
          if (changed) await writeCache(storage, cache);
          return;
        }
        const candidate: StoredSubtitle = {
          fileId: entry.fileId,
          fileName: entry.fileName,
          text: entry.text,
          cachedAt: timestamp,
          lastAccessedAt: timestamp,
        };
        const candidateCache = { [entry.fileId]: candidate };
        if (getPayloadByteLength(candidateCache) > OPEN_SUBTITLES_CACHE_MAX_PAYLOAD_BYTES) {
          if (changed) await writeCache(storage, cache);
          return;
        }

        await writeCache(storage, enforceBounds({ ...cache, [entry.fileId]: candidate }));
      });
    },
    clear() {
      return enqueueMutation(() => storage.remove(CACHE_KEY));
    },
  };
};
