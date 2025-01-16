import './content.css';
import { MESSAGE_ACTION } from '../utils/constants';
import { selectVideoElement } from '../utils/dom';
import { onStorageChange } from '../storage/storage';
import {
  fetchAndSyncSubtitles,
  fetchVideoMetadata,
  initializeSubtitleSync,
  onSubtitleStorageChange,
  setupSubtitleSync,
} from './subtitle';
import { initializeVideoControlSetting, onVideoControlStorageChange } from './videoControl';
import { initializeElementStore } from './elementStore';
import { initializeSubtitleStore } from './subtitleStore';
import { initializeLoopSetting, onLoopStorageChange, setupLoopHandler } from './loop';

async function init() {
  initializeMessageListener();
  initializeStorageChange();
  initializeSubtitleSync();
  initializeVideoControlSetting();
  initializeLoopSetting();
}

function initializeMessageListener() {
  chrome.runtime.onMessage.addListener(async (message) => {
    if (message) {
      if (message.action === MESSAGE_ACTION.FETCH_VIDEO_METADATA) {
        const [subtitleApiInfoList, video] = await Promise.all([
          fetchVideoMetadata(message.url, message.headers),
          initializeElementStore(),
        ]);

        initializeSubtitleStore(subtitleApiInfoList);
        setupLoopHandler(video);

        if (subtitleApiInfoList && video) {
          await fetchAndSyncSubtitles(subtitleApiInfoList);
          setupSubtitleSync(video);
        }
      }
      if (message.action === MESSAGE_ACTION.PLAY_VIDEO) {
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
    onVideoControlStorageChange(changes);
    onLoopStorageChange(changes);
  });
}

init();
