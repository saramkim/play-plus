chrome.webRequest.onSendHeaders.addListener(
  async (details) => {
    const hasCustomHeader = details.requestHeaders?.some((header) => header.name === 'X-Extension-Request');
    if (hasCustomHeader) return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { url: details.url, headers: details.requestHeaders });
    }
  },
  { urls: ['https://www.coupangplay.com/api/playback/play?*'] },
  ['requestHeaders']
);
