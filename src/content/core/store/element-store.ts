import { createElement } from '@/content/core/utils/dom';
import { coupangStrategy } from '@/content/coupang-play';
import { usePlaybackSpeedStore } from '@/content/features/playback-speed/playback-speed-store';
import { SUBTITLE_ROLES, SubtitleRole } from '@/content/features/subtitle/subtitle-store';
import { createSubtitleElement } from '@/content/features/subtitle/subtitle-utils';

const SUBTITLE_CONTAINER_ID = 'pp-subtitle-container';
const VIDEO_ROOT_ID = 'pp-video-root';
const SYSTEM_ROOT_ID = 'pp-system-root';

class ElementStore {
  private subtitleContainer = createElement(SUBTITLE_CONTAINER_ID);
  private videoRoot = createElement(VIDEO_ROOT_ID);
  private systemRoot = createElement(SYSTEM_ROOT_ID);
  private subtitleElementMap: Record<SubtitleRole, HTMLParagraphElement> = {
    learning: createSubtitleElement('learning'),
    support: createSubtitleElement('support'),
  };

  constructor() {
    this.setupSubtitleElements();
  }

  setupContainer() {
    const videoPlayer = coupangStrategy.getVideoPlayer();
    if (videoPlayer && this.videoRoot.parentElement !== videoPlayer) {
      videoPlayer.appendChild(this.videoRoot);
    }
  }

  reset() {
    usePlaybackSpeedStore.getState().resetSpeed();

    for (const subtitleElement of Object.values(this.subtitleElementMap)) {
      subtitleElement.textContent = '';
    }
  }

  setupSystemContainer() {
    if (!this.systemRoot.parentElement) {
      document.body.appendChild(this.systemRoot);
    }
  }

  removeContainers() {
    this.subtitleContainer.remove();
    this.systemRoot.remove();
    this.videoRoot.remove();
  }

  getVideoRoot() {
    return this.videoRoot;
  }

  getSystemRoot() {
    return this.systemRoot;
  }

  getSubtitleElement(role: SubtitleRole) {
    return this.subtitleElementMap[role];
  }

  getSubtitleContainer() {
    return this.subtitleContainer;
  }

  private setupSubtitleElements() {
    const fragment = document.createDocumentFragment();

    for (const role of SUBTITLE_ROLES) {
      fragment.appendChild(this.subtitleElementMap[role]);
    }

    this.subtitleContainer.replaceChildren(fragment);
  }
}

export const elementStore = new ElementStore();
