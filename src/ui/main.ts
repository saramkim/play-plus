import '../style.css';
import { onStorageChange } from '../utils/storage';
import { initializeSubtitleSetting, onSubtitleStorageChange } from './subtitle';
import { initializeSkipTimeSetting, initializeSubKeySetting, onSubKeyStorageChange } from './videoControl';

async function init() {
  initializeStorageChange();
  initializeI18n();
  await loadTemplates();
  await initializeSubtitleSetting();
  await initializeSkipTimeSetting();
  await initializeSubKeySetting();
}

function initializeStorageChange() {
  onStorageChange((changes) => {
    onSubtitleStorageChange(changes);
    onSubKeyStorageChange(changes);
  });
}

function initializeI18n() {
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const messageKey = element.getAttribute('data-i18n') as string;
    const message = chrome.i18n.getMessage(messageKey);
    if (element.tagName === 'TITLE') document.title = message;
    else element.textContent = message;
  });
}

async function loadTemplates() {
  const response = await fetch('template.html');
  const text = await response.text();
  document.body.insertAdjacentHTML('beforeend', text);
}

document.addEventListener('DOMContentLoaded', init);
