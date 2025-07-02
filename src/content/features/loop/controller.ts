import { DEFAULT_CONFIG } from '@storage/default';
import { StorageChanges } from '@storage/type';
import { SETTINGS } from '@utils/constants';
import { t } from '@utils/i18n';

import { elementStore } from '@/content/store/element-store';
import { useLoopStore } from '@/content/store/loop-store';
import { subtitleStore } from '@/content/store/subtitle-store';
import { useToastStore } from '@/content/store/toast-store';
import { findSubtitle } from '@/content/utils/subtitle';

import { END_MARKER_ID, LoopMarker, START_MARKER_ID } from './marker';
import { isOutsideLoopRange } from './utils';

const { STORAGE_KEY } = SETTINGS.LOOP;

export const LOOP_CONSTANTS = {
  DEFAULT_LOOP_TIME: 10,
} as const;

type LoopType = 'subtitle' | 'manual';

export class LoopController {
  private handleTimeUpdate: (() => void) | null = null;
  private markerContainer = elementStore.getLoopMarkerContainer();
  private startMarker = new LoopMarker(
    START_MARKER_ID,
    'S',
    this.markerContainer,
    useLoopStore.getState().setStartTime
  );
  private endMarker = new LoopMarker(END_MARKER_ID, 'E', this.markerContainer, useLoopStore.getState().setEndTime);
  private isMarkerShowing = false;
  private activeSubtitleEndHandler: (() => void) | null = null;

  onLoopStorageChange = (changes: StorageChanges) => {
    const loopChanges = changes[STORAGE_KEY];
    if (loopChanges) {
      const { enabled } = loopChanges.newValue || DEFAULT_CONFIG[STORAGE_KEY];
      if (!enabled) {
        this.loop(false);
        elementStore.resetLoopStatus();
        this.isMarkerShowing = false;
      }
    }
  };

  toggleLoop = () => {
    const { isLooping } = useLoopStore.getState();
    this.loop(!isLooping);
  };

  getLoopType = () => useLoopStore.getState().loopType;

  setStartPoint = (time?: number) => {
    const video = elementStore.getVideoElement();
    if (!video) return;

    const { currentTime } = video;
    const startTime = time !== undefined ? Math.max(time, 0) : currentTime;

    if (!this.isMarkerShowing) {
      this.showLoopMarkers();
      this.setEndPoint(currentTime + LOOP_CONSTANTS.DEFAULT_LOOP_TIME);
    }

    this.startMarker.updateTime(startTime);
  };

  setEndPoint = (time?: number) => {
    const video = elementStore.getVideoElement();
    if (!video) return;

    const { currentTime, duration } = video;
    const endTime = time !== undefined ? Math.min(time, duration - 1) : currentTime;

    if (!this.isMarkerShowing) {
      this.showLoopMarkers();
      this.setStartPoint(currentTime - LOOP_CONSTANTS.DEFAULT_LOOP_TIME);
    }

    this.endMarker.updateTime(endTime);
  };

  setupLoopHandler = (video: HTMLVideoElement) => {
    this.isMarkerShowing = false;
    useLoopStore.getState().setLooping(false);
    this.handleTimeUpdate = () => this.timeUpdateHandler(video);
  };

  loopCurrentSubtitle = () => {
    try {
      const { startTime, endTime } = this.getCurrentSubtitleInfo();
      const { isLooping, loopType } = useLoopStore.getState();

      if (isLooping && loopType === 'subtitle') {
        this.loop(false);
      } else {
        this.setStartPoint(startTime);
        this.setEndPoint(endTime);
        this.loop(true, 'subtitle');
      }
    } catch (e) {
      this.handleLoopError(e);
    }
  };

  playCurrentSubtitleOnce = () => {
    try {
      const { video, startTime, endTime } = this.getCurrentSubtitleInfo();

      if (this.activeSubtitleEndHandler) {
        video.removeEventListener('timeupdate', this.activeSubtitleEndHandler);
      }

      const handleTimeUpdate = () => {
        if (video.currentTime >= endTime) {
          video.pause();
          video.currentTime = endTime;
          video.removeEventListener('timeupdate', handleTimeUpdate);
        }
      };

      video.currentTime = startTime;
      video.play();
      video.addEventListener('timeupdate', handleTimeUpdate);

      this.activeSubtitleEndHandler = handleTimeUpdate;
    } catch (e) {
      this.handleLoopError(e);
    }
  };

  private loop = (isLooping: boolean, loopType: LoopType = 'manual') => {
    const video = elementStore.getVideoElement();
    if (!video) return;

    try {
      if (isLooping) {
        this.startLoop(video);
        useLoopStore.getState().setLooping(true, loopType);
      } else {
        this.stopLoop(video);
        useLoopStore.getState().setLooping(false);
      }
    } catch (e) {
      this.handleLoopError(e);
    }
  };

  private startLoop = (video: HTMLVideoElement) => {
    const { currentTime } = video;
    const { startTime, endTime } = useLoopStore.getState();

    if (!this.isMarkerShowing) {
      this.showLoopMarkers();
      this.setStartPoint(currentTime);
      this.setEndPoint(currentTime + LOOP_CONSTANTS.DEFAULT_LOOP_TIME);
    } else if (startTime >= endTime) {
      throw new Error(t('error_loop_time_message'));
    } else {
      video.currentTime = startTime;
    }

    video.play();
    video.addEventListener('timeupdate', this.handleTimeUpdate!);
  };

  private stopLoop = (video: HTMLVideoElement) => {
    video.removeEventListener('timeupdate', this.handleTimeUpdate!);
  };

  private handleLoopError = (e: unknown) => {
    const message = e instanceof Error ? e.message : JSON.stringify(e);
    useToastStore.getState().addToast(`✖ ${t('error_loop')}`, message);
  };

  private showLoopMarkers = () => {
    this.markerContainer.classList.add('show');
    this.isMarkerShowing = true;
  };

  private timeUpdateHandler = (video: HTMLVideoElement) => {
    const { currentTime } = video;
    if (currentTime === 0) return;

    const { startTime, endTime } = useLoopStore.getState();

    if (isOutsideLoopRange(currentTime, startTime, endTime)) {
      this.loop(false);
      useToastStore.getState().addToast(t('info_loop_stop'), t('info_loop_stop_message'));
    } else if (currentTime >= endTime) {
      video.currentTime = startTime;
    }
  };

  private getCurrentSubtitleInfo = () => {
    const video = elementStore.getVideoElement();
    if (!video) throw new Error(t('error_video_not_found'));

    const { subtitles, delay } = subtitleStore.getPrimarySubtitleAndDelay();
    if (!subtitles || subtitles.length === 0) throw new Error(t('error_no_subtitle'));

    const currentSubtitle = findSubtitle(subtitles, video.currentTime - delay);
    if (!currentSubtitle) throw new Error(t('error_no_current_subtitle'));

    const startTime = currentSubtitle.start + delay;
    const endTime = currentSubtitle.end + delay;

    return { video, startTime, endTime };
  };
}
