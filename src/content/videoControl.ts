import { SETTINGS } from '../utils/constants';
import { DEFAULT_SKIP_TIME } from '../utils/default';
import { getStorage, StorageChanges, SubKeyConfig } from '../utils/storage';

type KeyBindings = { [key: string]: () => void };

const { SKIP_TIME, SUB_KEY } = SETTINGS;

let mainSkipTime = DEFAULT_SKIP_TIME;
let keyBindings: KeyBindings = {};

export function onSubKeyStorageChange(changes: StorageChanges) {
  const skipTimeChange = changes[SKIP_TIME.STORAGE_KEY];
  const subKeyChange = changes[SUB_KEY.STORAGE_KEY];

  if (skipTimeChange && skipTimeChange.newValue) {
    mainSkipTime = skipTimeChange.newValue;
  }
  if (subKeyChange && subKeyChange.newValue) {
    setKeyBindings(subKeyChange.newValue);
  }
}

export async function initializeSkipTimeSetting() {
  const data = await getStorage(SKIP_TIME.STORAGE_KEY);
  if (data) mainSkipTime = data;
}

export async function initializeKeyBindings() {
  const data = await getStorage(SUB_KEY.STORAGE_KEY);
  if (data) setKeyBindings(data);
  document.addEventListener('keydown', handleKeydown);
}

function setKeyBindings(subKeyConfig: SubKeyConfig) {
  const bindings: KeyBindings = {
    ArrowRight: () => skipVideoTime(mainSkipTime),
    ArrowLeft: () => skipVideoTime(-mainSkipTime),
  };
  const { enabled, forward, backward, skipTime } = subKeyConfig;

  if (enabled) {
    bindings[backward] = () => skipVideoTime(-skipTime);
    bindings[forward] = () => skipVideoTime(skipTime);
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
