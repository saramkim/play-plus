import { getStorage, SubKeyConfig } from '../utils/storage';

type KeyBindings = { [key: string]: () => void };

const SKIP_TIME_STORAGE_KEY = 'skipTime';
const SUB_KEY_STORAGE_KEY = 'subKey';

let mainSkipTime = 10;
let keyBindings: KeyBindings = {};

export async function initializeSkipTimeSetting() {
  mainSkipTime = (await getStorage(SKIP_TIME_STORAGE_KEY)) || 10;
  chrome.storage.sync.onChanged.addListener(handleStorageChange);
}

export async function initializeKeyBindings() {
  setKeyBindings(await getStorage(SUB_KEY_STORAGE_KEY));
  document.addEventListener('keydown', handleKeydown);
}

async function handleStorageChange(changes: { [key: string]: chrome.storage.StorageChange }) {
  const skipTimeChange = changes[SKIP_TIME_STORAGE_KEY];
  const subKeyChange = changes[SUB_KEY_STORAGE_KEY];

  if (skipTimeChange && skipTimeChange.newValue) {
    mainSkipTime = skipTimeChange.newValue;
  }
  if (subKeyChange) {
    setKeyBindings(subKeyChange.newValue);
  }
}

async function setKeyBindings(subKeyConfig?: SubKeyConfig) {
  const bindings: KeyBindings = {
    ArrowRight: () => skipVideoTime(mainSkipTime),
    ArrowLeft: () => skipVideoTime(-mainSkipTime),
  };

  if (subKeyConfig) {
    const { forward, backward, skipTime } = subKeyConfig;
    bindings[forward] = () => skipVideoTime(skipTime);
    bindings[backward] = () => skipVideoTime(-skipTime);
  }

  keyBindings = bindings;
}

function handleKeydown(event: KeyboardEvent) {
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
