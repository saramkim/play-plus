import { setSessionStorage } from '@storage/index';
import { migrateLegacyStorage } from '@storage/migration';
import { updateTabInfo } from '@storage/tab';
import {
  COUPANG_PLAY_BASE_URL,
  COUPANG_PLAY_SUBTITLE_API_URL,
  COUPANG_PLAY_VIDEO_URL_LIST,
} from '@utils/constants';
import { getCoupangPlayVideoId } from '@utils/coupang-play';
import { onMessage, sendMessageToTab } from '@utils/message/index';
import { MessageSchema } from '@utils/message/type';

const updateConnectedStatus = (tabId: number, isVideoUrl: boolean, hasVideo: boolean) => {
  updateTabInfo(tabId, {
    connectionStatus: 'connected',
    videoStatus: isVideoUrl ? (hasVideo ? 'detected' : 'not_detected') : 'idle',
  });
};

const updateDisconnectedStatus = (tabId: number, isVideoUrl: boolean) => {
  updateTabInfo(tabId, {
    connectionStatus: 'disconnected',
    videoStatus: isVideoUrl ? 'not_detected' : 'idle',
  });
};

const checkContentConnection = async (tabId: number, isVideoUrl: boolean) => {
  try {
    const response = await sendMessageToTab(tabId, 'pingContent');
    if (response.success) {
      updateConnectedStatus(tabId, isVideoUrl, response.data.hasVideo);
    } else {
      updateDisconnectedStatus(tabId, isVideoUrl);
    }
  } catch {
    updateDisconnectedStatus(tabId, isVideoUrl);
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

onMessage(({ message, params, sender }) => {
  switch (message) {
    case 'viewVideo': {
      handleViewVideo(params);
      break;
    }
    case 'updateSubtitles': {
      const tabId = sender.tab?.id;
      if (!tabId) break;
      const { lang, subtitleData } = params;
      updateTabInfo(tabId, { [lang]: subtitleData });
      break;
    }
    case 'contentStatus': {
      const tabId = sender.tab?.id;
      if (!tabId) break;
      const { hasVideo, isVideoUrl } = params;
      updateConnectedStatus(tabId, isVideoUrl, hasVideo);
      break;
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

    sendMessageToTab(tabId, 'fetchVideoMetadata', { url, headers: requestHeaders ?? [] });
  },
  { urls: [`${COUPANG_PLAY_SUBTITLE_API_URL}?*`] },
  ['requestHeaders']
);

type ViewVideoMessage = MessageSchema['viewVideo']['params'] & { videoId: string | null };

const messageQueue: ViewVideoMessage[] = [];

const handleViewVideo = async ({ url, startTime }: MessageSchema['viewVideo']['params']) => {
  const tabs = await chrome.tabs.query({});
  const videoId = getCoupangPlayVideoId(url);
  const matchingTabs = tabs.filter((tab) =>
    videoId ? getCoupangPlayVideoId(tab.url) === videoId : tab.url === url
  );
  const matchingTab = matchingTabs.find((tab) => tab.active) ?? matchingTabs[0];

  if (matchingTab?.id) {
    await chrome.tabs.update(matchingTab.id, { active: true });
    if (matchingTab.status === 'complete') {
      sendMessageToTab(matchingTab.id, 'playVideo', { startTime });
    } else {
      messageQueue.push({ url, startTime, videoId });
    }
  } else {
    await chrome.tabs.create({ url });
    messageQueue.push({ url, startTime, videoId });
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
  if (changeInfo.status === 'complete') {
    if (tab.active) setSessionStorage('activeTab', tab);

    const isPlatformUrl = Boolean(tab.url?.startsWith(COUPANG_PLAY_BASE_URL));
    const isVideoUrl = COUPANG_PLAY_VIDEO_URL_LIST.some((url) => tab.url?.startsWith(url));

    if (isPlatformUrl) {
      updateTabInfo(tabId, {
        connectionStatus: 'connecting',
        videoStatus: isVideoUrl ? 'detecting' : 'idle',
      });
      checkContentConnection(tabId, isVideoUrl);
      try {
        await sendMessageToTab(tabId, 'resetElement');
      } catch {
        // Ignore reset failures; detectVideo will still run if needed.
      }
    }

    if (isVideoUrl) {
      const response = await sendMessageToTab(tabId, 'detectVideo');
      if (!response.success) {
        updateConnectedStatus(tabId, true, false);
        return;
      }

      const tabVideoId = getCoupangPlayVideoId(tab.url);
      let messageIndex = -1;

      if (tabVideoId) {
        for (let i = messageQueue.length - 1; i >= 0; i -= 1) {
          if (messageQueue[i].videoId === tabVideoId) {
            messageIndex = i;
            break;
          }
        }
      } else {
        messageIndex = messageQueue.findIndex(({ url }) => url === tab.url);
      }

      if (messageIndex >= 0) {
        const { startTime } = messageQueue[messageIndex];
        sendMessageToTab(tabId, 'playVideo', { startTime });
        messageQueue.splice(messageIndex, 1);
      }
    }
  }
});
