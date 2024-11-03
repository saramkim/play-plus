import { getStorage } from '../utils/storage';

const SKIP_TIME_STORAGE_KEY = 'skipTime';
const SUB_KEY_STORAGE_KEY = 'subKey';

let mainSkipTime = 10;
let subSkipTime = 10;

export async function initializeSkipTimeSetting() {
  mainSkipTime = (await getStorage(SKIP_TIME_STORAGE_KEY)) || 10;
  chrome.storage.sync.onChanged.addListener(handleStorageChange);
}

function handleStorageChange(changes: { [key: string]: chrome.storage.StorageChange }) {
  if (changes[SKIP_TIME_STORAGE_KEY]) {
    mainSkipTime = changes[SKIP_TIME_STORAGE_KEY].newValue;
  }
  if (changes[SUB_KEY_STORAGE_KEY]) {
    subSkipTime = changes[SUB_KEY_STORAGE_KEY].newValue.skipTime;
  }
}

export async function initializeKeyBindings() {
  const keyBindings = await getKeyBindings();
  document.addEventListener('keydown', (event) => handleKeydown(event, keyBindings));
}

async function getKeyBindings() {
  const keyBindings: { [key: string]: () => void } = {
    ArrowRight: () => skipVideoTime(mainSkipTime),
    ArrowLeft: () => skipVideoTime(-mainSkipTime),
  };

  const subKeyConfig = await getStorage(SUB_KEY_STORAGE_KEY);
  if (subKeyConfig) {
    const { forward, backward, skipTime } = subKeyConfig;
    subSkipTime = skipTime;
    keyBindings[forward] = () => skipVideoTime(subSkipTime);
    keyBindings[backward] = () => skipVideoTime(-subSkipTime);
  }

  return keyBindings;
}

function handleKeydown(event: KeyboardEvent, keyBindings: { [key: string]: () => void }) {
  if (isInputField()) return;

  const action = keyBindings[event.code];
  if (action) {
    event.preventDefault();
    event.stopImmediatePropagation();
    action();
  }
}

function isInputField(): boolean {
  const activeElementTag = document.activeElement?.tagName || '';
  return ['INPUT', 'TEXTAREA'].includes(activeElementTag);
}

function skipVideoTime(seconds: number) {
  const video = document.querySelector('video');
  if (video) {
    video.currentTime = Math.min(Math.max(video.currentTime + seconds, 0), video.duration - 1);
  }
}
