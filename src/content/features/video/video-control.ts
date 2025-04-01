import { DEFAULT_CONFIG } from '@storage/default';
import { getStorage, updateStorage } from '@storage/index';
import { StorageChange, StorageChanges, StorageSchema } from '@storage/type';
import { SETTINGS } from '@utils/constants';

import { loopCurrentSubtitle, setEndPoint, setStartPoint, toggleLoop } from '@/content/features/loop/loop';
import { saveSubtitleWithToast } from '@/content/features/subtitle/save-subtitle';
import { elementStore } from '@/content/store/element-store';
import { subtitleStore } from '@/content/store/subtitle-store';
import { findSubtitleIndex } from '@/content/utils/subtitle';

type KeyBindings = { [key: string]: () => void };

const { VIDEO_SKIP, SUB_VIDEO_SKIP, SHORTCUTS, LOOP } = SETTINGS;

const keyBindings: KeyBindings = {};

export function onVideoControlStorageChange(changes: StorageChanges) {
  const videoSkipStorageKeys = [VIDEO_SKIP.STORAGE_KEY, SUB_VIDEO_SKIP.STORAGE_KEY];
  videoSkipStorageKeys.forEach((key) => changes[key] && handleVideoSkipStorageChange(changes[key]));

  const shortcutsChanges = changes[SHORTCUTS.STORAGE_KEY];
  if (shortcutsChanges) handleShortcutsStorageChange(shortcutsChanges);

  const loopChanges = changes[LOOP.STORAGE_KEY];
  if (loopChanges) handleLoopStorageChange(loopChanges);
}

export async function initializeVideoControlSetting() {
  const [videoSkipConfig, subVideoSkipConfig, shortcutsConfig, loopConfig] = await Promise.all([
    getStorage(VIDEO_SKIP.STORAGE_KEY),
    getStorage(SUB_VIDEO_SKIP.STORAGE_KEY),
    getStorage(SHORTCUTS.STORAGE_KEY),
    getStorage(LOOP.STORAGE_KEY),
  ]);

  if (videoSkipConfig) setKeyBindingsForVideoSkip(videoSkipConfig);
  if (subVideoSkipConfig) setKeyBindingsForVideoSkip(subVideoSkipConfig);
  if (shortcutsConfig) setKeyBindingsForShortcuts(shortcutsConfig);
  if (loopConfig) setKeyBindingsForLoop(loopConfig);

  document.addEventListener('keydown', handleKeydown);
}

function handleShortcutsStorageChange({ oldValue, newValue }: StorageChange<StorageSchema['shortcuts']>) {
  if (oldValue) {
    const { enabled, ...shortcuts } = oldValue;
    Object.values(shortcuts).forEach((value) => delete keyBindings[value]);
  }
  setKeyBindingsForShortcuts(newValue || DEFAULT_CONFIG[SHORTCUTS.STORAGE_KEY]);
}

function setKeyBindingsForShortcuts({ enabled, ...shortcuts }: StorageSchema['shortcuts']) {
  if (enabled) {
    const { PRIMARY, SECONDARY } = SETTINGS.SUBTITLES;
    const { savePrimary, saveSecondary, togglePrimary, toggleSecondary } = shortcuts;

    keyBindings[savePrimary] = () => saveSubtitleWithToast(elementStore.getSubtitleElement(PRIMARY.STORAGE_KEY));
    keyBindings[saveSecondary] = () => saveSubtitleWithToast(elementStore.getSubtitleElement(SECONDARY.STORAGE_KEY));
    keyBindings[togglePrimary] = () => updateStorage(PRIMARY.STORAGE_KEY, (value) => ({ enabled: !value.enabled }));
    keyBindings[toggleSecondary] = () => updateStorage(SECONDARY.STORAGE_KEY, (value) => ({ enabled: !value.enabled }));
  } else {
    Object.values(shortcuts).forEach((value) => delete keyBindings[value]);
  }
}

function handleVideoSkipStorageChange({ oldValue, newValue }: StorageChange<StorageSchema['videoSkip']>) {
  if (oldValue) {
    const { backward, forward } = oldValue;
    delete keyBindings[backward];
    delete keyBindings[forward];
  }
  setKeyBindingsForVideoSkip(newValue || DEFAULT_CONFIG[VIDEO_SKIP.STORAGE_KEY]);
}

function setKeyBindingsForVideoSkip(data: StorageSchema['videoSkip']) {
  const { enabled, backward, forward, skipTime, skipTimeUnit, fallbackTime, fallbackUnit } = data;
  if (enabled) {
    keyBindings[backward] = () => skipVideoTime(-skipTime, skipTimeUnit, -fallbackTime, fallbackUnit);
    keyBindings[forward] = () => skipVideoTime(skipTime, skipTimeUnit, fallbackTime, fallbackUnit);
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

function handleLoopStorageChange({ oldValue, newValue }: StorageChange<StorageSchema['loop']>) {
  if (oldValue) {
    const { enabled, ...shortcuts } = oldValue;
    Object.values(shortcuts).forEach((value) => delete keyBindings[value]);
  }
  setKeyBindingsForLoop(newValue || DEFAULT_CONFIG[LOOP.STORAGE_KEY]);
}

function setKeyBindingsForLoop({ enabled, ...shortcuts }: StorageSchema['loop']) {
  const { toggleLoop: toggleLoopKey, startPoint, endPoint } = shortcuts;
  if (enabled) {
    keyBindings[toggleLoopKey] = toggleLoop;
    keyBindings[startPoint] = setStartPoint;
    keyBindings[endPoint] = setEndPoint;
    keyBindings[shortcuts.loopCurrentSubtitle] = loopCurrentSubtitle;
  } else {
    Object.values(shortcuts).forEach((value) => delete keyBindings[value]);
  }
}

function isInputField(): boolean {
  const activeElementTag = document.activeElement?.tagName || '';
  return ['INPUT', 'TEXTAREA'].includes(activeElementTag);
}

function skipVideoTime(
  skipTime: number,
  skipTimeUnit: StorageSchema['videoSkip']['skipTimeUnit'],
  fallbackTime: number,
  fallbackUnit: StorageSchema['videoSkip']['fallbackUnit']
) {
  const video = elementStore.getVideoElement();
  if (!video) return;

  if (skipTimeUnit === 'subtitles') {
    skipVideoBySubtitles(video, skipTime, fallbackTime, fallbackUnit);
  } else {
    skipVideoByTime(video, skipTime, skipTimeUnit);
  }
}

const skipVideoBySubtitles = (
  video: HTMLVideoElement,
  skipTime: number,
  fallbackTime: number,
  fallbackUnit: StorageSchema['videoSkip']['fallbackUnit']
) => {
  const { currentTime, duration } = video;
  const { subtitles, delay } = subtitleStore.getPrimarySubtitleAndDelay();

  if (subtitles && subtitles.length > 0) {
    const index = findSubtitleIndex(subtitles, currentTime - delay);

    if (skipTime > 0) {
      const nextSubtitle = subtitles[Math.floor(index) + skipTime];
      video.currentTime = nextSubtitle ? nextSubtitle.start + delay : duration - 1;
    } else {
      const prevSubtitle = subtitles[Math.ceil(index) + skipTime];
      video.currentTime = prevSubtitle ? prevSubtitle.start + delay : 0;
    }
  } else {
    skipVideoByTime(video, fallbackTime, fallbackUnit);
  }
};

const skipVideoByTime = (
  video: HTMLVideoElement,
  skipTime: number,
  skipTimeUnit: StorageSchema['videoSkip']['fallbackUnit']
) => {
  const { currentTime, duration } = video;
  const unitMap = { seconds: 1, minutes: 60 };
  const time = currentTime + skipTime * unitMap[skipTimeUnit];

  video.currentTime = Math.min(Math.max(time, 0), duration - 1);
};
