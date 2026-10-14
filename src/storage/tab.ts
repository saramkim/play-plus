import { SubtitleData } from '@utils/parse';

import { SubtitleId } from './subtitle';

const KEY_PREFIX = 'tab_';

export type TabInfo = {
  primarySubtitle?: SubtitleId | null;
  secondarySubtitle?: SubtitleId | null;
  en?: SubtitleData[] | null;
  ko?: SubtitleData[] | null;
  nativeVideoId?: string | null;
  nativeRequestId?: number;
  connectionStatus?: ConnectionStatus;
  videoStatus?: VideoStatus;
};

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';
export type VideoStatus = 'idle' | 'detecting' | 'detected' | 'not_detected';

const updates = new Map<number, Promise<void>>();
type TabInfoUpdate = TabInfo | ((current: TabInfo) => Promise<TabInfo | undefined>);

// Serialize read/modify/write operations within this context, including native invalidation.
// This is not a cross-context storage lock.
export const updateTabInfo = (tabId: number, info: TabInfoUpdate): Promise<void> => {
  const task = (updates.get(tabId) ?? Promise.resolve()).catch(() => {}).then(async () => {
    const current = await getTabInfo(tabId) ?? {};
    const patch = typeof info === 'function' ? await info(current) : info;
    if (patch) await chrome.storage.session.set({ [KEY_PREFIX + tabId.toString()]: { ...current, ...patch } });
  });
  updates.set(tabId, task);
  void task.finally(() => { if (updates.get(tabId) === task) updates.delete(tabId); }).catch(() => {});
  return task;
};

export const getTabInfo = (tabId: number): Promise<TabInfo | undefined> => {
  return new Promise((resolve, reject) => {
    const key = KEY_PREFIX + tabId.toString();
    chrome.storage.session.get(key, (result) => {
      if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
      resolve(result[key]);
    });
  });
};

export const removeTabInfo = (tabId: number) => {
  const key = KEY_PREFIX + tabId.toString();
  return chrome.storage.session.remove(key);
};

export const onTabInfoChange = (callback: (tabId: number, info: TabInfo) => void) => {
  const { onChanged } = chrome.storage.session;
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
    for (const key in changes) {
      if (!key.startsWith(KEY_PREFIX)) continue;
      const tabId = parseInt(key.replace(KEY_PREFIX, ''));
      callback(tabId, changes[key].newValue);
    }
  };
  onChanged.addListener(listener);
  return { remove: () => onChanged.removeListener(listener) };
};
