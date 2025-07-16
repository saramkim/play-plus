import { SETTINGS, SubtitleSettingStorageKey } from '@utils/constants';

import { createElement } from '@/content/core/utils/dom';
import { useLoopStore } from '@/content/features/loop/loop-store';
import { usePlaybackSpeedStore } from '@/content/features/playback-speed/playback-speed-store';
import { setupSubtitleSaveHandler } from '@/content/features/subtitle/save-subtitle';
import { useSubtitleStore } from '@/content/features/subtitle/subtitle-store';
import { applySubtitleStyles, createSubtitleElement } from '@/content/features/subtitle/subtitle-utils';
import { platform } from '@/content/platform/strategy';

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

  getReactRoot() {
    return this.reactRoot;
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

    const { subtitleSettings } = useSubtitleStore.getState();
    for (const [key, config] of Object.entries(subtitleSettings)) {
      const subtitleElement = this.subtitleElementMap[key];
      applySubtitleStyles(subtitleElement, config);
      setupSubtitleSaveHandler(subtitleElement);
      fragment.appendChild(subtitleElement);
    }

    this.subtitleContainer.replaceChildren(fragment);
  }
}

export const elementStore = new ElementStore();
