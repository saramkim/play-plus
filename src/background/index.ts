import { migrateLegacyStorage } from '@storage/migration';
import { COUPANG_PLAY_BASE_URL, SET_SUBTITLE_ACTION, SetSubtitleAction } from '@utils/constants';
import { onMessage, sendMessageToTab, SetSubtitleMessage, ViewVideoMessage } from '@utils/message';

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

onMessage((message) => {
  const { viewVideo } = message;
  if (viewVideo) handleViewVideo(viewVideo);

  Object.values(SET_SUBTITLE_ACTION).forEach((action) => {
    if (message[action]) handleSetSubtitle(action, message[action]);
  });
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

const handleViewVideo = async ({ url, startTime }: ViewVideoMessage) => {
  const tabs = await chrome.tabs.query({});
  const matchingTab = tabs.find((tab) => tab.active && tab.url === url) || tabs.find((tab) => tab.url === url);

  if (matchingTab?.id) {
    await chrome.tabs.update(matchingTab.id, { active: true });
    sendMessageToTab(matchingTab.id, 'playVideo', { startTime });
  } else {
    const newTab = await chrome.tabs.create({ url });
    if (newTab.id) {
      const listener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (tabId === newTab.id && changeInfo.status === 'complete') {
          sendMessageToTab(tabId, 'playVideo', { startTime });
          chrome.tabs.onUpdated.removeListener(listener);
        }
      };

      chrome.tabs.onUpdated.addListener(listener);
    }
  }
};

const handleSetSubtitle = async (action: SetSubtitleAction, message: SetSubtitleMessage) => {
  const tabs = await chrome.tabs.query({ url: `${COUPANG_PLAY_BASE_URL}/*` });
  const activeTab = tabs.find((tab) => tab.active);
  if (activeTab?.id) {
    sendMessageToTab(activeTab.id, action, message);
  }
};
