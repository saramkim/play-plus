import { setSessionStorage } from '@storage/session';
import { updateTabInfo } from '@storage/tab';
import type { PendingSubtitleRequest } from '@storage/type';
import { COUPANG_PLAY_BASE_URL, COUPANG_PLAY_VIDEO_URL_LIST } from '@utils/constants';
import { getCoupangPlayVideoId } from '@utils/coupang-play';
import { sendMessageToTab } from '@utils/message';

import { takePendingSubtitleRequest, takeViewAction } from './pending-actions';

type MessageResult = { success: boolean; message?: string };

export const createTabLifecycleDependencies = {
  setActiveTab: (tab: chrome.tabs.Tab) => setSessionStorage('activeTab', tab),
  updateTabInfo,
  checkContentConnection: async (_tabId: number, _isVideoUrl: boolean) => {},
  sendMessageToTab: (tabId: number, message: string, params?: unknown): Promise<MessageResult> =>
    params === undefined
      ? (sendMessageToTab as (tabId: number, message: string) => Promise<MessageResult>)(tabId, message)
      : (sendMessageToTab as (tabId: number, message: string, params: unknown) => Promise<MessageResult>)(
          tabId,
          message,
          params
        ),
  takePendingSubtitleRequest,
  sendSubtitleRequest: async (_tabId: number, _request: PendingSubtitleRequest) => {},
  takeViewAction,
};

type TabLifecycleDependencies = typeof createTabLifecycleDependencies;

export const handleTabCompleted = async (
  tabId: number,
  tab: chrome.tabs.Tab,
  dependencies: TabLifecycleDependencies = createTabLifecycleDependencies
) => {
  if (tab.active) await dependencies.setActiveTab(tab);

  const isPlatformUrl = Boolean(tab.url?.startsWith(COUPANG_PLAY_BASE_URL));
  const isVideoUrl = COUPANG_PLAY_VIDEO_URL_LIST.some((url) => tab.url?.startsWith(url));

  if (isPlatformUrl) {
    await dependencies.updateTabInfo(tabId, {
      connectionStatus: 'connecting',
      videoStatus: isVideoUrl ? 'detecting' : 'idle',
    });
    await dependencies.checkContentConnection(tabId, isVideoUrl);
    try {
      await dependencies.sendMessageToTab(tabId, 'resetElement');
    } catch {
      // Detection below remains authoritative when reset cannot be delivered.
    }
  }

  if (!isVideoUrl) return;

  const response = await dependencies.sendMessageToTab(tabId, 'detectVideo');
  if (!response.success) {
    await dependencies.updateTabInfo(tabId, {
      connectionStatus: 'connected',
      videoStatus: 'detecting',
    });
    return;
  }

  const pendingRequest = await dependencies.takePendingSubtitleRequest(tabId);
  if (pendingRequest) await dependencies.sendSubtitleRequest(tabId, pendingRequest);

  const videoId = getCoupangPlayVideoId(tab.url);
  const action = await dependencies.takeViewAction(videoId, tab.url);
  if (action) await dependencies.sendMessageToTab(tabId, 'playVideo', { startTime: action.startTime });
};
