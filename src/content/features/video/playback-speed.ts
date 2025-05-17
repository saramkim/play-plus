import { elementStore } from '@/content/store/element-store';
import { DEFAULT_CONFIG } from '@storage/default';
import { StorageChanges } from '@storage/type';
import { SETTINGS } from '@utils/constants';

const { STORAGE_KEY } = SETTINGS.PLAYBACK_SPEED;
export class PlaybackSpeedController {
  private readonly MIN_SPEED = 0.3;
  private readonly MAX_SPEED = 2.0;
  private readonly SPEED_STEP = 0.1;

  private currentSpeed = 1.0;

  onStorageChange = (changes: StorageChanges) => {
    const playbackSpeedChanges = changes[STORAGE_KEY];
    if (playbackSpeedChanges) {
      const { enabled } = playbackSpeedChanges.newValue || DEFAULT_CONFIG[STORAGE_KEY];
      if (!enabled) {
        this.resetSpeed();
      }
    }
  };

  increaseSpeed() {
    const video = elementStore.getVideoElement();
    if (!video) return;

    this.currentSpeed = Math.min(this.MAX_SPEED, this.currentSpeed + this.SPEED_STEP);
    video.playbackRate = this.currentSpeed;
    elementStore.updatePlaybackSpeedStatus(this.currentSpeed);
  }

  decreaseSpeed() {
    const video = elementStore.getVideoElement();
    if (!video) return;

    this.currentSpeed = Math.max(this.MIN_SPEED, this.currentSpeed - this.SPEED_STEP);
    video.playbackRate = this.currentSpeed;
    elementStore.updatePlaybackSpeedStatus(this.currentSpeed);
  }

  resetSpeed() {
    const video = elementStore.getVideoElement();
    if (!video) return;

    this.currentSpeed = 1.0;
    video.playbackRate = this.currentSpeed;
    elementStore.updatePlaybackSpeedStatus(this.currentSpeed, false);
  }

  getCurrentSpeed() {
    return this.currentSpeed;
  }
}

export const playbackSpeedController = new PlaybackSpeedController();
