import { DEFAULT_CONFIG } from './default';
import { t } from '../utils/i18n';
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
import { validate } from './validation';

const storageCache = new Map<StorageKey, StorageSchema[StorageKey]>();

type Response = { success: true } | { success: false; error: Error };

export const setStorage = async <K extends StorageKey>(key: K, value: StorageSchema[K]): Promise<Response> => {
  try {
    validate(storageCache, key, value);
    await chrome.storage.sync.set({ [key]: value });
    storageCache.set(key, value);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error : new Error(t('error_unknown')) };
  }
};

export const setStorageAll = async (config: StorageSchema) => {
  Object.entries(config).forEach(([key, value]) => storageCache.set(key, value));
  return chrome.storage.sync.set(config);
};

export const getStorage = <K extends StorageKey>(key: K): Promise<StorageSchema[K]> => {
  return new Promise((resolve) => {
    chrome.storage.sync.get(key, (result) => {
      const value = { ...DEFAULT_CONFIG[key], ...result[key] };
      storageCache.set(key, value);
      resolve(value);
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
