import { PageName } from './constants';
import { SubtitleLanguage } from './subtitle';

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
};

export type StorageSchema = {
  videoSkip: VideoSkipConfig;
  subVideoSkip: VideoSkipConfig;
  primarySubtitle: SubtitleConfig;
  secondarySubtitle: SubtitleConfig;
  shortcuts: ShortcutsConfig;
};
export type StorageKey = keyof StorageSchema;

export type StorageChange<T> = {
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
