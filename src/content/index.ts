import { onStorageChange } from '@storage/index';

import './content.css';
import { loopController } from './features/loop';
import { initializeSubtitleSync, onSubtitleStorageChange } from './features/subtitle/subtitle';
import { initializeVideoControlSetting, onVideoControlStorageChange } from './features/video/video-control';
import { initializeMessageListener } from './message-handler';

async function init() {
  initializeMessageListener();
  initializeStorageChange();
  initializeSubtitleSync();
  initializeVideoControlSetting();
}

function initializeStorageChange() {
  onStorageChange((changes) => {
    onSubtitleStorageChange(changes);
    onVideoControlStorageChange(changes);
    loopController.onLoopStorageChange(changes);
  });
}

init();
