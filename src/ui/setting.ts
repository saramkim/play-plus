import { onStorageChange } from '../utils/storage';
import { initializeSubtitleSetting, onSubtitleStorageChange } from './subtitle';
import { initializeSkipTimeSetting, initializeSubKeySetting, onSubKeyStorageChange } from './videoControl';

async function init() {
  await Promise.all([initializeSubtitleSetting(), initializeSkipTimeSetting(), initializeSubKeySetting()]);
  initializeStorageChange();
}

function initializeStorageChange() {
  onStorageChange((changes) => {
    onSubtitleStorageChange(changes);
    onSubKeyStorageChange(changes);
  });
}

init();
