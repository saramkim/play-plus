import { elementStore } from '@/content/store/element-store';

export class PlaybackSpeedController {
  private readonly MIN_SPEED = 0.3;
  private readonly MAX_SPEED = 2.0;
  private readonly SPEED_STEP = 0.1;

  private currentSpeed = 1.0;

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
