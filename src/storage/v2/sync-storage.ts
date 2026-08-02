import { z } from 'zod';

import { DEFAULT_V2_SYNC_STORAGE } from './default';
import {
  learningControlsSchema,
  learningProfileSchema,
  subtitleDisplaySchema,
  v2PlaybackSpeedSchema,
  v2ShortcutsSchema,
} from './schema';
import { V2SyncStorage } from './type';

export type V2SyncStorageKey = keyof V2SyncStorage;

export type V2SyncStorageChange<T> = {
  oldValue?: T;
  newValue?: T;
};

export type V2SyncStorageChanges = {
  [K in V2SyncStorageKey]?: V2SyncStorageChange<V2SyncStorage[K]>;
};

interface RawStorageChange {
  oldValue?: unknown;
  newValue?: unknown;
}

interface StorageChangeEvent {
  addListener: (callback: (changes: Record<string, RawStorageChange>) => void) => void;
  removeListener: (callback: (changes: Record<string, RawStorageChange>) => void) => void;
}

export interface V2SyncStorageArea {
  get: (keys?: string | string[] | null) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
  onChanged: StorageChangeEvent;
}

export interface V2SyncStorageApi {
  get: <K extends V2SyncStorageKey>(key: K) => Promise<V2SyncStorage[K]>;
  getAll: () => Promise<V2SyncStorage>;
  set: <K extends V2SyncStorageKey>(key: K, value: V2SyncStorage[K]) => Promise<void>;
  subscribe: (callback: (changes: V2SyncStorageChanges) => void) => { remove: () => void };
}

const V2_SYNC_STORAGE_KEYS = [
  'learningProfile',
  'subtitleDisplay',
  'learningControls',
  'shortcuts',
  'playbackSpeed',
] as const satisfies readonly V2SyncStorageKey[];

const V2_SYNC_STORAGE_SCHEMAS = {
  learningProfile: learningProfileSchema,
  subtitleDisplay: subtitleDisplaySchema,
  learningControls: learningControlsSchema,
  shortcuts: v2ShortcutsSchema,
  playbackSpeed: v2PlaybackSpeedSchema,
} satisfies { [K in V2SyncStorageKey]: z.ZodType<V2SyncStorage[K]> };

export const createV2SyncStorage = (storage: V2SyncStorageArea): V2SyncStorageApi => ({
  get: async (key) => {
    const values = await storage.get(key);
    return parseStoredValue(key, values[key]);
  },
  getAll: async () => {
    const values = await storage.get([...V2_SYNC_STORAGE_KEYS]);
    return Object.fromEntries(
      V2_SYNC_STORAGE_KEYS.map((key) => [key, parseStoredValue(key, values[key])])
    ) as V2SyncStorage;
  },
  set: async (key, value) => {
    const parsed = V2_SYNC_STORAGE_SCHEMAS[key].parse(value) as V2SyncStorage[typeof key];
    await storage.set({ [key]: parsed });
  },
  subscribe: (callback) => {
    const listener = (rawChanges: Record<string, RawStorageChange>) => {
      const changes: V2SyncStorageChanges = {};

      for (const key of V2_SYNC_STORAGE_KEYS) {
        const rawChange = rawChanges[key];
        if (!rawChange) continue;

        const change = {
          ...(rawChange.oldValue === undefined ? {} : { oldValue: parseValue(key, rawChange.oldValue) }),
          ...(rawChange.newValue === undefined ? {} : { newValue: parseValue(key, rawChange.newValue) }),
        };
        Object.assign(changes, { [key]: change });
      }

      if (Object.keys(changes).length > 0) callback(changes);
    };

    storage.onChanged.addListener(listener);
    return { remove: () => storage.onChanged.removeListener(listener) };
  },
});

const parseStoredValue = <K extends V2SyncStorageKey>(key: K, value: unknown): V2SyncStorage[K] => {
  if (value === undefined) return structuredClone(DEFAULT_V2_SYNC_STORAGE[key]);
  return parseValue(key, value);
};

const parseValue = <K extends V2SyncStorageKey>(key: K, value: unknown): V2SyncStorage[K] => {
  return V2_SYNC_STORAGE_SCHEMAS[key].parse(value) as V2SyncStorage[K];
};
