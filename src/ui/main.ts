import '../style.css';
import { onStorageChange } from '../utils/storage';
import { initializeSubtitleSetting, onSubtitleStorageChange } from './subtitle';
import { initializeVideoSetting } from './video';
import { initializeSkipTimeSetting, initializeSubKeySetting, onSubKeyStorageChange } from './videoControl';

async function init() {
  initializeStorageChange();
  await loadTemplates();
  await initializeSubtitleSetting();
  await initializeSkipTimeSetting();
  await initializeSubKeySetting();
  await initializeVideoSetting();
}

function initializeStorageChange() {
  onStorageChange((changes) => {
    onSubtitleStorageChange(changes);
    onSubKeyStorageChange(changes);
  });
}

async function loadTemplates() {
  const response = await fetch('template.html');
  const text = await response.text();
  document.body.insertAdjacentHTML('beforeend', text);
}

document.addEventListener('DOMContentLoaded', init);
