import { setSessionStorage } from '@storage/session';
import { updateTabInfo } from '@storage/tab';
import { COUPANG_PLAY_BASE_URL, COUPANG_PLAY_VIDEO_URL_LIST } from '@utils/constants';

import { PendingSubtitleRequest } from './pending-actions';
import { createTabLifecycleDependencies, handleTabCompleted } from './tab-lifecycle';

type TabEventDependencies = {
  checkContentConnection: (tabId: number, isVideoUrl: boolean) => Promise<void>;
  sendSubtitleRequest: (tabId: number, request: PendingSubtitleRequest) => Promise<void>;
};

export type ActivatedTabDependencies = {
  checkContentConnection: TabEventDependencies['checkContentConnection'];
  getTab: (tabId: number) => Promise<chrome.tabs.Tab>;
  setActiveTab: (tab: chrome.tabs.Tab) => Promise<void>;
  updateTabInfo: typeof updateTabInfo;
};

export const handleTabActivated = async (tabId: number, dependencies: ActivatedTabDependencies) => {
  const tab = await dependencies.getTab(tabId);
  await dependencies.setActiveTab(tab);
  if (tab.id === undefined || !tab.url?.startsWith(COUPANG_PLAY_BASE_URL)) return;

  const isVideoUrl = COUPANG_PLAY_VIDEO_URL_LIST.some((url) => tab.url?.startsWith(url));
  await dependencies.updateTabInfo(tab.id, {
    connectionStatus: 'connecting',
    videoStatus: isVideoUrl ? 'detecting' : 'idle',
  });
  await dependencies.checkContentConnection(tab.id, isVideoUrl);
};

export const registerTabEvents = (dependencies: TabEventDependencies) => {
  const activatedTabDependencies: ActivatedTabDependencies = {
    checkContentConnection: dependencies.checkContentConnection,
    getTab: (tabId) => chrome.tabs.get(tabId),
    setActiveTab: async (tab) => {
      await setSessionStorage('activeTab', tab);
    },
    updateTabInfo,
  };
  chrome.tabs.onActivated.addListener(({ tabId }) => {
    void handleTabActivated(tabId, activatedTabDependencies).catch((error) =>
      console.error('Error handling activated tab:', error)
    );
  });

  const tabLifecycleDependencies = {
    ...createTabLifecycleDependencies,
    checkContentConnection: dependencies.checkContentConnection,
    sendSubtitleRequest: dependencies.sendSubtitleRequest,
  };
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') return;
    void handleTabCompleted(tabId, tab, tabLifecycleDependencies).catch((error) =>
      console.error('Error handling completed tab:', error)
    );
  });
};
