import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import { DEFAULT_V2_SYNC_STORAGE } from './default';
import { createV2SyncStorage, V2SyncStorageArea } from './sync-storage';

describe('v2 sync storage', () => {
  it('accepts the production Chrome sync storage shape', () => {
    expectTypeOf(chrome.storage.sync).toMatchTypeOf<V2SyncStorageArea>();
  });

  it('fails closed when canonical keys are missing', async () => {
    const storage = new FakeSyncStorage();
    const api = createV2SyncStorage(storage);

    await expect(api.get('learningProfile')).rejects.toThrow();
    await expect(api.getAll()).rejects.toThrow();
  });

  it('returns clones of strict canonical values', async () => {
    const storage = new FakeSyncStorage({ ...DEFAULT_V2_SYNC_STORAGE });
    const api = createV2SyncStorage(storage);

    const learningProfile = await api.get('learningProfile');
    const all = await api.getAll();
    learningProfile.learningLanguage = 'ko';
    all.subtitleDisplay.learning.appearance.color = '#000000';

    expect(storage.values.learningProfile).toEqual(DEFAULT_V2_SYNC_STORAGE.learningProfile);
    expect(storage.values.subtitleDisplay).toEqual(DEFAULT_V2_SYNC_STORAGE.subtitleDisplay);
  });

  it('fails closed when a persisted canonical value is invalid', async () => {
    const storage = new FakeSyncStorage({ learningProfile: { learningLanguage: 'unknown' } });
    const api = createV2SyncStorage(storage);

    await expect(api.get('learningProfile')).rejects.toThrow();
  });

  it('fails closed when the complete canonical settings contain a shortcut conflict', async () => {
    const storage = new FakeSyncStorage({
      ...DEFAULT_V2_SYNC_STORAGE,
      shortcuts: {
        ...DEFAULT_V2_SYNC_STORAGE.shortcuts,
        saveCard: DEFAULT_V2_SYNC_STORAGE.shortcuts.previousCue,
      },
    });
    const api = createV2SyncStorage(storage);

    await expect(api.getAll()).rejects.toThrow();
  });

  it('validates the complete canonical value before writing', async () => {
    const storage = new FakeSyncStorage();
    const api = createV2SyncStorage(storage);

    await api.set('learningProfile', { learningLanguage: 'ko', supportLanguage: null });
    expect(storage.values.learningProfile).toEqual({ learningLanguage: 'ko', supportLanguage: null });

    await expect(
      api.set('learningProfile', { learningLanguage: 'ko' } as never)
    ).rejects.toThrow();
    expect(storage.setCalls).toHaveLength(1);
  });

  it('writes related canonical settings in one storage operation', async () => {
    const storage = new FakeSyncStorage();
    const api = createV2SyncStorage(storage);

    await api.setMany({
      learningControls: DEFAULT_V2_SYNC_STORAGE.learningControls,
      shortcuts: DEFAULT_V2_SYNC_STORAGE.shortcuts,
      playbackSpeed: DEFAULT_V2_SYNC_STORAGE.playbackSpeed,
    });

    expect(storage.setCalls).toEqual([
      {
        learningControls: DEFAULT_V2_SYNC_STORAGE.learningControls,
        shortcuts: DEFAULT_V2_SYNC_STORAGE.shortcuts,
        playbackSpeed: DEFAULT_V2_SYNC_STORAGE.playbackSpeed,
      },
    ]);
  });

  it('emits only strict canonical changes and removes its listener', () => {
    const storage = new FakeSyncStorage();
    const api = createV2SyncStorage(storage);
    const callback = vi.fn();
    const subscription = api.subscribe(callback);

    storage.emit({
      learningProfile: {
        oldValue: DEFAULT_V2_SYNC_STORAGE.learningProfile,
        newValue: { learningLanguage: 'ko', supportLanguage: null },
      },
      legacyKey: { newValue: true },
    });

    expect(callback).toHaveBeenCalledWith({
      learningProfile: {
        oldValue: DEFAULT_V2_SYNC_STORAGE.learningProfile,
        newValue: { learningLanguage: 'ko', supportLanguage: null },
      },
    });

    subscription.remove();
    storage.emit({ learningProfile: { newValue: DEFAULT_V2_SYNC_STORAGE.learningProfile } });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('fails closed when an observed canonical change is invalid', () => {
    const storage = new FakeSyncStorage();
    const api = createV2SyncStorage(storage);
    api.subscribe(vi.fn());

    expect(() => storage.emit({ learningProfile: { newValue: { learningLanguage: 'unknown' } } })).toThrow();
  });
});

class FakeSyncStorage implements V2SyncStorageArea {
  values: Record<string, unknown>;
  setCalls: Record<string, unknown>[] = [];
  private listeners = new Set<(changes: Record<string, RawStorageChange>) => void>();

  onChanged = {
    addListener: (callback: (changes: Record<string, RawStorageChange>) => void) => this.listeners.add(callback),
    removeListener: (callback: (changes: Record<string, RawStorageChange>) => void) => this.listeners.delete(callback),
  };

  constructor(values: Record<string, unknown> = {}) {
    this.values = structuredClone(values);
  }

  async get(keys: string | string[] | null = null) {
    if (keys === null) return structuredClone(this.values);
    const requested = Array.isArray(keys) ? keys : [keys];
    return Object.fromEntries(
      requested
        .filter((key) => Object.prototype.hasOwnProperty.call(this.values, key))
        .map((key) => [key, structuredClone(this.values[key])])
    );
  }

  async set(items: Record<string, unknown>) {
    const cloned = structuredClone(items);
    this.setCalls.push(cloned);
    Object.assign(this.values, cloned);
  }

  emit(changes: Record<string, RawStorageChange>) {
    for (const listener of this.listeners) listener(structuredClone(changes));
  }
}

interface RawStorageChange {
  oldValue?: unknown;
  newValue?: unknown;
}
