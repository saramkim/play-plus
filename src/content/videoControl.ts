import { SETTINGS, SUBTITLE_CONTAINER_ID } from '../utils/constants';
import {
  getStorage,
  ShortcutsConfig,
  SkipTimeUnit,
  StorageChange,
  StorageChanges,
  VideoSkipConfig,
} from '../utils/storage';
import { findCurrentSubtitleIndex } from '../utils/subtitle';
import { saveSubtitleWithToast } from './saveSubtitle';
import { subtitleCache } from './subtitle';

type KeyBindings = { [key: string]: () => void };

const { VIDEO_SKIP, SUB_VIDEO_SKIP, SHORTCUTS } = SETTINGS;

const keyBindings: KeyBindings = {};

export function onVideoControlStorageChange(changes: StorageChanges) {
  const videoSkipStorageKeys = [VIDEO_SKIP.STORAGE_KEY, SUB_VIDEO_SKIP.STORAGE_KEY];
  videoSkipStorageKeys.forEach((key) => changes[key] && handleVideoSkipStorageChange(changes[key]));

  const shortcutsChanges = changes[SHORTCUTS.STORAGE_KEY];
  if (shortcutsChanges) handleShortcutsStorageChange(shortcutsChanges);
}

export async function initializeVideoControlSetting() {
  const [videoSkipConfig, subVideoSkipConfig, shortcutsConfig] = await Promise.all([
    getStorage(VIDEO_SKIP.STORAGE_KEY),
    getStorage(SUB_VIDEO_SKIP.STORAGE_KEY),
    getStorage(SHORTCUTS.STORAGE_KEY),
  ]);

  if (videoSkipConfig) setKeyBindingsForVideoSkip(videoSkipConfig);
  if (subVideoSkipConfig) setKeyBindingsForVideoSkip(subVideoSkipConfig);
  if (shortcutsConfig) setKeyBindingsForShortcuts(shortcutsConfig);

  document.addEventListener('keydown', handleKeydown);
}

function handleShortcutsStorageChange({ oldValue, newValue }: StorageChange<ShortcutsConfig>) {
  if (oldValue) {
    const { savePrimary, saveSecondary } = oldValue;
    delete keyBindings[savePrimary];
    delete keyBindings[saveSecondary];
  }
  if (newValue) setKeyBindingsForShortcuts(newValue);
}

function setKeyBindingsForShortcuts(data: ShortcutsConfig) {
  const { PRIMARY, SECONDARY } = SETTINGS.SUBTITLES;
  const { savePrimary, saveSecondary } = data;

  const saveSubtitleByStorageKey = (storageKey: string) => {
    const container = document.getElementById(SUBTITLE_CONTAINER_ID);
    const subtitle = container?.querySelector(`p[data-storage-key="${storageKey}"]`);
    if (!subtitle) return;
    saveSubtitleWithToast(subtitle as HTMLElement);
  };

  keyBindings[savePrimary] = () => saveSubtitleByStorageKey(PRIMARY.STORAGE_KEY);
  keyBindings[saveSecondary] = () => saveSubtitleByStorageKey(SECONDARY.STORAGE_KEY);
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
