import { setSessionStorage } from '@storage/session';
import type { PendingSubtitleRequest } from '@storage/session-type';
import { updateTabInfo } from '@storage/tab';
import { COUPANG_PLAY_BASE_URL, COUPANG_PLAY_VIDEO_URL_LIST } from '@utils/constants';

import { createTabLifecycleDependencies, handleTabCompleted } from './tab-lifecycle';

type TabEventDependencies = {
  awaitReady: () => Promise<void>;
  checkContentConnection: (tabId: number, isVideoUrl: boolean) => Promise<void>;
  sendSubtitleRequest: (tabId: number, request: PendingSubtitleRequest) => Promise<void>;
};

export type ActivatedTabDependencies = {
  awaitReady: TabEventDependencies['awaitReady'];
  checkContentConnection: TabEventDependencies['checkContentConnection'];
  getTab: (tabId: number) => Promise<chrome.tabs.Tab>;
  setActiveTab: (tab: chrome.tabs.Tab) => Promise<void>;
  updateTabInfo: typeof updateTabInfo;
};

export const handleTabActivated = async (tabId: number, dependencies: ActivatedTabDependencies) => {
  await dependencies.awaitReady();
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
    awaitReady: dependencies.awaitReady,
    checkContentConnection: dependencies.checkContentConnection,
    getTab: (tabId) => chrome.tabs.get(tabId),
    setActiveTab: async (tab) => {
      await setSessionStorage('activeTab', tab);
    },
    updateTabInfo,
  };
  chrome.tabs.onActivated.addListener(({ tabId }) => {
    void handleTabActivated(tabId, activatedTabDependencies).catch(() =>
      console.error('Unable to handle the activated tab')
    );
  });

  const tabLifecycleDependencies = {
    ...createTabLifecycleDependencies,
    checkContentConnection: dependencies.checkContentConnection,
    sendSubtitleRequest: dependencies.sendSubtitleRequest,
    awaitReady: dependencies.awaitReady,
  };
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') return;
    void handleTabCompleted(tabId, tab, tabLifecycleDependencies).catch(() =>
      console.error('Unable to handle the completed tab')
    );
  });
};
