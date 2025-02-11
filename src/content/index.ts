import { onStorageChange } from '@storage/index';
import './content.css';
import { initializeLoopSetting, onLoopStorageChange } from './loop';
import { initializeMessageListener } from './messageHandler';
import { initializeSubtitleSync, onSubtitleStorageChange } from './subtitle';
import { initializeVideoControlSetting, onVideoControlStorageChange } from './videoControl';

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
