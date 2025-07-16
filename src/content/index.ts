import { onStorageChange } from '@storage/index';

import './content.css';
import { renderApp } from './app';
import { loopController } from './features/loop';
import { initializeSubtitleSync, onSubtitleStorageChange } from './features/subtitle/subtitle';
import { videoController } from './features/video';
import { playbackSpeedController } from './features/video/playback-speed';
import { initializeMessageListener } from './message-handler';
import { elementStore } from './store/element-store';

async function init() {
  initializeMessageListener();
  initializeStorageChange();
  await initializeSubtitleSync();
  renderApp(elementStore.getReactRoot());
}

function initializeStorageChange() {
  onStorageChange((changes) => {
    onSubtitleStorageChange(changes);
    videoController.onVideoControlStorageChange(changes);
    loopController.onLoopStorageChange(changes);
    playbackSpeedController.onStorageChange(changes);
  });
}

init();
