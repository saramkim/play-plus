import { describe, expect, it, vi } from 'vitest';

import { createOpenSubtitlesSessionCache } from './opensubtitles-session-cache';

const createStorage = () => {
  const values: Record<string, unknown> = {};
  return {
    values,
    get: vi.fn(async (key: string) => ({ [key]: values[key] })),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(values, items);
    }),
    remove: vi.fn(async (key: string) => {
      delete values[key];
    }),
  };
};

describe('OpenSubtitles session cache', () => {
  it('stores only the decoded subtitle identity, filename, and text', async () => {
    const storage = createStorage();
    const cache = createOpenSubtitlesSessionCache(storage);

    await cache.set({ fileId: 11, fileName: 'example.srt', text: 'subtitle' });

    await expect(cache.get(11)).resolves.toEqual({
      fileId: 11,
      fileName: 'example.srt',
      text: 'subtitle',
    });
    expect(storage.values).toEqual({
      openSubtitlesCache: {
        11: { fileId: 11, fileName: 'example.srt', text: 'subtitle' },
      },
    });
  });

  it('rejects malformed entries and clears the provider cache key', async () => {
    const storage = createStorage();
    storage.values.openSubtitlesCache = {
      11: { fileId: 11, fileName: 'example.srt', text: 42 },
    };
    const cache = createOpenSubtitlesSessionCache(storage);

    await expect(cache.get(11)).resolves.toBeNull();
    await cache.clear();

    expect(storage.remove).toHaveBeenCalledWith('openSubtitlesCache');
    expect(storage.values).toEqual({});
  });

  it('does not return or preserve fields outside the cache contract', async () => {
    const storage = createStorage();
    storage.values.openSubtitlesCache = {
      11: {
        fileId: 11,
        fileName: 'example.srt',
        text: 'subtitle',
        temporaryUrl: 'https://example.com/private',
        quota: { remaining: 1 },
      },
    };
    const cache = createOpenSubtitlesSessionCache(storage);

    await expect(cache.get(11)).resolves.toEqual({
      fileId: 11,
      fileName: 'example.srt',
      text: 'subtitle',
    });
    await cache.set({ fileId: 12, fileName: 'two.srt', text: 'two' });

    expect(storage.values.openSubtitlesCache).toEqual({
      11: { fileId: 11, fileName: 'example.srt', text: 'subtitle' },
      12: { fileId: 12, fileName: 'two.srt', text: 'two' },
    });
  });

  it('serializes concurrent writes so sibling entries are preserved', async () => {
    const storage = createStorage();
    const cache = createOpenSubtitlesSessionCache(storage);

    await Promise.all([
      cache.set({ fileId: 11, fileName: 'one.srt', text: 'one' }),
      cache.set({ fileId: 12, fileName: 'two.srt', text: 'two' }),
    ]);

    await expect(cache.get(11)).resolves.toMatchObject({ text: 'one' });
    await expect(cache.get(12)).resolves.toMatchObject({ text: 'two' });
  });
});
