import { SubtitleData } from '@utils/parse';

import { SubtitleId } from './subtitle';

const KEY_PREFIX = 'tab_';

export type TabInfo = {
  primarySubtitle?: SubtitleId;
  secondarySubtitle?: SubtitleId;
  en?: SubtitleData[];
  ko?: SubtitleData[];
};

export const updateTabInfo = async (tabId: number, info: TabInfo) => {
  const currentInfo = await getTabInfo(tabId);
  const key = KEY_PREFIX + tabId.toString();
  return chrome.storage.session.set({ [key]: currentInfo ? { ...currentInfo, ...info } : info });
};

export const getTabInfo = (tabId: number): Promise<TabInfo | undefined> => {
  return new Promise((resolve) => {
    const key = KEY_PREFIX + tabId.toString();
    chrome.storage.session.get(key, (result) => {
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
