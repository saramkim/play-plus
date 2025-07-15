import { StorageChanges } from '@storage/type';
import { SETTINGS } from '@utils/constants';

import { usePlaybackSpeedStore } from '@/content/store/playback-speed-store';

import { videoManager } from './video-manager';

const { STORAGE_KEY } = SETTINGS.PLAYBACK_SPEED;
export class PlaybackSpeedController {
  constructor() {
    usePlaybackSpeedStore.subscribe((state) => {
      const video = videoManager.get();
      if (!video) return;

      video.playbackRate = state.currentSpeed;
    });
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
