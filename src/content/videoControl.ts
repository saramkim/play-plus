import { DEFAULT_SKIP_TIME } from '../utils/constants';
import { getStorage, onStorageChange, StorageChanges, SubKeyConfig } from '../utils/storage';

type KeyBindings = { [key: string]: () => void };

let mainSkipTime = DEFAULT_SKIP_TIME;
let keyBindings: KeyBindings = {};

export async function initializeSkipTimeSetting() {
  mainSkipTime = (await getStorage('skipTime')) || DEFAULT_SKIP_TIME;
  onStorageChange(handleStorageChange);
}

export async function initializeKeyBindings() {
  setKeyBindings(await getStorage('subKey'));
  document.addEventListener('keydown', handleKeydown);
}

async function handleStorageChange(changes: StorageChanges) {
  const skipTimeChange = changes['skipTime'];
  const subKeyChange = changes['subKey'];

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
