import { useVideoStore } from '@/content/core/store/video-store';

export class VideoManager {
  private video: HTMLVideoElement | null = null;
  private frameCallbackId: number | null = null;

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
      useVideoStore.getState().setCurrentTime(video.currentTime);
      this.frameCallbackId = video.requestVideoFrameCallback(updateCurrentTime);
    };

    this.frameCallbackId = video.requestVideoFrameCallback(updateCurrentTime);
  }

  private stopTimeTracking() {
    if (this.frameCallbackId === null) return;

    this.video?.cancelVideoFrameCallback(this.frameCallbackId);
    this.frameCallbackId = null;
  }
}

export const videoManager = new VideoManager();
