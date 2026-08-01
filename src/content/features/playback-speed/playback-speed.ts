import { StorageChanges } from '@storage/type';
import { SETTINGS } from '@utils/constants';

import { videoManager } from '@/content/core/video/video-manager';
import { usePlaybackSpeedStore } from '@/content/features/playback-speed/playback-speed-store';

const { STORAGE_KEY } = SETTINGS.PLAYBACK_SPEED;
export class PlaybackSpeedController {
  private unsubscribeState: (() => void) | null = null;

  start() {
    if (this.unsubscribeState) return;
    this.unsubscribeState = usePlaybackSpeedStore.subscribe((state) => {
      const video = videoManager.get();
      if (!video) return;

      video.playbackRate = state.currentSpeed;
    });
  }

  stop() {
    this.unsubscribeState?.();
    this.unsubscribeState = null;
  }

  onStorageChange(changes: StorageChanges) {
    const playbackSpeedChanges = changes[STORAGE_KEY];
    if (playbackSpeedChanges) {
      const enabled = playbackSpeedChanges.newValue?.enabled;
      if (!enabled) usePlaybackSpeedStore.getState().resetSpeed();
    }
  }
}

export const playbackSpeedController = new PlaybackSpeedController();
