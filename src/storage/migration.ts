import { StorageKey, StorageSchema } from './type';

type TransformFunction<T extends StorageKey> = (oldData: any) => StorageSchema[T];
type LegacyMigration<T extends StorageKey> = {
  newKey: T;
  transform: TransformFunction<T>;
};

const createMigration = <T extends StorageKey>(migration: LegacyMigration<T>) => migration;

export const LEGACY_MIGRATIONS = {
  // Example migrations:
  // 1.4.x => 1.5.x
  // skipTime: createMigration({
  //   newKey: SETTINGS.VIDEO_SKIP.STORAGE_KEY,
  //   transform: (oldData) => ({
  //     ...DEFAULT_CONFIG[SETTINGS.VIDEO_SKIP.STORAGE_KEY],
  //     skipTime: oldData,
  //   }),
  // }),
  // subKey: createMigration({
  //   newKey: SETTINGS.SUB_VIDEO_SKIP.STORAGE_KEY,
  //   transform: (oldData) => ({
  //     ...DEFAULT_CONFIG[SETTINGS.SUB_VIDEO_SKIP.STORAGE_KEY],
  //     ...oldData,
  //   }),
  // }),
} as const;

export const migrateLegacyStorage = () => {
  const migrationPromises = Object.entries(LEGACY_MIGRATIONS).map(([legacyKey, { newKey, transform }]) =>
    migrateStorage(legacyKey, newKey, transform)
  );
  return Promise.all(migrationPromises);
};

const migrateStorage = async <T extends StorageKey>(oldKey: string, newKey: T, transform: TransformFunction<T>) => {
  try {
    const result = await chrome.storage.sync.get(oldKey);
    const oldData = result[oldKey];
    if (!oldData) return false;

    await chrome.storage.sync.remove(oldKey);
    await chrome.storage.sync.set({ [newKey]: transform(oldData) });
    return true;
  } catch (error) {
    console.error(`Migration failed for ${oldKey} to ${newKey}:`, error);
  }
};
