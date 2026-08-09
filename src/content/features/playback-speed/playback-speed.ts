import { videoManager } from '@/content/core/video/video-manager';
import {
  isListeningMissionActive,
  useListeningMissionActiveStore,
} from '@/content/features/listening-session/mission-active-store';
import { usePlaybackSpeedStore } from '@/content/features/playback-speed/playback-speed-store';

export class PlaybackSpeedController {
  private unsubscribeMission: (() => void) | null = null;
  private unsubscribeState: (() => void) | null = null;

  start() {
    if (this.unsubscribeState) return;
    this.unsubscribeState = usePlaybackSpeedStore.subscribe((state) => {
      this.applySpeed(state.currentSpeed);
    });
    this.unsubscribeMission = useListeningMissionActiveStore.subscribe((state) => {
      if (!state.active) this.syncSpeedFromVideo();
    });
    this.applySpeed(usePlaybackSpeedStore.getState().currentSpeed);
  }

  stop() {
    this.unsubscribeState?.();
    this.unsubscribeMission?.();
    this.unsubscribeState = null;
    this.unsubscribeMission = null;
  }

  private applySpeed(speed: number) {
    if (isListeningMissionActive()) return;
    const video = videoManager.get();
    if (video) video.playbackRate = speed;
  }

  private syncSpeedFromVideo() {
    const video = videoManager.get();
    if (!video) return;
    usePlaybackSpeedStore.setState({ currentSpeed: video.playbackRate });
  }
}

export const playbackSpeedController = new PlaybackSpeedController();
