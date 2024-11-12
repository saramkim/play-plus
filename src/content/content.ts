import { onStorageChange } from '../utils/storage';
import { fetchVideoMetadata, initializeSubtitleSync, onSubtitleStorageChange } from './subtitle';
import { initializeKeyBindings, initializeSkipTimeSetting, onSubKeyStorageChange } from './videoControl';

async function init() {
  initializeMessageListener();
  initializeStorageChange();
  await initializeSubtitleSync();
  await initializeSkipTimeSetting();
  await initializeKeyBindings();
}

function initializeMessageListener() {
  chrome.runtime.onMessage.addListener((message) => {
    if (message) {
      if (message.url && message.headers) {
        fetchVideoMetadata(message.url, message.headers);
      }
    }
  });
}

function initializeStorageChange() {
  onStorageChange((changes) => {
    onSubtitleStorageChange(changes);
    onSubKeyStorageChange(changes);
  });
}

init();
