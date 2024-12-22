import { SETTINGS } from '../utils/constants';
import { getStorage, StorageChange, StorageChanges, VideoSkipConfig } from '../utils/storage';

type KeyBindings = { [key: string]: () => void };

const { VIDEO_SKIP, SUB_VIDEO_SKIP } = SETTINGS;

let keyBindings: KeyBindings = {};

export function onVideoControlStorageChange(changes: StorageChanges) {
  const videoSkipStorageKeys = [VIDEO_SKIP.STORAGE_KEY, SUB_VIDEO_SKIP.STORAGE_KEY];
  videoSkipStorageKeys.forEach((key) => changes[key] && handleVideoSkipStorageChange(changes[key]));
}

export async function initializeVideoControlSetting() {
  const configs = await Promise.all([getStorage(VIDEO_SKIP.STORAGE_KEY), getStorage(SUB_VIDEO_SKIP.STORAGE_KEY)]);

  configs.forEach((config) => config && setKeyBindingsForVideoSkip(config));

  document.addEventListener('keydown', handleKeydown);
}

function handleVideoSkipStorageChange({ oldValue, newValue }: StorageChange<VideoSkipConfig>) {
  if (oldValue) {
    const { backward, forward } = oldValue;
    delete keyBindings[backward];
    delete keyBindings[forward];
  }
  if (newValue) setKeyBindingsForVideoSkip(newValue);
}

function setKeyBindingsForVideoSkip(data: VideoSkipConfig) {
  const { enabled, backward, forward, skipTime } = data;
  if (enabled) {
    keyBindings[backward] = () => skipVideoTime(-skipTime);
    keyBindings[forward] = () => skipVideoTime(skipTime);
  }
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
