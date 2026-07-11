import { beforeEach, describe, expect, it, vi } from 'vitest';

import { migrateStorage } from './migration';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(chrome.storage.sync.get).mockImplementation(async (key) => ({ [String(key)]: { value: 2 } }));
  vi.mocked(chrome.storage.sync.set).mockResolvedValue();
  vi.mocked(chrome.storage.sync.remove).mockResolvedValue();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('migrateStorage', () => {
  it('writes the transformed value before deleting the legacy key', async () => {
    const order: string[] = [];
    vi.mocked(chrome.storage.sync.set).mockImplementation(async () => {
      order.push('set');
    });
    vi.mocked(chrome.storage.sync.remove).mockImplementation(async () => {
      order.push('remove');
    });

    await expect(migrateStorage('oldKey', 'playbackSpeed', () => DEFAULT_PLAYBACK_SPEED)).resolves.toBe(true);
    expect(order).toEqual(['set', 'remove']);
  });

  it('preserves the legacy key and rejects when transformation fails', async () => {
    await expect(
      migrateStorage('oldKey', 'playbackSpeed', () => {
        throw new Error('transform failed');
      })
    ).rejects.toThrow('transform failed');
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    expect(chrome.storage.sync.remove).not.toHaveBeenCalled();
  });

  it('preserves the legacy key and rejects when writing fails', async () => {
    vi.mocked(chrome.storage.sync.set).mockRejectedValue(new Error('write failed'));

    await expect(migrateStorage('oldKey', 'playbackSpeed', () => DEFAULT_PLAYBACK_SPEED)).rejects.toThrow(
      'write failed'
    );
    expect(chrome.storage.sync.remove).not.toHaveBeenCalled();
  });
});

const DEFAULT_PLAYBACK_SPEED = {
  enabled: false,
  increase: '',
  decrease: '',
  reset: '',
};
