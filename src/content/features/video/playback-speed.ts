import { StorageChanges } from '@storage/type';
import { SETTINGS } from '@utils/constants';

import { elementStore } from '@/content/store/element-store';
import { usePlaybackSpeedStore } from '@/content/store/playback-speed-store';

const { STORAGE_KEY } = SETTINGS.PLAYBACK_SPEED;
export class PlaybackSpeedController {
  constructor() {
    usePlaybackSpeedStore.subscribe((state) => {
      const video = elementStore.getVideoElement();
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
