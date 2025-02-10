import { SETTINGS } from '../utils/constants';
import { getStorage, updateStorage } from '../storage/storage';
import { findCurrentSubtitleIndex } from '../utils/subtitle';
import { getSubtitleElement, getVideoElement } from './elementStore';
import { toggleLoop, setEndPoint, setStartPoint, loopCurrentSubtitle } from './loop';
import { saveSubtitleWithToast } from './saveSubtitle';
import { getPrimarySubtitleCache } from './subtitleStore';
import {
  LoopConfig,
  ShortcutsConfig,
  SkipTimeUnit,
  StorageChange,
  StorageChanges,
  VideoSkipConfig,
} from '../storage/type';
import { DEFAULT_CONFIG } from '../storage/default';

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

function handleShortcutsStorageChange({ oldValue, newValue }: StorageChange<ShortcutsConfig>) {
  if (oldValue) {
    const { enabled, ...shortcuts } = oldValue;
    Object.values(shortcuts).forEach((value) => delete keyBindings[value]);
  }
  setKeyBindingsForShortcuts(newValue || DEFAULT_CONFIG[SHORTCUTS.STORAGE_KEY]);
}

function setKeyBindingsForShortcuts({ enabled, ...shortcuts }: ShortcutsConfig) {
  if (enabled) {
    const { PRIMARY, SECONDARY } = SETTINGS.SUBTITLES;
    const { savePrimary, saveSecondary, togglePrimary, toggleSecondary } = shortcuts;

    keyBindings[savePrimary] = () => saveSubtitleWithToast(getSubtitleElement(PRIMARY.STORAGE_KEY));
    keyBindings[saveSecondary] = () => saveSubtitleWithToast(getSubtitleElement(SECONDARY.STORAGE_KEY));
    keyBindings[togglePrimary] = () => updateStorage(PRIMARY.STORAGE_KEY, (value) => ({ enabled: !value.enabled }));
    keyBindings[toggleSecondary] = () => updateStorage(SECONDARY.STORAGE_KEY, (value) => ({ enabled: !value.enabled }));
  } else {
    Object.values(shortcuts).forEach((value) => delete keyBindings[value]);
  }
}

function handleVideoSkipStorageChange({ oldValue, newValue }: StorageChange<VideoSkipConfig>) {
  if (oldValue) {
    const { backward, forward } = oldValue;
    delete keyBindings[backward];
    delete keyBindings[forward];
  }
  setKeyBindingsForVideoSkip(newValue || DEFAULT_CONFIG[VIDEO_SKIP.STORAGE_KEY]);
}

function setKeyBindingsForVideoSkip(data: VideoSkipConfig) {
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

function handleLoopStorageChange({ oldValue, newValue }: StorageChange<LoopConfig>) {
  if (oldValue) {
    const { enabled, ...shortcuts } = oldValue;
    Object.values(shortcuts).forEach((value) => delete keyBindings[value]);
  }
  setKeyBindingsForLoop(newValue || DEFAULT_CONFIG[LOOP.STORAGE_KEY]);
}

function setKeyBindingsForLoop({ enabled, ...shortcuts }: LoopConfig) {
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
  skipTimeUnit: SkipTimeUnit,
  fallbackTime: number,
  fallbackUnit: Exclude<SkipTimeUnit, 'subtitles'>
) {
  const video = getVideoElement();
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
  fallbackUnit: Exclude<SkipTimeUnit, 'subtitles'>
) => {
  const { currentTime, duration } = video;
  const subtitles = getPrimarySubtitleCache();

  if (subtitles && subtitles.length > 0) {
    const index = findCurrentSubtitleIndex(subtitles, currentTime);

    if (skipTime > 0) {
      const nextSubtitle = subtitles[Math.floor(index) + skipTime];
      video.currentTime = nextSubtitle ? nextSubtitle.start : duration - 1;
    } else {
      const prevSubtitle = subtitles[Math.ceil(index) + skipTime];
      video.currentTime = prevSubtitle ? prevSubtitle.start : 0;
    }
  } else {
    skipVideoByTime(video, fallbackTime, fallbackUnit);
  }
};

const skipVideoByTime = (
  video: HTMLVideoElement,
  skipTime: number,
  skipTimeUnit: Exclude<SkipTimeUnit, 'subtitles'>
) => {
  const { currentTime, duration } = video;
  const unitMap = { seconds: 1, minutes: 60 };
  const time = currentTime + skipTime * unitMap[skipTimeUnit];

  video.currentTime = Math.min(Math.max(time, 0), duration - 1);
};
