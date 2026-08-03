import {
  SessionStorageChanges,
  SessionStorageKey,
  SessionStorageSchema,
} from './session-type';

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
