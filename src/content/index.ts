import { onStorageChange } from '@storage/index';

import './content.css';
import { initializeLoopSetting, onLoopStorageChange } from './features/loop/loop';
import { initializeSubtitleSync, onSubtitleStorageChange } from './features/subtitle/subtitle';
import { initializeVideoControlSetting, onVideoControlStorageChange } from './features/video/video-control';
import { initializeMessageListener } from './message-handler';

async function init() {
  initializeMessageListener();
  initializeStorageChange();
  initializeSubtitleSync();
  initializeVideoControlSetting();
  initializeLoopSetting();
}

function initializeStorageChange() {
  onStorageChange((changes) => {
    onSubtitleStorageChange(changes);
    onVideoControlStorageChange(changes);
    onLoopStorageChange(changes);
  });
}

init();
