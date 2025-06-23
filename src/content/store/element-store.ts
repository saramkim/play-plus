import { SETTINGS, SubtitleSettingStorageKey } from '@utils/constants';

import { renderApp } from '@/content/app';
import { setupSubtitleSaveHandler } from '@/content/features/subtitle/save-subtitle';
import { platform } from '@/content/platform/strategy';
import { createElement } from '@/content/utils/dom';
import { applySubtitleStyles, createSubtitleElement } from '@/content/utils/subtitle';

import { subtitleStore } from './subtitle-store';

const SUBTITLE_CONTAINER_ID = 'pp-subtitle-container';
const REACT_ROOT_ID = 'pp-root';
const LOOP_MARKER_CONTAINER_ID = 'pp-loop-marker-container';

class ElementStore {
  private videoElement: HTMLVideoElement | null = null;
  private subtitleContainer = createElement(SUBTITLE_CONTAINER_ID);
  private reactRoot = createElement(REACT_ROOT_ID);
  private loopMarkerContainer = createElement(LOOP_MARKER_CONTAINER_ID);
  private subtitleContainerObserver: MutationObserver | null = null;
  private subtitleElementMap = {
    [SETTINGS.SUBTITLES.PRIMARY.STORAGE_KEY]: createSubtitleElement(),
    [SETTINGS.SUBTITLES.SECONDARY.STORAGE_KEY]: createSubtitleElement(),
  };

  constructor() {
    this.setupSubtitleElement();
    renderApp(this.reactRoot);
  }

  async initialize() {
    const video = await platform.detectVideo();
    if (video) platform.afterVideoDetected?.(video);
    this.videoElement = video;
    this.setupContainer();
    return video;
  }

  reset() {
    this.videoElement = null;
    this.resetLoopStatus();

    if (this.subtitleContainerObserver) {
      this.subtitleContainerObserver.disconnect();
      this.subtitleContainerObserver = null;
    }
  }

  getSubtitleElement(key: SubtitleSettingStorageKey) {
    return this.subtitleElementMap[key];
  }

  getVideoElement() {
    return this.videoElement;
  }

  getLoopMarkerContainer() {
    return this.loopMarkerContainer;
  }

  resetLoopStatus() {
    this.loopMarkerContainer.classList.remove('show');
  }

  private setupSubtitleElement() {
    const fragment = document.createDocumentFragment();

    for (const [key, config] of Object.entries(subtitleStore.getSubtitleSettings())) {
      const subtitleElement = this.subtitleElementMap[key];
      applySubtitleStyles(subtitleElement, config);
      setupSubtitleSaveHandler(subtitleElement);
      fragment.appendChild(subtitleElement);
    }

    this.subtitleContainer.replaceChildren(fragment);
  }

  private setupContainer() {
    const trackDisplayContainer = platform.getTrackDisplayContainer();
    if (trackDisplayContainer) {
      this.appendContainer(trackDisplayContainer);
      this.observeContainer(trackDisplayContainer);
    }

    const progressBarContainer = platform.getProgressBarContainer();
    if (progressBarContainer) {
      progressBarContainer.appendChild(this.loopMarkerContainer);
    }
  }

  private observeContainer(trackDisplayContainer: Element) {
    this.subtitleContainerObserver = new MutationObserver(() => {
      this.appendContainer(trackDisplayContainer);
    });
    this.subtitleContainerObserver.observe(trackDisplayContainer, { childList: true });
  }

  private appendContainer(trackDisplayContainer: Element) {
    const containers = [this.reactRoot, this.subtitleContainer];

    containers.forEach((container) => {
      if (!trackDisplayContainer.contains(container)) {
        trackDisplayContainer.appendChild(container);
      }
    });
  }
}

export const elementStore = new ElementStore();
