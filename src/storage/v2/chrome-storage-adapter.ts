import { z } from 'zod';

import { ensureV2Ready, V1_11MigrationSource, V2MigrationCoordinatorDependencies } from './migration';
import { registeredSubtitleMetadataSchema, v2LocalDataSchema, v2SyncStorageSchema } from './schema';
import { V2LocalData, V2Marker, V2MigrationState } from './type';
import {
  parseV1_11LocalStorage,
  parseV1_11SyncStorage,
  V1_11_LOCAL_STORAGE_KEYS,
  V1_11_SYNC_STORAGE_KEYS,
} from './v1-11-schema';

interface StorageArea {
  get: (keys?: string | string[] | null) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
  remove: (keys: string | string[]) => Promise<void>;
}

interface MigrationStorage {
  local: StorageArea;
  sync: StorageArea;
}

const V1_SOURCE_SNAPSHOT_KEY = 'v1MigrationSource';
const V2_LOCAL_DATA_KEYS = [
  'learningCards',
  'listeningProgress',
  'registeredSubtitles',
  'migrationState',
] as const;
const V2_SYNC_STORAGE_KEYS = [
  'learningProfile',
  'subtitleDisplay',
  'shortcuts',
  'playbackSpeed',
] as const;
const V1_LOCAL_CLEANUP_KEYS = [V1_SOURCE_SNAPSHOT_KEY, 'savedSubtitles'] as const;
const V1_SYNC_CLEANUP_KEYS = [
  'primarySubtitle',
  'secondarySubtitle',
  'videoSkip',
  'subVideoSkip',
  'loop',
] as const;

const sourceSnapshotSchema = z
  .object({
    sync: z.unknown(),
    local: z.unknown(),
  })
  .strict();

export const createV2MigrationDependencies = (
  storage: MigrationStorage
): V2MigrationCoordinatorDependencies => ({
  readVersion: async () => {
    const result = await storage.local.get('dataSchemaVersion');
    return result.dataSchemaVersion;
  },
  readSource: async () => {
    const snapshotResult = await storage.local.get(V1_SOURCE_SNAPSHOT_KEY);
    if (hasOwn(snapshotResult, V1_SOURCE_SNAPSHOT_KEY)) {
      return { kind: 'v1.11', value: parseSourceSnapshot(snapshotResult[V1_SOURCE_SNAPSHOT_KEY]) };
    }

    const [syncValues, localValues] = await Promise.all([
      storage.sync.get([...V1_11_SYNC_STORAGE_KEYS]),
      storage.local.get(null),
    ]);
    if (hasOwn(localValues, 'migrationState')) {
      if (isFreshInitializationRetry(syncValues, localValues)) return { kind: 'fresh' };
      throw new Error('Unmarked V2 migration state is invalid');
    }
    const source = createLiveSource(syncValues, localValues);
    return hasLiveV1Source(syncValues, localValues)
      ? { kind: 'v1.11', value: source }
      : { kind: 'fresh' };
  },
  preserveSource: async (source) => {
    validateSource(source);
    const existing = await storage.local.get(V1_SOURCE_SNAPSHOT_KEY);
    if (hasOwn(existing, V1_SOURCE_SNAPSHOT_KEY)) {
      assertEquivalent(parseSourceSnapshot(existing[V1_SOURCE_SNAPSHOT_KEY]), source, 'source snapshot');
      return;
    }

    await storage.local.set({ [V1_SOURCE_SNAPSHOT_KEY]: source });
    const readback = await storage.local.get(V1_SOURCE_SNAPSHOT_KEY);
    if (!hasOwn(readback, V1_SOURCE_SNAPSHOT_KEY)) {
      throw new Error('V1 source snapshot was not persisted');
    }
    assertEquivalent(parseSourceSnapshot(readback[V1_SOURCE_SNAPSHOT_KEY]), source, 'source snapshot');
  },
  writeLocal: async (data) => {
    const physical: Record<string, unknown> = {
      learningCards: data.learningCards,
      listeningProgress: data.listeningProgress,
      registeredSubtitles: data.registeredSubtitles,
      migrationState: data.migrationState,
    };
    for (const [id, body] of Object.entries(data.subtitleBodies)) physical[id] = body;
    await storage.local.set(physical);
  },
  writeSync: async (data) => {
    await storage.sync.set(data);
  },
  readLocal: async () => {
    const fixed = await storage.local.get([...V2_LOCAL_DATA_KEYS]);
    const metadata = registeredSubtitleMetadataSchema.array().parse(fixed.registeredSubtitles);
    const bodyIds = metadata.map(({ id }) => id);
    const physicalBodies = bodyIds.length > 0 ? await storage.local.get(bodyIds) : {};
    const subtitleBodies = Object.fromEntries(bodyIds.map((id) => [id, physicalBodies[id]]));
    return {
      learningCards: fixed.learningCards,
      listeningProgress: fixed.listeningProgress,
      registeredSubtitles: fixed.registeredSubtitles,
      migrationState: fixed.migrationState,
      subtitleBodies,
    } satisfies Record<keyof V2LocalData, unknown>;
  },
  readSync: async () => {
    const values = await storage.sync.get([...V2_SYNC_STORAGE_KEYS]);
    return Object.fromEntries(V2_SYNC_STORAGE_KEYS.map((key) => [key, values[key]]));
  },
  writeMarker: async (marker: V2Marker) => {
    await storage.local.set({
      dataSchemaVersion: marker.dataSchemaVersion,
      migrationState: marker.migrationState,
    });
  },
  cleanupSource: async () => {
    await storage.local.remove([...V1_LOCAL_CLEANUP_KEYS]);
    await storage.sync.remove([...V1_SYNC_CLEANUP_KEYS]);
  },
  writeCompletionState: async (state: V2MigrationState) => {
    await storage.local.set({ migrationState: state });
  },
});

export const runV2Migration = (storage: MigrationStorage) => {
  return ensureV2Ready(createV2MigrationDependencies(storage));
};

const createLiveSource = (
  syncValues: Record<string, unknown>,
  localValues: Record<string, unknown>
): V1_11MigrationSource => ({
  sync: pickPresent(syncValues, V1_11_SYNC_STORAGE_KEYS),
  local: {
    ...pickPresent(localValues, V1_11_LOCAL_STORAGE_KEYS),
    subtitleBodies: Object.fromEntries(
      Object.entries(localValues).filter(([key]) => key.startsWith('subtitle-'))
    ),
  },
});

const hasLiveV1Source = (syncValues: Record<string, unknown>, localValues: Record<string, unknown>) => {
  return (
    V1_11_SYNC_STORAGE_KEYS.some((key) => hasOwn(syncValues, key)) ||
    V1_11_LOCAL_STORAGE_KEYS.some((key) => hasOwn(localValues, key)) ||
    Object.keys(localValues).some((key) => key.startsWith('subtitle-'))
  );
};

const isFreshInitializationRetry = (
  syncValues: Record<string, unknown>,
  localValues: Record<string, unknown>
) => {
  if (
    V1_SYNC_CLEANUP_KEYS.some((key) => hasOwn(syncValues, key)) ||
    hasOwn(localValues, 'savedSubtitles') ||
    Object.keys(localValues).some((key) => key.startsWith('subtitle-'))
  ) {
    return false;
  }

  const localResult = v2LocalDataSchema.safeParse({
    learningCards: localValues.learningCards,
    listeningProgress: localValues.listeningProgress,
    registeredSubtitles: localValues.registeredSubtitles,
    migrationState: localValues.migrationState,
    subtitleBodies: {},
  });
  if (!localResult.success) return false;
  const { learningCards, listeningProgress, migrationState, registeredSubtitles } = localResult.data;
  if (
    learningCards.length > 0 ||
    Object.keys(listeningProgress.videos).length > 0 ||
    registeredSubtitles.length > 0 ||
    migrationState.status !== 'writing' ||
    migrationState.sourceVersion !== null ||
    migrationState.shortcutConfirmations.length > 0 ||
    migrationState.unavailableRegisteredSubtitles.length > 0
  ) {
    return false;
  }

  const sync = pickPresent(syncValues, V2_SYNC_STORAGE_KEYS);
  const presentSyncKeys = Object.keys(sync).length;
  return presentSyncKeys === 0 || (presentSyncKeys === V2_SYNC_STORAGE_KEYS.length && v2SyncStorageSchema.safeParse(sync).success);
};

const parseSourceSnapshot = (value: unknown): V1_11MigrationSource => {
  const parsed = sourceSnapshotSchema.parse(value);
  const source: V1_11MigrationSource = { sync: parsed.sync, local: parsed.local };
  validateSource(source);
  return source;
};

const validateSource = ({ local, sync }: V1_11MigrationSource) => {
  parseV1_11SyncStorage(sync);
  parseV1_11LocalStorage(local);
};

const pickPresent = <K extends string>(values: Record<string, unknown>, keys: readonly K[]) => {
  return Object.fromEntries(keys.filter((key) => hasOwn(values, key)).map((key) => [key, values[key]]));
};

const hasOwn = (value: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(value, key);

const assertEquivalent = (actual: unknown, expected: unknown, area: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`V2 ${area} readback did not match the written data`);
  }
};
