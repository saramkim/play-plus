import { setSessionStorage } from '@storage/session';
import { COUPANG_PLAY_BASE_URL, COUPANG_PLAY_VIDEO_URL_LIST } from '@utils/constants';
import { getCoupangPlayVideoId } from '@utils/coupang-play';

import { createTabLifecycleDependencies, handleTabCompleted } from './tab-lifecycle';

type TabEventDependencies = {
  awaitReady: () => Promise<void>;
  checkContentConnection: (tabId: number, isVideoUrl: boolean) => Promise<void>;
  clearSubtitleReplay: (tabId: number) => Promise<void>;
  handleSubtitleNavigation: (tabId: number, url?: string | null) => Promise<void>;
  updateNavigatingStatus: (
    tabId: number,
    isVideoUrl: boolean,
    expectedVideoId: string | null
  ) => Promise<void>;
};

type ActiveTabDependencies = {
  setActiveTab: (tab: chrome.tabs.Tab) => Promise<void>;
};

export type ActivatedTabDependencies = {
  awaitReady: TabEventDependencies['awaitReady'];
  checkContentConnection: TabEventDependencies['checkContentConnection'];
  getTab: (tabId: number) => Promise<chrome.tabs.Tab>;
  setActiveTab: ActiveTabDependencies['setActiveTab'];
  updateNavigatingStatus: TabEventDependencies['updateNavigatingStatus'];
};

export const createActiveTabSnapshotController = (writeActiveTab: ActiveTabDependencies['setActiveTab']) => {
  let eventRevision = 0;
  let writeQueue = Promise.resolve();

  const enqueue = (tab: chrome.tabs.Tab) => {
    const write = writeQueue.then(() => writeActiveTab(tab));
    writeQueue = write.catch(() => {});
    return write;
  };

  return {
    persistEvent: (tab: chrome.tabs.Tab) => {
      eventRevision += 1;
      return enqueue(tab);
    },
    seed: async (getActiveTab: () => Promise<chrome.tabs.Tab | undefined>) => {
      const seedRevision = eventRevision;
      const tab = await getActiveTab();
      if (!tab || seedRevision !== eventRevision) return undefined;
      await enqueue(tab);
      return tab;
    },
  };
};

export const seedActiveTabConnection = async (
  snapshots: ReturnType<typeof createActiveTabSnapshotController>,
  getActiveTab: () => Promise<chrome.tabs.Tab | undefined>,
  dependencies: ActivatedTabDependencies
) => {
  const tab = await snapshots.seed(getActiveTab);
  if (tab?.id === undefined) return;
  await handleTabActivated(tab.id, dependencies);
};

export const handleActiveTabUrlUpdated = async (
  tab: chrome.tabs.Tab,
  url: string,
  dependencies: ActiveTabDependencies & {
    updateNavigatingStatus: TabEventDependencies['updateNavigatingStatus'];
  }
) => {
  if (!tab.active) return;
  const updatedTab = { ...tab, url };
  const isCoupangPlay = url.startsWith(COUPANG_PLAY_BASE_URL);
  const isVideoUrl = COUPANG_PLAY_VIDEO_URL_LIST.some((videoUrl) => url.startsWith(videoUrl));
  const statusUpdate =
    tab.id !== undefined && isCoupangPlay
      ? dependencies.updateNavigatingStatus(tab.id, isVideoUrl, getCoupangPlayVideoId(url))
      : Promise.resolve();
  await dependencies.setActiveTab(updatedTab);
  await statusUpdate;
};

export const handleTabActivated = async (tabId: number, dependencies: ActivatedTabDependencies) => {
  const tab = await dependencies.getTab(tabId);
  if (!tab.active) return;
  await dependencies.setActiveTab(tab);
  if (tab.id === undefined || !tab.url?.startsWith(COUPANG_PLAY_BASE_URL)) return;

  await dependencies.awaitReady();
  const currentTab = await dependencies.getTab(tabId);
  if (!currentTab.active || currentTab.url !== tab.url || currentTab.id === undefined) return;

  const isVideoUrl = COUPANG_PLAY_VIDEO_URL_LIST.some((url) => currentTab.url?.startsWith(url));
  await dependencies.updateNavigatingStatus(
    currentTab.id,
    isVideoUrl,
    getCoupangPlayVideoId(currentTab.url)
  );
  await dependencies.checkContentConnection(currentTab.id, isVideoUrl);
};

export const registerTabEvents = (dependencies: TabEventDependencies) => {
  const snapshots = createActiveTabSnapshotController(async (tab) => {
    await setSessionStorage('activeTab', tab);
  });
  const activatedTabDependencies: ActivatedTabDependencies = {
    awaitReady: dependencies.awaitReady,
    checkContentConnection: dependencies.checkContentConnection,
    getTab: (tabId) => chrome.tabs.get(tabId),
    setActiveTab: snapshots.persistEvent,
    updateNavigatingStatus: dependencies.updateNavigatingStatus,
  };
  chrome.tabs.onActivated.addListener(({ tabId }) => {
    void handleTabActivated(tabId, activatedTabDependencies).catch(() =>
      console.error('Unable to handle the activated tab')
    );
  });

  void seedActiveTabConnection(
    snapshots,
    async () => {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      return tab;
    },
    activatedTabDependencies
  )
    .catch(() => console.error('Unable to initialize the active tab'));

  const tabLifecycleDependencies = {
    ...createTabLifecycleDependencies,
    clearSubtitleReplay: dependencies.clearSubtitleReplay,
    checkContentConnection: dependencies.checkContentConnection,
    updateNavigatingStatus: dependencies.updateNavigatingStatus,
    awaitReady: dependencies.awaitReady,
  };
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    const subtitleNavigation =
      changeInfo.url === undefined
        ? Promise.resolve()
        : dependencies.handleSubtitleNavigation(tabId, changeInfo.url);
    if (changeInfo.url !== undefined) {
      void handleActiveTabUrlUpdated(tab, changeInfo.url, {
        setActiveTab: snapshots.persistEvent,
        updateNavigatingStatus: dependencies.updateNavigatingStatus,
      }).catch(() => console.error('Unable to update the active tab URL'));
    }
    if (changeInfo.status !== 'complete') {
      void subtitleNavigation.catch(() => console.error('Unable to update subtitle navigation state'));
      return;
    }
    void subtitleNavigation
      .then(() => handleTabCompleted(tabId, tab, tabLifecycleDependencies))
      .catch(() => console.error('Unable to handle the completed tab'));
  });
  chrome.tabs.onRemoved.addListener((tabId) => {
    void dependencies.clearSubtitleReplay(tabId).catch(() =>
      console.error('Unable to clear closed tab state')
    );
  });
};
