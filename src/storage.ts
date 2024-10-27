type StorageSchema = {};
type StorageKey = keyof StorageSchema;

export const setStorage = <K extends StorageKey>(key: K, value: StorageSchema[K]) => {
  return chrome.storage.sync.set({ [key]: value });
};

export const getStorage = <K extends StorageKey>(key: K): Promise<StorageSchema[K]> => {
  return new Promise((resolve) => {
    chrome.storage.sync.get(key, (result) => {
      resolve(result[key]);
    });
  });
};
