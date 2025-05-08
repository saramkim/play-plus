import { DEFAULT_CONFIG } from './default';
import {
  LocalStorageChanges,
  LocalStorageKey,
  LocalStorageSchema,
  SessionStorageChanges,
  SessionStorageKey,
  SessionStorageSchema,
  StorageChanges,
  StorageKey,
  StorageSchema,
} from './type';

export const setStorage = <K extends StorageKey>(key: K, value: StorageSchema[K]) => {
  return chrome.storage.sync.set({ [key]: value });
};

export const setStorageAll = (config: StorageSchema) => {
  return chrome.storage.sync.set(config);
};

export const getStorage = <K extends StorageKey>(key: K): Promise<StorageSchema[K]> => {
  return new Promise((resolve) => {
    chrome.storage.sync.get(key, (result) => {
      const value = { ...DEFAULT_CONFIG[key], ...result[key] };
      resolve(value);
    });
  });
};

export const getStorageAll = (): Promise<StorageSchema> => {
  const configKeys = Object.keys(DEFAULT_CONFIG);
  return new Promise<StorageSchema>((resolve) => {
    chrome.storage.sync.get(configKeys, (result) => {
      const configs = configKeys.reduce(
        (acc, key) => ({ ...acc, [key]: { ...DEFAULT_CONFIG[key], ...result[key] } }),
        {} as StorageSchema
      );
      resolve(configs);
    });
  });
};

export const updateStorage = async <K extends StorageKey>(
  key: K,
  updates: (value: StorageSchema[K]) => Partial<StorageSchema[K]>
) => {
  const value = await getStorage(key);
  return await setStorage(key, { ...value, ...updates(value) });
};

export const removeStorage = <K extends StorageKey>(key: K) => {
  return chrome.storage.sync.remove(key);
};

export const clearStorage = () => {
  return chrome.storage.sync.clear();
};

export const onStorageChange = (callback: (changes: StorageChanges) => void) => {
  const { onChanged } = chrome.storage.sync;
  onChanged.addListener(callback);
  return { remove: () => onChanged.removeListener(callback) };
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

export const setSessionStorage = <K extends SessionStorageKey>(key: K, value: SessionStorageSchema[K]) => {
  return chrome.storage.session.set({ [key]: value });
};

export const getSessionStorage = <K extends SessionStorageKey>(
  key: K
): Promise<SessionStorageSchema[K] | undefined> => {
  return new Promise((resolve) => {
    chrome.storage.session.get(key, (result) => {
      resolve(result[key]);
    });
  });
};

export const removeSessionStorage = <K extends SessionStorageKey>(key: K) => {
  return chrome.storage.session.remove(key);
};

export const onSessionStorageChange = (callback: (changes: SessionStorageChanges) => void) => {
  const { onChanged } = chrome.storage.session;
  onChanged.addListener(callback);
  return { remove: () => onChanged.removeListener(callback) };
};
