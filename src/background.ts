chrome.runtime.onInstalled.addListener(() => {
  console.log('Play Plus Extension Installed');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {});
