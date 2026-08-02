import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import { DEFAULT_V2_SYNC_STORAGE } from './default';
import { createV2SyncStorage, V2SyncStorageArea } from './sync-storage';

describe('v2 sync storage', () => {
  it('accepts the production Chrome sync storage shape', () => {
    expectTypeOf(chrome.storage.sync).toMatchTypeOf<V2SyncStorageArea>();
  });

  it('returns canonical defaults only for missing keys', async () => {
    const storage = new FakeSyncStorage();
    const api = createV2SyncStorage(storage);

    await expect(api.get('learningProfile')).resolves.toEqual(DEFAULT_V2_SYNC_STORAGE.learningProfile);
    await expect(api.getAll()).resolves.toEqual(DEFAULT_V2_SYNC_STORAGE);
  });

  it('fails closed when a persisted canonical value is invalid', async () => {
    const storage = new FakeSyncStorage({ learningProfile: { learningLanguage: 'unknown' } });
    const api = createV2SyncStorage(storage);

    await expect(api.get('learningProfile')).rejects.toThrow();
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
