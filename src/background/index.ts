import { migrateLegacyStorage } from '@storage/migration';
import { setSessionStorage } from '@storage/session';
import { updateTabInfo } from '@storage/tab';
import {
  COUPANG_PLAY_BASE_URL,
  COUPANG_PLAY_SUBTITLE_API_URL,
  COUPANG_PLAY_VIDEO_URL_LIST,
} from '@utils/constants';
import { getCoupangPlayVideoId } from '@utils/coupang-play';
import { onMessage, sendMessageToTab } from '@utils/message/index';
import { MessageSchema } from '@utils/message/type';

import { respondToAsyncMessage } from './async-message-response';
import {
  enqueueViewAction,
  PendingSubtitleRequest,
  savePendingSubtitleRequest,
} from './pending-actions';
import { createTabLifecycleDependencies, handleTabCompleted } from './tab-lifecycle';

const updateConnectedStatus = async (tabId: number, isVideoUrl: boolean, hasVideo: boolean) => {
  await updateTabInfo(tabId, {
    connectionStatus: 'connected',
    videoStatus: isVideoUrl ? (hasVideo ? 'detected' : 'not_detected') : 'idle',
  });
};

const updateDisconnectedStatus = async (tabId: number, isVideoUrl: boolean) => {
  await updateTabInfo(tabId, {
    connectionStatus: 'disconnected',
    videoStatus: isVideoUrl ? 'not_detected' : 'idle',
  });
};

const checkContentConnection = async (tabId: number, isVideoUrl: boolean) => {
  try {
    const response = await sendMessageToTab(tabId, 'pingContent');
    if (response.success) {
      await updateConnectedStatus(tabId, isVideoUrl, response.data.hasVideo);
    } else {
      await updateDisconnectedStatus(tabId, isVideoUrl);
    }
  } catch {
    await updateDisconnectedStatus(tabId, isVideoUrl);
  }
};

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
    console.log('Extension updated. Starting legacy storage migration...');
    try {
      const results = await migrateLegacyStorage();
      if (results.some((result) => result)) console.log('Legacy storage migration completed successfully.');
      else console.log('No legacy storage found.');
    } catch (error) {
      console.error('Error during legacy storage migration:', error);
    }
  }
});

onMessage((request) => {
  switch (request.message) {
    case 'viewVideo': {
      return respondToAsyncMessage(request.sendResponse, () => handleViewVideo(request.params));
    }
    case 'updateSubtitles': {
      return respondToAsyncMessage(request.sendResponse, async () => {
        const tabId = request.sender.tab?.id;
        if (tabId === undefined) throw new Error('Missing sender tab id');
        const { lang, subtitleData } = request.params;
        await updateTabInfo(tabId, { [lang]: subtitleData });
      });
    }
    case 'contentStatus': {
      return respondToAsyncMessage(request.sendResponse, async () => {
        const tabId = request.sender.tab?.id;
        if (tabId === undefined) throw new Error('Missing sender tab id');
        const { hasVideo, isVideoUrl } = request.params;
        await updateConnectedStatus(tabId, isVideoUrl, hasVideo);
      });
    }
  }
});

chrome.runtime.getPlatformInfo((info) => {
  const isAndroid = info.os === 'android';

  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: !isAndroid })
    .catch((error) => console.error('Error setting panel behavior:', error));

  if (isAndroid) {
    chrome.action.onClicked.addListener((tab) => {
      if (!tab?.id) return;
      chrome.tabs.create({ url: chrome.runtime.getURL('index.html'), active: true });
    });
  }
});

chrome.webRequest.onSendHeaders.addListener(
  ({ tabId, url, requestHeaders }) => {
    const hasCustomHeader = requestHeaders?.some((header) => header.name === 'X-Extension-Request');
    if (hasCustomHeader) return;

    if (tabId < 0) return;
    sendSubtitleRequest(tabId, { url, headers: requestHeaders ?? [] });
  },
  { urls: [`${COUPANG_PLAY_SUBTITLE_API_URL}?*`] },
  ['requestHeaders']
);

const sendSubtitleRequest = async (tabId: number, payload: PendingSubtitleRequest) => {
  try {
    await sendMessageToTab(tabId, 'fetchVideoMetadata', payload);
  } catch {
    await savePendingSubtitleRequest(tabId, payload);
  }
};

const handleViewVideo = async ({ url, startTime }: MessageSchema['viewVideo']['params']) => {
  const tabs = await chrome.tabs.query({});
  const videoId = getCoupangPlayVideoId(url);
  const matchingTabs = tabs.filter((tab) =>
    videoId ? getCoupangPlayVideoId(tab.url) === videoId : tab.url === url
  );
  const matchingTab = matchingTabs.find((tab) => tab.active) ?? matchingTabs[0];

  if (matchingTab?.id !== undefined) {
    await chrome.tabs.update(matchingTab.id, { active: true });
    if (matchingTab.status === 'complete') {
      await sendMessageToTab(matchingTab.id, 'playVideo', { startTime });
    } else {
      await enqueueViewAction({ url, startTime, videoId });
    }
  } else {
    await chrome.tabs.create({ url });
    await enqueueViewAction({ url, startTime, videoId });
  }
};

chrome.tabs.onActivated.addListener(async (tabInfo) => {
  const tab = await chrome.tabs.get(tabInfo.tabId);
  setSessionStorage('activeTab', tab);
  if (tab.id && tab.url?.startsWith(COUPANG_PLAY_BASE_URL)) {
    const isVideoUrl = COUPANG_PLAY_VIDEO_URL_LIST.some((url) => tab.url?.startsWith(url));
    updateTabInfo(tab.id, {
      connectionStatus: 'connecting',
      videoStatus: isVideoUrl ? 'detecting' : 'idle',
    });
    checkContentConnection(tab.id, isVideoUrl);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  await handleTabCompleted(tabId, tab, {
    ...createTabLifecycleDependencies,
    checkContentConnection,
    sendSubtitleRequest,
  });
});
