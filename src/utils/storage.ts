export type SubKeyConfig = {
  enabled: boolean;
  forward: string;
  backward: string;
  skipTime: number;
};
export type SubtitleConfig = {
  enabled: boolean;
  color: string;
  fontSize: number;
  fontWeight: number;
  opacity: number;
  lineBreak: boolean;
};

type StorageSchema = {
  skipTime: number;
  subKey: SubKeyConfig;
  englishSubtitle: SubtitleConfig;
  koreanSubtitle: SubtitleConfig;
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
