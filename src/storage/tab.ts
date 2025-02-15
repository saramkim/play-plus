import { SubtitleId } from './subtitle';

export type TabInfo = {
  primarySubtitle?: SubtitleId;
  secondarySubtitle?: SubtitleId;
};

export const updateTabInfo = async (tabId: number, info: TabInfo) => {
  const currentInfo = await getTabInfo(tabId);
  return chrome.storage.session.set({ [tabId.toString()]: currentInfo ? { ...currentInfo, ...info } : info });
};

export const getTabInfo = (tabId: number): Promise<TabInfo | undefined> => {
  return new Promise((resolve) => {
    chrome.storage.session.get(tabId.toString(), (result) => {
      resolve(result[tabId.toString()]);
    });
  });
};

export const removeTabInfo = (tabId: number) => {
  return chrome.storage.session.remove(tabId.toString());
};
