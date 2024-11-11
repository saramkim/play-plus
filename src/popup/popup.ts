import '../style.css';
import { SUBTITLES } from '../utils/constants';
import { setElementVisibility } from '../utils/dom';
import { onStorageChange } from '../utils/storage';
import { initializeSubtitleSetting } from './subtitle';
import { initializeSkipTimeSetting, initializeSubKeySetting } from './videoControl';

async function initializeSettings() {
  initializeStorage();
  await loadTemplates();
  await initializeSubtitleSetting();
  await initializeSkipTimeSetting();
  await initializeSubKeySetting();
}

function initializeStorage() {
  onStorageChange((changes) => {
    for (const { STORAGE_KEY, CONTAINER_ID } of Object.values(SUBTITLES)) {
      const subtitleChanges = changes[STORAGE_KEY];

      if (subtitleChanges && subtitleChanges.newValue) {
        setElementVisibility(CONTAINER_ID, subtitleChanges.newValue.enabled);
      }
    }
  });
}

async function loadTemplates() {
  const response = await fetch('template.html');
  const text = await response.text();
  document.body.insertAdjacentHTML('beforeend', text);
}

document.addEventListener('DOMContentLoaded', initializeSettings);
