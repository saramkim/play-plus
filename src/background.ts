import { getMetadataUrlFromUrl } from './utils/subtitle';

let currentUrl: string | null = null;

chrome.webRequest.onSendHeaders.addListener(
  async (details) => {
    const hasCustomHeader = details.requestHeaders?.some((header) => header.name === 'X-Extension-Request');
    if (hasCustomHeader) return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && currentUrl) {
      const metadataUrl = getMetadataUrlFromUrl(currentUrl);
      chrome.tabs.sendMessage(tab.id, { url: metadataUrl, headers: details.requestHeaders });
    }
  },
  { urls: ['https://www.coupangplay.com/api/playback/play?*'] },
  ['requestHeaders']
);

chrome.webNavigation.onHistoryStateUpdated.addListener(
  (details) => {
    currentUrl = details.url;
  },
  { url: [{ urlContains: 'coupangplay.com/play' }] }
);
