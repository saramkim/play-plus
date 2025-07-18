import { DEFAULT_CONFIG } from '@storage/default';
import { StorageChanges } from '@storage/type';
import { SETTINGS } from '@utils/constants';
import { t } from '@utils/i18n';

import { elementStore } from '@/content/core/store/element-store';
import { useToastStore } from '@/content/core/store/toast-store';
import { useVideoStore } from '@/content/core/store/video-store';
import { videoManager } from '@/content/core/video/video-manager';
import { useLoopStore } from '@/content/features/loop/loop-store';
import { useSubtitleStore } from '@/content/features/subtitle/subtitle-store';
import { findSubtitle } from '@/content/features/subtitle/subtitle-utils';

import { END_MARKER_ID, LoopMarker, START_MARKER_ID } from './loop-marker';
import { isOutsideLoopRange } from './loop-utils';

const { STORAGE_KEY } = SETTINGS.LOOP;

export const LOOP_CONSTANTS = {
  DEFAULT_LOOP_TIME: 10,
} as const;

type LoopType = 'subtitle' | 'manual';

export class LoopController {
  private markerContainer = elementStore.getLoopMarkerContainer();
  private startMarker = new LoopMarker(
    START_MARKER_ID,
    'A',
    this.markerContainer,
    useLoopStore.getState().setStartTime
  );
  private endMarker = new LoopMarker(END_MARKER_ID, 'B', this.markerContainer, useLoopStore.getState().setEndTime);
  private isMarkerShowing = false;
  private unsubscribeLoop: (() => void) | null = null;

  constructor() {
    useLoopStore.subscribe((state) => {
      this.startMarker.updateState(state.isLooping);
      this.endMarker.updateState(state.isLooping);
    });
  }

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
    const video = videoManager.get();
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
    const video = videoManager.get();
    if (!video) return;

    const { currentTime, duration } = video;
    const endTime = time !== undefined ? Math.min(time, duration - 1) : currentTime;

    if (!this.isMarkerShowing) {
      this.showLoopMarkers();
      this.setStartPoint(currentTime - LOOP_CONSTANTS.DEFAULT_LOOP_TIME);
    }

    this.endMarker.updateTime(endTime);
  };

  resetLoop = () => {
    this.isMarkerShowing = false;
    useLoopStore.getState().setLooping(false);
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
      const video = videoManager.get();
      if (!video) throw new Error(t('error_video_not_found'));

      const { startTime, endTime } = this.getCurrentSubtitleInfo();

      const unsubscribe = useVideoStore.subscribe(({ currentTime }) => {
        if (currentTime >= endTime) {
          video.pause();
          video.currentTime = endTime;
          unsubscribe();
        }
      });

      video.currentTime = startTime;
      video.play();
    } catch (e) {
      this.handleLoopError(e);
    }
  };

  private loop = (isLooping: boolean, loopType: LoopType = 'manual') => {
    const video = videoManager.get();
    if (!video) return;

    try {
      if (isLooping) {
        this.startLoop(video);
        useLoopStore.getState().setLooping(true, loopType);
      } else {
        this.stopLoop();
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

    this.unsubscribeLoop = useVideoStore.subscribe(({ currentTime }) => {
      const { startTime, endTime } = useLoopStore.getState();

      if (isOutsideLoopRange(currentTime, startTime, endTime)) {
        this.loop(false);
        useToastStore.getState().addToast(t('info_loop_stop'), t('info_loop_stop_message'));
      } else if (currentTime > endTime) {
        video.currentTime = startTime;
      }
    });

    video.play();
  };

  private stopLoop = () => {
    if (this.unsubscribeLoop) {
      this.unsubscribeLoop();
      this.unsubscribeLoop = null;
    }
  };

  private handleLoopError = (e: unknown) => {
    const message = e instanceof Error ? e.message : JSON.stringify(e);
    useToastStore.getState().addToast(`✖ ${t('error_loop')}`, message);
  };

  private showLoopMarkers = () => {
    this.markerContainer.classList.add('show');
    this.isMarkerShowing = true;
  };

  private getCurrentSubtitleInfo = () => {
    const subtitles = useSubtitleStore.getState().getPrimarySubtitle();
    if (!subtitles || subtitles.length === 0) throw new Error(t('error_no_subtitle'));

    const { currentTime } = useVideoStore.getState();
    const currentSubtitle = findSubtitle(subtitles, currentTime);
    if (!currentSubtitle) throw new Error(t('error_no_current_subtitle'));

    const startTime = currentSubtitle.start;
    const endTime = currentSubtitle.end;

    return { startTime, endTime };
  };
}
