import { DEFAULT_CONFIG } from '@storage/default';
import { updateStorage } from '@storage/index';
import { StorageChange, StorageSchema } from '@storage/type';
import { SETTINGS } from '@utils/constants';
import { findSubtitleIndex } from '@utils/helper';

import { loopController } from '@/content/features/loop';
import { saveSubtitleWithToast } from '@/content/features/subtitle/save-subtitle';
import { elementStore } from '@/content/store/element-store';
import { subtitleStore } from '@/content/store/subtitle-store';

const { SHORTCUTS, LOOP, VIDEO_SKIP } = SETTINGS;

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
      this.keyBindings[backward] = () => this.skipVideoTime(-skipTime, skipTimeUnit, -fallbackTime, fallbackUnit);
      this.keyBindings[forward] = () => this.skipVideoTime(skipTime, skipTimeUnit, fallbackTime, fallbackUnit);
    } else {
      delete this.keyBindings[backward];
      delete this.keyBindings[forward];
    }
  }

  private setKeyBindingsForLoop({ enabled, ...shortcuts }: StorageSchema['loop']) {
    const { toggleLoop: toggleLoopKey, startPoint, endPoint } = shortcuts;
    if (enabled) {
      this.keyBindings[toggleLoopKey] = () => loopController.toggleLoop();
      this.keyBindings[startPoint] = () => loopController.setStartPoint();
      this.keyBindings[endPoint] = () => loopController.setEndPoint();
      this.keyBindings[shortcuts.loopCurrentSubtitle] = () => loopController.loopCurrentSubtitle();
    } else {
      Object.values(shortcuts).forEach((value) => delete this.keyBindings[value]);
    }
  }

  private skipVideoTime(
    skipTime: number,
    skipTimeUnit: StorageSchema['videoSkip']['skipTimeUnit'],
    fallbackTime: number,
    fallbackUnit: StorageSchema['videoSkip']['fallbackUnit']
  ) {
    const video = elementStore.getVideoElement();
    if (!video) return;

    if (skipTimeUnit === 'subtitles') {
      this.skipVideoBySubtitles(video, skipTime, fallbackTime, fallbackUnit);
    } else {
      this.skipVideoByTime(video, skipTime, skipTimeUnit);
    }
  }

  private skipVideoBySubtitles(
    video: HTMLVideoElement,
    skipTime: number,
    fallbackTime: number,
    fallbackUnit: StorageSchema['videoSkip']['fallbackUnit']
  ) {
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
      this.skipVideoByTime(video, fallbackTime, fallbackUnit);
    }
  }

  private skipVideoByTime(
    video: HTMLVideoElement,
    skipTime: number,
    skipTimeUnit: StorageSchema['videoSkip']['fallbackUnit']
  ) {
    const { currentTime, duration } = video;
    const unitMap = { seconds: 1, minutes: 60 };
    const time = currentTime + skipTime * unitMap[skipTimeUnit];

    video.currentTime = Math.min(Math.max(time, 0), duration - 1);
  }
}
