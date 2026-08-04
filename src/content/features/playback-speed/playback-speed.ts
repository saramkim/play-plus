import { videoManager } from '@/content/core/video/video-manager';
import { usePlaybackSpeedStore } from '@/content/features/playback-speed/playback-speed-store';

export class PlaybackSpeedController {
  private unsubscribeState: (() => void) | null = null;

  start() {
    if (this.unsubscribeState) return;
    this.unsubscribeState = usePlaybackSpeedStore.subscribe((state) => {
      this.applySpeed(state.currentSpeed);
    });
    this.applySpeed(usePlaybackSpeedStore.getState().currentSpeed);
  }

  stop() {
    this.unsubscribeState?.();
    this.unsubscribeState = null;
  }

  private applySpeed(speed: number) {
    const video = videoManager.get();
    if (video) video.playbackRate = speed;
  }
}

export const playbackSpeedController = new PlaybackSpeedController();
