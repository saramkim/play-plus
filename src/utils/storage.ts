import { PageName } from './constants';
import { DEFAULT_CONFIG } from './default';
import { getMessage } from './i18n';
import { SubtitleLanguage } from './subtitle';
import { validate } from './validation';

export type SkipTimeUnit = 'seconds' | 'minutes' | 'subtitles';
export type VideoSkipConfig = {
  enabled: boolean;
  forward: string;
  backward: string;
  skipTime: number;
  skipTimeUnit: SkipTimeUnit;
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
export type ShortcutsConfig = {
  enabled: boolean;
  savePrimary: string;
  saveSecondary: string;
  togglePrimary: string;
  toggleSecondary: string;
};
export type LoopConfig = {
  enabled: boolean;
  toggleLoop: string;
  startPoint: string;
  endPoint: string;
  loopCurrentSubtitle: string;
};

export type StorageSchema = {
  videoSkip: VideoSkipConfig;
  subVideoSkip: VideoSkipConfig;
  primarySubtitle: SubtitleConfig;
  secondarySubtitle: SubtitleConfig;
  shortcuts: ShortcutsConfig;
  loop: LoopConfig;
};
export type StorageKey = keyof StorageSchema;

export type StorageChange<T> = {
  oldValue?: T;
  newValue?: T;
};

export type StorageChanges = {
  [K in StorageKey]?: StorageChange<StorageSchema[K]>;
};

const storageCache = new Map<StorageKey, StorageSchema[StorageKey]>();

type Response = { success: true } | { success: false; error: Error };

export const setStorage = async <K extends StorageKey>(key: K, value: StorageSchema[K]): Promise<Response> => {
  try {
    validate(storageCache, key, value);
    await chrome.storage.sync.set({ [key]: value });
    storageCache.set(key, value);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error : new Error(getMessage('error_unknown')) };
  }
};

export const getStorage = <K extends StorageKey>(key: K): Promise<StorageSchema[K] | undefined> => {
  return new Promise((resolve) => {
    chrome.storage.sync.get(key, (result) => {
      const value = result[key];
      resolve(value);
      if (value) storageCache.set(key, value);
      else storageCache.delete(key);
    });
  });
};

export const updateStorage = async <K extends StorageKey>(
  key: K,
  updates: (value: StorageSchema[K]) => Partial<StorageSchema[K]>
) => {
  const value = (await getStorage(key)) || DEFAULT_CONFIG[key];
  return await setStorage(key, { ...value, ...updates(value) });
};

export const removeStorage = <K extends StorageKey>(key: K) => {
  return chrome.storage.sync.remove(key);
};

export const onStorageChange = (callback: (changes: StorageChanges) => void) => {
  const { onChanged } = chrome.storage.sync;
  onChanged.addListener(callback);
  return { remove: () => onChanged.removeListener(callback) };
};

export type SavedSubtitle = {
  content: string;
  url: string;
  startTime: number;
  savedAt: string;
};

export type LocalStorageSchema = {
  savedSubtitles: SavedSubtitle[];
  lastViewedPage: PageName;
};
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
  const { onChanged } = chrome.storage.local;
  onChanged.addListener(callback);
  return { remove: () => onChanged.removeListener(callback) };
};
