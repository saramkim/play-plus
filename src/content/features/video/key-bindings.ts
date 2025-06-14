import { DEFAULT_CONFIG } from '@storage/default';
import { updateStorage } from '@storage/index';
import { StorageChange, StorageSchema } from '@storage/type';
import { SETTINGS } from '@utils/constants';
import { findSubtitleIndex } from '@utils/helper';
import { SubtitleData } from '@utils/parse';

import { loopController } from '@/content/features/loop';
import { saveSubtitleWithToast } from '@/content/features/subtitle/save-subtitle';
import { playbackSpeedController } from '@/content/features/video/playback-speed';
import { elementStore } from '@/content/store/element-store';
import { subtitleStore } from '@/content/store/subtitle-store';

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
      this.keyBindings[backward] = () => this.skipVideoTime(-skipTime, skipTimeUnit, -fallbackTime, fallbackUnit);
      this.keyBindings[forward] = () => this.skipVideoTime(skipTime, skipTimeUnit, fallbackTime, fallbackUnit);
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
      this.keyBindings[increase] = () => playbackSpeedController.increaseSpeed();
      this.keyBindings[decrease] = () => playbackSpeedController.decreaseSpeed();
      this.keyBindings[reset] = () => playbackSpeedController.resetSpeed();
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

    if (!subtitles?.length) {
      this.skipVideoByTime(video, fallbackTime, fallbackUnit);
      return;
    }

    const currentIndex = findSubtitleIndex(subtitles, currentTime - delay);
    const targetSubtitle = this.findTargetSubtitle(subtitles, currentIndex, skipTime);

    if (targetSubtitle) {
      this.jumpToSubtitle(video, targetSubtitle, delay);
    } else {
      video.currentTime = skipTime > 0 ? duration - 1 : 0;
    }
  }

  private findTargetSubtitle(
    subtitles: SubtitleData[],
    currentIndex: number,
    skipTime: number
  ): SubtitleData | undefined {
    const targetIndex = skipTime > 0 ? Math.floor(currentIndex) + skipTime : Math.ceil(currentIndex) + skipTime;

    return subtitles[targetIndex];
  }

  private jumpToSubtitle(video: HTMLVideoElement, subtitle: SubtitleData, delay: number) {
    const startTime = subtitle.start + delay;
    video.currentTime = startTime;

    if (loopController.getLoopType() === 'subtitle') {
      loopController.setStartPoint(startTime);
      loopController.setEndPoint(subtitle.end + delay);
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
