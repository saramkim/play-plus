import { describe, expect, it, vi } from 'vitest';

import {
  createOpenSubtitlesSessionCache,
  OPEN_SUBTITLES_CACHE_MAX_ENTRIES,
  OPEN_SUBTITLES_CACHE_MAX_PAYLOAD_BYTES,
  OPEN_SUBTITLES_CACHE_TTL_MS,
  SessionStorageArea,
} from './opensubtitles-session-cache';

const CACHE_KEY = 'openSubtitlesCache';

const createStorage = (initialValue?: unknown) => {
  const values: Record<string, unknown> = {};
  if (initialValue !== undefined) values[CACHE_KEY] = initialValue;

  const storage: SessionStorageArea & { values: Record<string, unknown> } = {
    values,
    get: vi.fn(async (key) =>
      Object.prototype.hasOwnProperty.call(values, key) ? { [key]: values[key] } : {}
    ),
    set: vi.fn(async (items) => {
      Object.assign(values, items);
    }),
    remove: vi.fn(async (key) => {
      delete values[key];
    }),
  };
  return storage;
};

const storedEntry = (
  fileId: number,
  cachedAt: number,
  lastAccessedAt = cachedAt,
  text = `subtitle-${fileId}`
) => ({
  fileId,
  fileName: `${fileId}.srt`,
  text,
  cachedAt,
  lastAccessedAt,
});

const getStoredCache = (storage: ReturnType<typeof createStorage>) => {
  return storage.values[CACHE_KEY] as Record<string, ReturnType<typeof storedEntry>>;
};

const payloadBytes = (storage: ReturnType<typeof createStorage>) => {
  return new TextEncoder().encode(JSON.stringify(storage.values[CACHE_KEY])).byteLength;
};

describe('OpenSubtitles session cache', () => {
  it('stores only the approved fields and updates lastAccessedAt on a hit', async () => {
    let timestamp = 1_000;
    const storage = createStorage();
    const cache = createOpenSubtitlesSessionCache(storage, () => timestamp);

    await cache.set({ fileId: 11, fileName: 'example.srt', text: 'subtitle' });
    expect(getStoredCache(storage)).toEqual({
      11: {
        fileId: 11,
        fileName: 'example.srt',
        text: 'subtitle',
        cachedAt: 1_000,
        lastAccessedAt: 1_000,
      },
    });

    timestamp = 2_000;
    await expect(cache.get(11)).resolves.toEqual({
      fileId: 11,
      fileName: 'example.srt',
      text: 'subtitle',
    });
    expect(getStoredCache(storage)[11]).toEqual({
      fileId: 11,
      fileName: 'example.srt',
      text: 'subtitle',
      cachedAt: 1_000,
      lastAccessedAt: 2_000,
    });
    expect(Object.keys(getStoredCache(storage)[11]).sort()).toEqual([
      'cachedAt',
      'fileId',
      'fileName',
      'lastAccessedAt',
      'text',
    ]);
  });

  it('purges malformed, extra-field, future, and expired entries', async () => {
    const timestamp = OPEN_SUBTITLES_CACHE_TTL_MS + 10_000;
    const storage = createStorage({
      1: storedEntry(1, timestamp - 1_000),
      2: { ...storedEntry(2, timestamp - 1_000), quota: 4 },
      3: storedEntry(3, timestamp - OPEN_SUBTITLES_CACHE_TTL_MS),
      4: storedEntry(4, timestamp + 1),
      5: { ...storedEntry(5, timestamp - 1_000), fileId: 6 },
      invalid: storedEntry(7, timestamp - 1_000),
    });
    const cache = createOpenSubtitlesSessionCache(storage, () => timestamp);

    await expect(cache.get(1)).resolves.toMatchObject({ fileId: 1 });
    expect(getStoredCache(storage)).toEqual({
      1: {
        ...storedEntry(1, timestamp - 1_000),
        lastAccessedAt: timestamp,
      },
    });
  });

  it('removes the provider key when no valid unexpired entries remain', async () => {
    const timestamp = OPEN_SUBTITLES_CACHE_TTL_MS;
    const storage = createStorage({
      1: storedEntry(1, 0),
      2: { fileId: 2, fileName: '2.srt', text: 'subtitle' },
    });
    const cache = createOpenSubtitlesSessionCache(storage, () => timestamp);

    await expect(cache.get(99)).resolves.toBeNull();
    expect(storage.values).not.toHaveProperty(CACHE_KEY);
    expect(storage.remove).toHaveBeenCalledWith(CACHE_KEY);
  });

  it('keeps at most eight entries and evicts the least recently used entry', async () => {
    let timestamp = 1_000;
    const storage = createStorage();
    const cache = createOpenSubtitlesSessionCache(storage, () => timestamp);

    for (let fileId = 1; fileId <= OPEN_SUBTITLES_CACHE_MAX_ENTRIES; fileId += 1) {
      timestamp += 1;
      await cache.set({ fileId, fileName: `${fileId}.srt`, text: `subtitle-${fileId}` });
    }
    timestamp += 1;
    await cache.get(1);
    timestamp += 1;
    await cache.set({ fileId: 9, fileName: '9.srt', text: 'subtitle-9' });

    const stored = getStoredCache(storage);
    expect(Object.keys(stored)).toHaveLength(OPEN_SUBTITLES_CACHE_MAX_ENTRIES);
    expect(stored).toHaveProperty('1');
    expect(stored).not.toHaveProperty('2');
    expect(stored).toHaveProperty('9');
  });

  it('uses ascending fileId as the deterministic LRU tie-break', async () => {
    const timestamp = 10_000;
    const entries = Object.fromEntries(
      Array.from({ length: OPEN_SUBTITLES_CACHE_MAX_ENTRIES + 1 }, (_, index) => {
        const fileId = index + 1;
        return [fileId, storedEntry(fileId, timestamp, timestamp)];
      })
    );
    const storage = createStorage(entries);
    const cache = createOpenSubtitlesSessionCache(storage, () => timestamp);

    await cache.get(9);

    const stored = getStoredCache(storage);
    expect(stored).not.toHaveProperty('1');
    expect(stored).toHaveProperty('2');
    expect(stored).toHaveProperty('9');
    expect(Object.keys(stored)).toHaveLength(OPEN_SUBTITLES_CACHE_MAX_ENTRIES);
  });

  it('enforces the full JSON UTF-8 payload bound by LRU order', async () => {
    let timestamp = 1_000;
    const storage = createStorage();
    const cache = createOpenSubtitlesSessionCache(storage, () => timestamp);
    const text = '한'.repeat(750_000);

    await cache.set({ fileId: 1, fileName: '1.srt', text });
    timestamp += 1;
    await cache.set({ fileId: 2, fileName: '2.srt', text });

    expect(payloadBytes(storage)).toBeLessThanOrEqual(OPEN_SUBTITLES_CACHE_MAX_PAYLOAD_BYTES);
    expect(getStoredCache(storage)).not.toHaveProperty('1');
    expect(getStoredCache(storage)).toHaveProperty('2');
  });

  it('skips an individually oversized candidate without evicting the existing cache', async () => {
    let timestamp = 1_000;
    const storage = createStorage();
    const cache = createOpenSubtitlesSessionCache(storage, () => timestamp);
    await cache.set({ fileId: 1, fileName: '1.srt', text: 'keep me' });

    timestamp += 1;
    await cache.set({
      fileId: 2,
      fileName: '2.srt',
      text: 'x'.repeat(OPEN_SUBTITLES_CACHE_MAX_PAYLOAD_BYTES),
    });

    expect(getStoredCache(storage)).toEqual({
      1: storedEntry(1, 1_000, 1_000, 'keep me'),
    });
  });

  it('expires six hours from cachedAt even after a recent hit', async () => {
    let timestamp = 0;
    const storage = createStorage();
    const cache = createOpenSubtitlesSessionCache(storage, () => timestamp);
    await cache.set({ fileId: 1, fileName: '1.srt', text: 'subtitle' });

    timestamp = OPEN_SUBTITLES_CACHE_TTL_MS - 1;
    await expect(cache.get(1)).resolves.toMatchObject({ fileId: 1 });
    timestamp = OPEN_SUBTITLES_CACHE_TTL_MS;
    await expect(cache.get(1)).resolves.toBeNull();
    expect(storage.values).not.toHaveProperty(CACHE_KEY);
  });

  it('serializes concurrent writes and clears only the session cache key', async () => {
    const storage = createStorage();
    const cache = createOpenSubtitlesSessionCache(storage, () => 1_000);

    await Promise.all([
      cache.set({ fileId: 1, fileName: '1.srt', text: 'one' }),
      cache.set({ fileId: 2, fileName: '2.srt', text: 'two' }),
    ]);
    expect(getStoredCache(storage)).toMatchObject({
      1: { fileId: 1, text: 'one' },
      2: { fileId: 2, text: 'two' },
    });

    await cache.clear();
    expect(storage.remove).toHaveBeenLastCalledWith(CACHE_KEY);
    expect(storage.values).not.toHaveProperty(CACHE_KEY);
  });
});
