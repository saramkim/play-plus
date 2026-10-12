import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_CONFIG } from './default';

import { getStorage, getStorageAll, setStorage, validateStorageValue } from './index';

let stored: Record<string, unknown> = {};

beforeEach(() => {
  stored = {};
  vi.mocked(chrome.storage.sync.get).mockImplementation(((keys: string | string[], callback: (items: object) => void) => {
    const requested = Array.isArray(keys) ? keys : [keys];
    callback(Object.fromEntries(requested.filter((key) => key in stored).map((key) => [key, stored[key]])));
  }) as typeof chrome.storage.sync.get);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('validated sync storage reads', () => {
  it.each(['primarySubtitle', 'secondarySubtitle'] as const)('preserves legacy %s styles and defaults its shadow', async (key) => {
    stored[key] = { color: '#123456', fontSize: 8, backgroundOpacity: 30 };
    const config = await getStorage(key);
    expect(config).toEqual({ ...DEFAULT_CONFIG[key], ...stored[key] as object, shadowStrength: 2 });
    expect(validateStorageValue(key, stored[key])).toEqual(config);
  });

  it('stores independent shadow strengths including zero', async () => {
    vi.mocked(chrome.storage.sync.set).mockImplementation((async (values: object) => {
      Object.assign(stored, values);
    }) as typeof chrome.storage.sync.set);
    await setStorage('primarySubtitle', { ...DEFAULT_CONFIG.primarySubtitle, shadowStrength: 0 });
    await setStorage('secondarySubtitle', { ...DEFAULT_CONFIG.secondarySubtitle, shadowStrength: 10 });
    expect((await getStorageAll()).primarySubtitle.shadowStrength).toBe(0);
    expect((await getStorageAll()).secondarySubtitle.shadowStrength).toBe(10);
  });

  it('replaces an invalid shadow without losing unrelated preferences', async () => {
    stored.primarySubtitle = { shadowStrength: 99, fontSize: 8, color: '#123456' };
    await expect(getStorage('primarySubtitle')).resolves.toEqual({
      ...DEFAULT_CONFIG.primarySubtitle, fontSize: 8, color: '#123456', shadowStrength: 2,
    });
  });

  it('keeps valid user fields while replacing invalid fields with defaults', async () => {
    stored.primarySubtitle = { fontSize: 99, color: '#123456', language: 'unknown' };

    await expect(getStorage('primarySubtitle')).resolves.toEqual({
      ...DEFAULT_CONFIG.primarySubtitle,
      color: '#123456',
    });
    expect(console.warn).toHaveBeenCalledWith(
      'Invalid persisted storage value',
      expect.objectContaining({ key: 'primarySubtitle', issues: expect.any(Array) })
    );
  });

  it('merges partial valid objects with defaults', async () => {
    stored.primarySubtitle = { fontSize: 8 };

    await expect(getStorage('primarySubtitle')).resolves.toEqual({ ...DEFAULT_CONFIG.primarySubtitle, fontSize: 8 });
  });

  it('validates every key returned by getStorageAll', async () => {
    stored.primarySubtitle = { backgroundOpacity: -1, fontWeight: 5 };
    stored.videoSkip = { skipTimeUnit: 'invalid', fallbackTime: 12 };

    const result = await getStorageAll();

    expect(result.primarySubtitle).toEqual({ ...DEFAULT_CONFIG.primarySubtitle, fontWeight: 5 });
    expect(result.videoSkip).toEqual({ ...DEFAULT_CONFIG.videoSkip, fallbackTime: 12 });
  });
});
