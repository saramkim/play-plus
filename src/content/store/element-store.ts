import { SETTINGS, SubtitleSettingStorageKey } from '@utils/constants';

import { renderApp } from '@/content/app';
import { setupSubtitleSaveHandler } from '@/content/features/subtitle/save-subtitle';
import { platform } from '@/content/platform/strategy';
import { createElement } from '@/content/utils/dom';
import { applySubtitleStyles, createSubtitleElement } from '@/content/utils/subtitle';

import { useLoopStore } from './loop-store';
import { usePlaybackSpeedStore } from './playback-speed-store';
import { subtitleStore } from './subtitle-store';

const SUBTITLE_CONTAINER_ID = 'pp-subtitle-container';
const REACT_ROOT_ID = 'pp-root';
const LOOP_MARKER_CONTAINER_ID = 'pp-loop-marker-container';

class ElementStore {
  private subtitleContainer = createElement(SUBTITLE_CONTAINER_ID);
  private reactRoot = createElement(REACT_ROOT_ID);
  private loopMarkerContainer = createElement(LOOP_MARKER_CONTAINER_ID);
  private subtitleElementMap = {
    [SETTINGS.SUBTITLES.PRIMARY.STORAGE_KEY]: createSubtitleElement(),
    [SETTINGS.SUBTITLES.SECONDARY.STORAGE_KEY]: createSubtitleElement(),
  };

  constructor() {
    this.setupSubtitleElement();
    renderApp(this.reactRoot);
  }

  setupContainer() {
    const videoPlayer = platform.getVideoPlayer();
    if (videoPlayer) {
      videoPlayer.appendChild(this.reactRoot);
    }

    const progressBarContainer = platform.getProgressBarContainer();
    if (progressBarContainer) {
      progressBarContainer.appendChild(this.loopMarkerContainer);
    }
  }

  reset() {
    this.resetLoopStatus();
    usePlaybackSpeedStore.getState().resetSpeed();

    for (const subtitleElement of Object.values(this.subtitleElementMap)) {
      subtitleElement.textContent = '';
    }
  }

  getSubtitleElement(key: SubtitleSettingStorageKey) {
    return this.subtitleElementMap[key];
  }

  getLoopMarkerContainer() {
    return this.loopMarkerContainer;
  }

  getSubtitleContainer() {
    return this.subtitleContainer;
  }

  resetLoopStatus() {
    this.loopMarkerContainer.classList.remove('show');
    useLoopStore.getState().reset();
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
}

export const elementStore = new ElementStore();
