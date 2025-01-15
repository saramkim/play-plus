import { COUPANG_PLAY_BASE_URL, REVIEW } from './utils/constants';
import { migrateLegacyStorage } from './storage/migration';

const loadedTabs = new Set<number>();
const messageQueue: { [tabId: number]: any[] } = {};

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

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    loadedTabs.add(tabId);

    if (messageQueue[tabId]) {
      messageQueue[tabId].forEach((msg) => chrome.tabs.sendMessage(tabId, msg));
      delete messageQueue[tabId];
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  loadedTabs.delete(tabId);
  delete messageQueue[tabId];
});

chrome.webRequest.onSendHeaders.addListener(
  async ({ tabId, url, requestHeaders }) => {
    const hasCustomHeader = requestHeaders?.some((header) => header.name === 'X-Extension-Request');
    if (hasCustomHeader) return;

    sendMessageToContent(tabId, { url, headers: requestHeaders });
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
    if (newTab.id) sendMessageToContent(newTab.id, message);
  }
};

const sendMessageToContent = async (tabId: number, message: any) => {
  if (loadedTabs.has(tabId)) chrome.tabs.sendMessage(tabId, message);
  else if (messageQueue[tabId]) messageQueue[tabId].push(message);
  else messageQueue[tabId] = [message];
};
