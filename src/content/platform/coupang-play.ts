import { fetchSubtitles } from '@/content/features/subtitle/subtitle';

import { PlatformStrategy } from './strategy';

export class CoupangPlayStrategy implements PlatformStrategy {
  async detectVideo(): Promise<HTMLVideoElement> {
    return new Promise((resolve) => {
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'childList') {
            const addedNodes = Array.from(mutation.addedNodes);
            const video = addedNodes.find((node) => node instanceof HTMLVideoElement);

            if (video) {
              observer.disconnect();
              resolve(video);
              return;
            }
          }
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  getVideoPlayer() {
    return document.querySelector('#playerWrapper');
  }

  getProgressBarContainer() {
    return document.querySelector('div.slider');
  }

  async fetchSubtitles(url: string, headers: chrome.webRequest.HttpHeader[]) {
    return fetchSubtitles(url, headers);
  }
}
