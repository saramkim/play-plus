import { SKIP_TIME, SUB_KEY } from '../utils/constants';
import { DEFAULT_SKIP_TIME } from '../utils/default';
import { getStorage, onStorageChange, StorageChanges, SubKeyConfig } from '../utils/storage';

type KeyBindings = { [key: string]: () => void };

let mainSkipTime = DEFAULT_SKIP_TIME;
let keyBindings: KeyBindings = {};

export async function initializeSkipTimeSetting() {
  mainSkipTime = (await getStorage(SKIP_TIME.STORAGE_KEY)) || DEFAULT_SKIP_TIME;
  onStorageChange(handleStorageChange);
}

export async function initializeKeyBindings() {
  setKeyBindings(await getStorage(SUB_KEY.STORAGE_KEY));
  document.addEventListener('keydown', handleKeydown);
}

async function handleStorageChange(changes: StorageChanges) {
  const skipTimeChange = changes[SKIP_TIME.STORAGE_KEY];
  const subKeyChange = changes[SUB_KEY.STORAGE_KEY];

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
