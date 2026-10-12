import { DEFAULT_CONFIG } from '@storage/default';
import { StorageChanges } from '@storage/type';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { elementStore } from '@/content/core/store/element-store';
import { useConfigStore } from '@/ui/store/config-store';

import { onSubtitleStorageChange } from './subtitle';
import { useSubtitleStore } from './subtitle-store';

afterEach(() => {
  useSubtitleStore.setState({ subtitleSettings: {
    primarySubtitle: DEFAULT_CONFIG.primarySubtitle,
    secondarySubtitle: DEFAULT_CONFIG.secondarySubtitle,
  } });
  useConfigStore.setState({ configs: DEFAULT_CONFIG });
});

describe('subtitle style storage changes', () => {
  it('applies saved shadows independently and restores defaults for legacy settings', async () => {
    await onSubtitleStorageChange({
      primarySubtitle: { newValue: { ...DEFAULT_CONFIG.primarySubtitle, shadowStrength: 0 } },
      secondarySubtitle: { newValue: { ...DEFAULT_CONFIG.secondarySubtitle, shadowStrength: 10 } },
    });
    expect(elementStore.getSubtitleElement('primarySubtitle').style.textShadow).toBe('none');
    expect(elementStore.getSubtitleElement('secondarySubtitle').style.textShadow).toContain('rgba(0, 0, 0, 1) -1px -1px 1px');

    const legacyChange = { primarySubtitle: { newValue: { color: '#123456', fontSize: 8 } } };
    await onSubtitleStorageChange(legacyChange as StorageChanges);
    expect(elementStore.getSubtitleElement('primarySubtitle').style.textShadow).toBe('black 2px 2px 2px');
    expect(useSubtitleStore.getState().subtitleSettings.primarySubtitle.color).toBe('#123456');
    await onSubtitleStorageChange({ secondarySubtitle: {} });
    expect(elementStore.getSubtitleElement('secondarySubtitle').style.textShadow).toBe('black 2px 2px 2px');
  });

  it('normalizes synced legacy settings before exposing them to the settings form', async () => {
    vi.mocked(chrome.storage.sync.get).mockImplementation(((_keys: unknown, callback: (value: object) => void) => {
      callback({});
    }) as typeof chrome.storage.sync.get);
    const registration = await useConfigStore.getState().initializeConfigs();
    const listener = vi.mocked(chrome.storage.sync.onChanged.addListener).mock.calls.at(-1)?.[0];
    expect(listener).toBeDefined();
    expect(() => listener?.({ unrelatedSyncKey: { newValue: 'ignore' } })).not.toThrow();
    expect(useConfigStore.getState().configs).not.toHaveProperty('unrelatedSyncKey');
    listener?.({ primarySubtitle: { newValue: { color: '#123456', shadowStrength: 0 } } });
    expect(useConfigStore.getState().configs.primarySubtitle.shadowStrength).toBe(0);
    listener?.({ primarySubtitle: { newValue: { color: '#654321' } } });
    expect(useConfigStore.getState().configs.primarySubtitle).toEqual({
      ...DEFAULT_CONFIG.primarySubtitle, color: '#654321', shadowStrength: 2,
    });
    registration.remove();
  });
});
