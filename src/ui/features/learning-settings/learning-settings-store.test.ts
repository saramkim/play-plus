import { DEFAULT_V2_SYNC_STORAGE } from '@storage/v2/default';
import {
  V2SyncStorageApi,
  V2SyncStorageChanges,
  V2SyncStorageKey,
} from '@storage/v2/sync-storage';
import { V2SyncStorage } from '@storage/v2/type';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createLearningSettingsStore } from './learning-settings-store';

describe('v2 learning settings store', () => {
  let changesCallback: ((changes: V2SyncStorageChanges) => void) | undefined;
  let storage: V2SyncStorageApi;

  beforeEach(() => {
    changesCallback = undefined;
    const get = async <K extends V2SyncStorageKey>(key: K): Promise<V2SyncStorage[K]> =>
      structuredClone(DEFAULT_V2_SYNC_STORAGE[key]);
    storage = {
      get,
      getAll: vi.fn(async () => structuredClone(DEFAULT_V2_SYNC_STORAGE)),
      set: vi.fn(async () => undefined),
      subscribe: vi.fn((callback) => {
        changesCallback = callback;
        return { remove: vi.fn() };
      }),
    };
  });

  it('loads canonical profile/display values and follows typed storage changes', async () => {
    const useStore = createLearningSettingsStore(storage);

    const subscription = await useStore.getState().initialize();
    expect(useStore.getState()).toMatchObject({
      learningProfile: DEFAULT_V2_SYNC_STORAGE.learningProfile,
      loading: false,
      subtitleDisplay: DEFAULT_V2_SYNC_STORAGE.subtitleDisplay,
    });
    expect(subscription.remove).toEqual(expect.any(Function));

    changesCallback?.({
      learningProfile: { newValue: { learningLanguage: 'ko', supportLanguage: null } },
    });
    expect(useStore.getState().learningProfile).toEqual({ learningLanguage: 'ko', supportLanguage: null });

    changesCallback?.({ learningProfile: {} });
    expect(useStore.getState().learningProfile).toEqual(DEFAULT_V2_SYNC_STORAGE.learningProfile);
  });

  it('persists canonical values before updating local state', async () => {
    const useStore = createLearningSettingsStore(storage);
    const learningProfile = { learningLanguage: 'ja', supportLanguage: 'en' } as const;
    const subtitleDisplay = structuredClone(DEFAULT_V2_SYNC_STORAGE.subtitleDisplay);
    subtitleDisplay.support.visibility = 'hidden';

    await useStore.getState().setLearningProfile(learningProfile);
    await useStore.getState().setSubtitleDisplay(subtitleDisplay);

    expect(storage.set).toHaveBeenNthCalledWith(1, 'learningProfile', learningProfile);
    expect(storage.set).toHaveBeenNthCalledWith(2, 'subtitleDisplay', subtitleDisplay);
    expect(useStore.getState()).toMatchObject({ learningProfile, subtitleDisplay });
  });
});
