import { migrateLegacyStorage } from './utils/storage';

const loadedTabs = new Set<number>();
const messageQueue: { [tabId: number]: any[] } = {};

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
    console.log('Extension updated. Starting legacy storage migration...');
    try {
      await migrateLegacyStorage();
      console.log('Legacy storage migration completed successfully.');
    } catch (error) {
      console.error('Error during legacy storage migration:', error);
    }
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

chrome.webRequest.onSendHeaders.addListener(
  async (details) => {
    const hasCustomHeader = details.requestHeaders?.some((header) => header.name === 'X-Extension-Request');
    if (hasCustomHeader) return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      const message = { url: details.url, headers: details.requestHeaders };
      sendMessageToContent(tab.id, message);
    }
  },
  { urls: ['https://www.coupangplay.com/api/playback/play?*'] },
  ['requestHeaders']
);

function sendMessageToContent(tabId: number, message: any) {
  if (loadedTabs.has(tabId)) {
    chrome.tabs.sendMessage(tabId, message);
  } else if (messageQueue[tabId]) {
    messageQueue[tabId].push(message);
  } else {
    messageQueue[tabId] = [message];
  }
}
