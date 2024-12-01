import './content.css';
import { REVIEW } from '../utils/constants';
import { selectVideoElement } from '../utils/dom';
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
  chrome.runtime.onMessage.addListener(async (message) => {
    if (message) {
      if (message.url && message.headers) {
        fetchVideoMetadata(message.url, message.headers);
      }
      if (message.action === REVIEW.ACTIONS.PLAY_VIDEO) {
        const video = await selectVideoElement();
        if (video.readyState >= 3) video.currentTime = message.startTime;
        else video.addEventListener('canplay', () => (video.currentTime = message.startTime), { once: true });
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
