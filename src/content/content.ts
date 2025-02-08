import './content.css';
import { onStorageChange } from '../storage/storage';
import { initializeSubtitleSync, onSubtitleStorageChange } from './subtitle';
import { initializeVideoControlSetting, onVideoControlStorageChange } from './videoControl';
import { initializeLoopSetting, onLoopStorageChange } from './loop';
import { initializeMessageListener } from './messageHandler';

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
