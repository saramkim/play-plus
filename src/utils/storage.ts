export type SubKeyConfig = { forward: string; backward: string; skipTime: number };
export type SubtitleConfig = { enabled: boolean };

type StorageSchema = {
  skipTime: number;
  subKey: SubKeyConfig;
  englishSubtitle: SubtitleConfig;
  koreanSubtitle: SubtitleConfig;
};
type StorageKey = keyof StorageSchema;

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
