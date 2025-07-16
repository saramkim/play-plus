import { DEFAULT_CONFIG } from '@storage/default';
import { updateStorage } from '@storage/index';
import { StorageChange, StorageSchema } from '@storage/type';
import { SETTINGS } from '@utils/constants';

import { elementStore } from '@/content/core/store/element-store';
import { loopController } from '@/content/features/loop';
import { skipVideoTime } from '@/content/features/navigation/video-navigation';
import { usePlaybackSpeedStore } from '@/content/features/playback-speed/playback-speed-store';
import { saveSubtitleWithToast } from '@/content/features/subtitle/save-subtitle';

const { SHORTCUTS, LOOP, VIDEO_SKIP, PLAYBACK_SPEED } = SETTINGS;

export class KeyBindingManager {
  private keyBindings: { [key: string]: () => void } = {};

  handleShortcutsStorageChange({ oldValue, newValue }: StorageChange<StorageSchema['shortcuts']>) {
    if (oldValue) {
      const { enabled, ...shortcuts } = oldValue;
      Object.values(shortcuts).forEach((value) => delete this.keyBindings[value]);
    }
    this.setKeyBindingsForShortcuts(newValue || DEFAULT_CONFIG[SHORTCUTS.STORAGE_KEY]);
  }

  handleVideoSkipStorageChange({ oldValue, newValue }: StorageChange<StorageSchema['videoSkip']>) {
    if (oldValue) {
      const { backward, forward } = oldValue;
      delete this.keyBindings[backward];
      delete this.keyBindings[forward];
    }
    this.setKeyBindingsForVideoSkip(newValue || DEFAULT_CONFIG[VIDEO_SKIP.STORAGE_KEY]);
  }

  handleLoopStorageChange({ oldValue, newValue }: StorageChange<StorageSchema['loop']>) {
    if (oldValue) {
      const { enabled, ...shortcuts } = oldValue;
      Object.values(shortcuts).forEach((value) => delete this.keyBindings[value]);
    }
    this.setKeyBindingsForLoop(newValue || DEFAULT_CONFIG[LOOP.STORAGE_KEY]);
  }

  handlePlaybackSpeedStorageChange({ oldValue, newValue }: StorageChange<StorageSchema['playbackSpeed']>) {
    if (oldValue) {
      const { enabled, ...shortcuts } = oldValue;
      Object.values(shortcuts).forEach((value) => delete this.keyBindings[value]);
    }
    this.setKeyBindingsForPlaybackSpeed(newValue || DEFAULT_CONFIG[PLAYBACK_SPEED.STORAGE_KEY]);
  }

  getKeyBindings() {
    return this.keyBindings;
  }

  private setKeyBindingsForShortcuts({ enabled, ...shortcuts }: StorageSchema['shortcuts']) {
    if (enabled) {
      const { PRIMARY, SECONDARY } = SETTINGS.SUBTITLES;
      const { savePrimary, saveSecondary, togglePrimary, toggleSecondary } = shortcuts;

      this.keyBindings[savePrimary] = () => saveSubtitleWithToast(elementStore.getSubtitleElement(PRIMARY.STORAGE_KEY));
      this.keyBindings[saveSecondary] = () =>
        saveSubtitleWithToast(elementStore.getSubtitleElement(SECONDARY.STORAGE_KEY));
      this.keyBindings[togglePrimary] = () =>
        updateStorage(PRIMARY.STORAGE_KEY, (value) => ({ enabled: !value.enabled }));
      this.keyBindings[toggleSecondary] = () =>
        updateStorage(SECONDARY.STORAGE_KEY, (value) => ({ enabled: !value.enabled }));
    } else {
      Object.values(shortcuts).forEach((value) => delete this.keyBindings[value]);
    }
  }

  private setKeyBindingsForVideoSkip(data: StorageSchema['videoSkip']) {
    const { enabled, backward, forward, skipTime, skipTimeUnit, fallbackTime, fallbackUnit } = data;
    if (enabled) {
      this.keyBindings[backward] = () => skipVideoTime(-skipTime, skipTimeUnit, -fallbackTime, fallbackUnit);
      this.keyBindings[forward] = () => skipVideoTime(skipTime, skipTimeUnit, fallbackTime, fallbackUnit);
    } else {
      delete this.keyBindings[backward];
      delete this.keyBindings[forward];
    }
  }

  private setKeyBindingsForLoop({ enabled, ...shortcuts }: StorageSchema['loop']) {
    const { toggleLoop, startPoint, endPoint, loopCurrentSubtitle, playCurrentSubtitleOnce } = shortcuts;
    if (enabled) {
      this.keyBindings[toggleLoop] = () => loopController.toggleLoop();
      this.keyBindings[startPoint] = () => loopController.setStartPoint();
      this.keyBindings[endPoint] = () => loopController.setEndPoint();
      this.keyBindings[loopCurrentSubtitle] = () => loopController.loopCurrentSubtitle();
      this.keyBindings[playCurrentSubtitleOnce] = () => loopController.playCurrentSubtitleOnce();
    } else {
      Object.values(shortcuts).forEach((value) => delete this.keyBindings[value]);
    }
  }

  private setKeyBindingsForPlaybackSpeed({ enabled, ...shortcuts }: StorageSchema['playbackSpeed']) {
    const { increase, decrease, reset } = shortcuts;
    if (enabled) {
      this.keyBindings[increase] = () => usePlaybackSpeedStore.getState().increaseSpeed();
      this.keyBindings[decrease] = () => usePlaybackSpeedStore.getState().decreaseSpeed();
      this.keyBindings[reset] = () => usePlaybackSpeedStore.getState().resetSpeed();
    } else {
      Object.values(shortcuts).forEach((value) => delete this.keyBindings[value]);
    }
  }
}
