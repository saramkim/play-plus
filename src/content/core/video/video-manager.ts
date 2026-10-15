import { useVideoStore } from '@/content/core/store/video-store';

export class VideoManager {
  private video: HTMLVideoElement | null = null;
  private frameCallbackId: number | null = null;
  private removeTimeListener: (() => void) | null = null;

  set(video: HTMLVideoElement) {
    if (this.video === video) return;

    this.stopTimeTracking();

    this.video = video;
    useVideoStore.getState().setHasVideo(true);
    this.startTimeTracking(video);
  }

  get() {
    return this.video;
  }

  isCurrent(video: HTMLVideoElement) {
    return this.video === video && video.isConnected;
  }

  clear() {
    this.stopTimeTracking();
    this.video = null;
    useVideoStore.getState().setHasVideo(false);
  }

  reset() {
    this.clear();
  }

  private startTimeTracking(video: HTMLVideoElement) {
    const updateCurrentTime = () => {
      if (!this.isCurrent(video)) return;
      useVideoStore.getState().setCurrentTime(video.currentTime);
    };

    // Frame callbacks may pause when Chrome is occluded even while audio keeps playing.
    video.addEventListener('timeupdate', updateCurrentTime);
    this.removeTimeListener = () => video.removeEventListener('timeupdate', updateCurrentTime);
    const updateFrame = () => {
      if (!this.isCurrent(video)) return;
      updateCurrentTime();
      this.frameCallbackId = video.requestVideoFrameCallback(updateFrame);
    };
    this.frameCallbackId = video.requestVideoFrameCallback(updateFrame);
  }

  private stopTimeTracking() {
    this.removeTimeListener?.();
    this.removeTimeListener = null;
    if (this.frameCallbackId === null) return;

    this.video?.cancelVideoFrameCallback(this.frameCallbackId);
    this.frameCallbackId = null;
  }
}

export const videoManager = new VideoManager();
