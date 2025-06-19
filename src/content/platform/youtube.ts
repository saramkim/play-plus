import { PlatformStrategy } from './strategy';

export class YoutubeStrategy implements PlatformStrategy {
  detectVideo() {
    return document.querySelector('video');
  }

  getTrackDisplayContainer() {
    return document.querySelector('#ytp-caption-window-container');
  }

  getProgressBarContainer() {
    return document.querySelector('.ytp-progress-bar-container');
  }
}
