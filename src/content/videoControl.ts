import { SETTINGS } from '../utils/constants';
import { getStorage, SkipTimeUnit, StorageChange, StorageChanges, VideoSkipConfig } from '../utils/storage';
import { findCurrentSubtitleIndex } from '../utils/subtitle';
import { subtitleCache } from './subtitle';

type KeyBindings = { [key: string]: () => void };

const { VIDEO_SKIP, SUB_VIDEO_SKIP } = SETTINGS;

const keyBindings: KeyBindings = {};

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
  const { enabled, backward, forward, skipTime, skipTimeUnit } = data;
  if (enabled) {
    keyBindings[backward] = () => skipVideoTime(-skipTime, skipTimeUnit);
    keyBindings[forward] = () => skipVideoTime(skipTime, skipTimeUnit);
  } else {
    delete keyBindings[backward];
    delete keyBindings[forward];
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

function skipVideoTime(skipTime: number, skipTimeUnit: SkipTimeUnit) {
  const video = document.querySelector('video');
  if (!video) return;

  const { currentTime, duration } = video;

  if (skipTimeUnit === 'subtitles') {
    const subtitles = [...subtitleCache.values()]?.[0];
    if (!subtitles || subtitles.length === 0) return;

    const index = findCurrentSubtitleIndex(subtitles, currentTime);

    if (skipTime > 0) {
      video.currentTime = subtitles[Math.floor(index) + skipTime]
        ? subtitles[Math.floor(index) + skipTime].start
        : duration - 1;
    } else {
      video.currentTime = subtitles[Math.ceil(index) + skipTime] ? subtitles[Math.ceil(index) + skipTime].start : 0;
    }
  } else {
    const unitMap = { seconds: 1, minutes: 60 };
    const time = currentTime + skipTime * unitMap[skipTimeUnit];
    video.currentTime = Math.min(Math.max(time, 0), duration - 1);
  }
}
