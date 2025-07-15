class VideoManager {
  private video: HTMLVideoElement | null = null;

  set(video: HTMLVideoElement) {
    this.video = video;
  }

  get() {
    return this.video;
  }

  reset() {
    this.video = null;
  }
}
export const videoManager = new VideoManager();
