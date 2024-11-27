import { SETTINGS } from './constants';
import { SubtitleLanguage } from './subtitle';

export type SubKeyConfig = {
  enabled: boolean;
  forward: string;
  backward: string;
  skipTime: number;
};
export type SubtitleConfig = {
  enabled: boolean;
  language: SubtitleLanguage;
  positionReference: 'top' | 'center' | 'bottom';
  positionOffset: number;
  color: string;
  fontSize: number;
  fontWeight: number;
  opacity: number;
  lineBreak: boolean;
};

export type StorageSchema = {
  skipTime: number;
  subKey: SubKeyConfig;
  primarySubtitle: SubtitleConfig;
  secondarySubtitle: SubtitleConfig;
};
type StorageKey = keyof StorageSchema;

type StorageChange<T> = {
  oldValue?: T;
  newValue?: T;
};

export type StorageChanges = {
  [K in StorageKey]?: StorageChange<StorageSchema[K]>;
};

export const setStorage = <K extends StorageKey>(key: K, value: StorageSchema[K]) => {
  return chrome.storage.sync.set({ [key]: value });
};

export const getStorage = <K extends StorageKey>(key: K): Promise<StorageSchema[K] | undefined> => {
  return new Promise((resolve) => {
    chrome.storage.sync.get(key, (result) => {
      resolve(result[key]);
    });
  });
};

export const removeStorage = <K extends StorageKey>(key: K) => {
  return chrome.storage.sync.remove(key);
};

export const onStorageChange = (callback: (changes: StorageChanges) => void) => {
  chrome.storage.sync.onChanged.addListener(callback);
};

export type LocalStorageSchema = {};
type LocalStorageKey = keyof LocalStorageSchema;

export type LocalStorageChanges = {
  [K in LocalStorageKey]?: StorageChange<LocalStorageSchema[K]>;
};

export const setLocalStorage = <K extends LocalStorageKey>(key: K, value: LocalStorageSchema[K]) => {
  return chrome.storage.local.set({ [key]: value });
};

export const getLocalStorage = <K extends LocalStorageKey>(key: K): Promise<LocalStorageSchema[K] | undefined> => {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result[key]);
    });
  });
};

export const removeLocalStorage = <K extends LocalStorageKey>(key: K) => {
  return chrome.storage.local.remove(key);
};

export const onLocalStorageChange = (callback: (changes: LocalStorageChanges) => void) => {
  chrome.storage.local.onChanged.addListener(callback);
};

type LegacyMigration = {
  newKey: StorageKey;
  transform: (data: any) => any;
};

const LEGACY_MIGRATIONS: Record<string, LegacyMigration> = {
  englishSubtitle: {
    newKey: SETTINGS.SUBTITLES.PRIMARY.STORAGE_KEY,
    transform: (oldData) => oldData,
  },
  koreanSubtitle: {
    newKey: SETTINGS.SUBTITLES.SECONDARY.STORAGE_KEY,
    transform: (oldData) => oldData,
  },
};

export const migrateLegacyStorage = async () => {
  const migrationPromises = Object.entries(LEGACY_MIGRATIONS).map(async ([legacyKey, { newKey, transform }]) => {
    await migrateStorage(legacyKey, newKey, transform);
  });
  await Promise.all(migrationPromises);
};

const migrateStorage = async (oldKey: string, newKey: StorageKey, transform: (data: any) => any) => {
  try {
    const result = await chrome.storage.sync.get(oldKey);
    const oldData = result[oldKey];

    if (!oldData) return false;

    const newData = transform(oldData);
    await setStorage(newKey, newData);
    await chrome.storage.sync.remove(oldKey);

    return true;
  } catch (error) {
    console.error(`Migration failed for ${oldKey} to ${newKey}:`, error);
    return false;
  }
};
