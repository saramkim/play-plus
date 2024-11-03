import { fetchAndSyncSubtitles } from './subtitle';
import { initializeKeyBindings, initializeSkipTimeSetting } from './videoControl';

function initializeMessageListener() {
  chrome.runtime.onMessage.addListener((message) => {
    if (message) {
      if (message.url && message.headers) {
        fetchAndSyncSubtitles(message.url, message.headers);
      }
    }
  });
}

(async function () {
  initializeMessageListener();
  await initializeSkipTimeSetting();
  await initializeKeyBindings();
})();
