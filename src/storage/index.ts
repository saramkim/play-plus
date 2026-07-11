import { DEFAULT_CONFIG } from './default';
import { storageSchema } from './schema';
import {
  LocalStorageChanges,
  LocalStorageKey,
  LocalStorageSchema,
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
      resolve(validateStorageValue(key, result[key]));
    });
  });
};

export const getStorageAll = (): Promise<StorageSchema> => {
  const configKeys = Object.keys(DEFAULT_CONFIG);
  return new Promise<StorageSchema>((resolve) => {
    chrome.storage.sync.get(configKeys, (result) => {
      const configs = configKeys.reduce(
        (acc, key) => ({ ...acc, [key]: validateStorageValue(key as StorageKey, result[key]) }),
        {} as StorageSchema
      );
      resolve(configs);
    });
  });
};

const validateStorageValue = <K extends StorageKey>(key: K, persisted: unknown): StorageSchema[K] => {
  const candidate = { ...DEFAULT_CONFIG[key], ...(typeof persisted === 'object' ? persisted : {}) };
  const schema = storageSchema[key];
  const result = schema.safeParse(candidate);
  if (result.success) return result.data as StorageSchema[K];

  console.warn('Invalid persisted storage value', { key, issues: result.error.issues });
  const sanitized = { ...candidate } as Record<string, unknown>;
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string') sanitized[field] = (DEFAULT_CONFIG[key] as Record<string, unknown>)[field];
  }

  const sanitizedResult = schema.safeParse(sanitized);
  return sanitizedResult.success ? (sanitizedResult.data as StorageSchema[K]) : DEFAULT_CONFIG[key];
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
