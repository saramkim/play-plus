import { fetchVideoMetadata, initializeSubtitleSync } from './subtitle';
import { initializeKeyBindings, initializeSkipTimeSetting } from './videoControl';

function initializeMessageListener() {
  chrome.runtime.onMessage.addListener((message) => {
    if (message) {
      if (message.url && message.headers) {
        fetchVideoMetadata(message.url, message.headers);
      }
    }
  });
}

(async function () {
  initializeMessageListener();
  await initializeSubtitleSync();
  await initializeSkipTimeSetting();
  await initializeKeyBindings();
})();
