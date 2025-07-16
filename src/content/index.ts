import { onStorageChange } from '@storage/index';

import './content.css';
import { renderApp } from './app';
import { elementStore } from './core/store/element-store';
import { loopController } from './features/loop';
import { playbackSpeedController } from './features/playback-speed/playback-speed';
import { initializeSubtitleSync, onSubtitleStorageChange } from './features/subtitle/subtitle';
import { videoController } from './features/video/video-controller';
import { initializeMessageListener } from './message-handler';

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
