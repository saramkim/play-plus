import { updateTabInfo } from '@storage/tab';
import { COUPANG_PLAY_BASE_URL, COUPANG_PLAY_VIDEO_URL_LIST } from '@utils/constants';
import { getCoupangPlayVideoId } from '@utils/coupang-play';
import { sendMessageToTab } from '@utils/message';

import { takeViewAction } from './pending-actions';

type MessageResult = { success: boolean; message?: string };

export const createTabLifecycleDependencies = {
  awaitReady: async () => {},
  clearSubtitleReplay: async (_tabId: number) => {},
  getTab: (tabId: number) => chrome.tabs.get(tabId),
  updateTabInfo,
  updateNavigatingStatus: async (
    tabId: number,
    isVideoUrl: boolean,
    _expectedVideoId: string | null
  ) => {
    await updateTabInfo(tabId, {
      connectionStatus: 'connecting',
      videoStatus: isVideoUrl ? 'detecting' : 'idle',
    });
  },
  checkContentConnection: async (_tabId: number, _isVideoUrl: boolean) => {},
  sendMessageToTab: (tabId: number, message: string, params?: unknown): Promise<MessageResult> =>
    params === undefined
      ? (sendMessageToTab as (tabId: number, message: string) => Promise<MessageResult>)(tabId, message)
      : (sendMessageToTab as (tabId: number, message: string, params: unknown) => Promise<MessageResult>)(
          tabId,
          message,
          params
        ),
  takeViewAction,
};

type TabLifecycleDependencies = typeof createTabLifecycleDependencies;

export const handleTabCompleted = async (
  tabId: number,
  tab: chrome.tabs.Tab,
  dependencies: TabLifecycleDependencies = createTabLifecycleDependencies
) => {
  await dependencies.awaitReady();
  const isCurrentRoute = async () => {
    const currentTab = await dependencies.getTab(tabId);
    return currentTab.status !== 'loading' && currentTab.url === tab.url;
  };
  if (!(await isCurrentRoute())) return;

  const isPlatformUrl = Boolean(tab.url?.startsWith(COUPANG_PLAY_BASE_URL));
  const isVideoUrl = COUPANG_PLAY_VIDEO_URL_LIST.some((url) => tab.url?.startsWith(url));
  const videoId = getCoupangPlayVideoId(tab.url);

  if (isPlatformUrl) {
    await dependencies.updateNavigatingStatus(tabId, isVideoUrl, videoId);
    if (!(await isCurrentRoute())) return;
    await dependencies.checkContentConnection(tabId, isVideoUrl);
    if (!(await isCurrentRoute())) return;
    try {
      await dependencies.sendMessageToTab(tabId, 'resetElement');
    } catch {
      // Detection below remains authoritative when reset cannot be delivered.
    }
  }

  if (!(await isCurrentRoute())) return;
  if (!isVideoUrl) {
    await dependencies.clearSubtitleReplay(tabId);
    return;
  }

  const response = await dependencies.sendMessageToTab(tabId, 'detectVideo');
  if (!(await isCurrentRoute())) return;
  if (!response.success) {
    await dependencies.updateTabInfo(tabId, {
      connectionStatus: 'connected',
      videoStatus: 'detecting',
    });
    return;
  }

  const action = await dependencies.takeViewAction(videoId, tab.url);
  if (action && (await isCurrentRoute())) {
    await dependencies.sendMessageToTab(tabId, 'playVideo', { startTime: action.startTime });
  }
};
