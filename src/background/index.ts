import { setSessionStorage } from '@storage/index';
import { migrateLegacyStorage } from '@storage/migration';
import { updateTabInfo } from '@storage/tab';
import { COUPANG_PLAY_BASE_URL, COUPANG_PLAY_PLAY_URL } from '@utils/constants';
import { onMessage, sendMessageToTab } from '@utils/message/index';
import { MessageSchema } from '@utils/message/type';

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

onMessage(({ message, params, sender, sendResponse }) => {
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
    case 'setPrimarySubtitle':
    case 'setSecondarySubtitle': {
      sendMessageToTab(params.tabId, message, params).then(sendResponse);
      return true;
    }
  }
});

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Error setting panel behavior:', error));

chrome.webRequest.onSendHeaders.addListener(
  async ({ tabId, url, requestHeaders }) => {
    const hasCustomHeader = requestHeaders?.some((header) => header.name === 'X-Extension-Request');
    if (hasCustomHeader) return;

    sendMessageToTab(tabId, 'fetchVideoMetadata', { url, headers: requestHeaders ?? [] });
  },
  { urls: [`${COUPANG_PLAY_BASE_URL}/api/playback/play?*`] },
  ['requestHeaders']
);

const messageQueue: MessageSchema['viewVideo']['params'][] = [];

const handleViewVideo = async ({ url, startTime }: MessageSchema['viewVideo']['params']) => {
  const tabs = await chrome.tabs.query({});
  const matchingTab = tabs.find((tab) => tab.active && tab.url === url) || tabs.find((tab) => tab.url === url);

  if (matchingTab?.id) {
    await chrome.tabs.update(matchingTab.id, { active: true });
    sendMessageToTab(matchingTab.id, 'playVideo', { startTime });
  } else {
    await chrome.tabs.create({ url });
    messageQueue.push({ url, startTime });
  }
};

chrome.tabs.onActivated.addListener(async (tabInfo) => {
  const tab = await chrome.tabs.get(tabInfo.tabId);
  setSessionStorage('activeTab', tab);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    if (tab.active) setSessionStorage('activeTab', tab);

    if (tab.url?.startsWith(COUPANG_PLAY_BASE_URL)) sendMessageToTab(tabId, 'resetElement');

    if (tab.url?.startsWith(COUPANG_PLAY_PLAY_URL)) {
      const response = await sendMessageToTab(tabId, 'detectVideo');
      if (!response.success) return;

      const message = messageQueue.find(({ url }) => url === tab.url);
      if (message) {
        sendMessageToTab(tabId, 'playVideo', message);
        messageQueue.splice(messageQueue.indexOf(message), 1);
      }
    }
  }
});
