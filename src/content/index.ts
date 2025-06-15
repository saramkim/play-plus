import { onStorageChange } from '@storage/index';

import './content.css';
import { renderApp } from './app';
import { loopController } from './features/loop';
import { initializeSubtitleSync, onSubtitleStorageChange } from './features/subtitle/subtitle';
import { videoController } from './features/video';
import { playbackSpeedController } from './features/video/playback-speed';
import { initializeMessageListener } from './message-handler';

async function init() {
  renderReactApp();
  initializeMessageListener();
  initializeStorageChange();
  initializeSubtitleSync();
}

function initializeStorageChange() {
  onStorageChange((changes) => {
    onSubtitleStorageChange(changes);
    videoController.onVideoControlStorageChange(changes);
    loopController.onLoopStorageChange(changes);
    playbackSpeedController.onStorageChange(changes);
  });
}

function renderReactApp() {
  const container = document.createElement('div');
  container.id = 'pp-root';
  document.body.appendChild(container);
  renderApp(container);
}

init();
