import { COUPANG_PLAY_BASE_URL, REVIEW } from './utils/constants';
import { migrateLegacyStorage } from './storage/migration';

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

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === REVIEW.ACTIONS.VIEW_VIDEO) {
    handleViewVideo(message);
  }
});

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Error setting panel behavior:', error));

chrome.webRequest.onSendHeaders.addListener(
  async ({ tabId, url, requestHeaders }) => {
    const hasCustomHeader = requestHeaders?.some((header) => header.name === 'X-Extension-Request');
    if (hasCustomHeader) return;

    chrome.tabs.sendMessage(tabId, { url, headers: requestHeaders });
  },
  { urls: [`${COUPANG_PLAY_BASE_URL}/api/playback/play?*`] },
  ['requestHeaders']
);

const handleViewVideo = async ({ url, startTime }: { url: string; startTime: number }) => {
  const tabs = await chrome.tabs.query({});
  const matchingTab = tabs.find((tab) => tab.active && tab.url === url) || tabs.find((tab) => tab.url === url);
  const message = { action: REVIEW.ACTIONS.PLAY_VIDEO, startTime };

  if (matchingTab?.id) {
    await chrome.tabs.update(matchingTab.id, { active: true });
    chrome.tabs.sendMessage(matchingTab.id, message);
  } else {
    const newTab = await chrome.tabs.create({ url });
    if (newTab.id) chrome.tabs.sendMessage(newTab.id, message);
  }
};
