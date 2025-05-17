import { SETTINGS, SubtitleSettingStorageKey } from '@utils/constants';

import { setupSubtitleSaveHandler } from '@/content/features/subtitle/save-subtitle';
import { createElement, createLoopIcon, detectVideoElement } from '@/content/utils/dom';
import { applySubtitleStyles, createSubtitleElement } from '@/content/utils/subtitle';

import { subtitleStore } from './subtitle-store';

const TRACK_DISPLAY_CONTAINER_CLASS_NAME = 'vjs-text-track-display';

const SUBTITLE_CONTAINER_ID = 'pp-subtitle-container';
const TOAST_CONTAINER_ID = 'pp-toast-container';
const LOOP_MARKER_CONTAINER_ID = 'pp-loop-marker-container';
const LOOP_STATUS_CONTAINER_ID = 'pp-loop-status-container';
const LOOP_BUTTON_ID = 'pp-loop-button';
const PLAYBACK_SPEED_CONTAINER_ID = 'pp-playback-speed-container';

class ElementStore {
  private videoElement: HTMLVideoElement | null = null;
  private subtitleContainer = createElement(SUBTITLE_CONTAINER_ID);
  private primarySubtitle = createSubtitleElement();
  private secondarySubtitle = createSubtitleElement();
  private toastContainer = createElement(TOAST_CONTAINER_ID);
  private loopMarkerContainer = createElement(LOOP_MARKER_CONTAINER_ID);
  private loopStatusContainer = createElement(LOOP_STATUS_CONTAINER_ID);
  private loopButton = createElement(LOOP_BUTTON_ID);
  private playbackSpeedContainer = createElement(PLAYBACK_SPEED_CONTAINER_ID);
  private subtitleContainerObserver: MutationObserver | null = null;
  private subtitleElementMap = {
    [SETTINGS.SUBTITLES.PRIMARY.STORAGE_KEY]: this.primarySubtitle,
    [SETTINGS.SUBTITLES.SECONDARY.STORAGE_KEY]: this.secondarySubtitle,
  };

  constructor() {
    this.loopButton.appendChild(createLoopIcon());
    this.setupSubtitleElement();
    this.setupPlaybackSpeedContainer();
  }

  async initialize() {
    const video = await detectVideoElement();
    this.videoElement = video;
    this.setupContainer();
    return video;
  }

  reset() {
    this.videoElement = null;
    this.toastContainer.replaceChildren();
    this.resetLoopStatus();
    this.hidePlaybackSpeedStatus();

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

  getLoopStatusContainer() {
    return this.loopStatusContainer;
  }

  getLoopButton() {
    return this.loopButton;
  }

  getToastContainer() {
    return this.toastContainer;
  }

  resetLoopStatus() {
    this.loopMarkerContainer.classList.remove('show');
    this.loopStatusContainer.classList.remove('show');
    this.loopStatusContainer.classList.remove('spin');
    this.loopButton.classList.remove('active');
  }

  getPlaybackSpeedContainer() {
    return this.playbackSpeedContainer;
  }

  updatePlaybackSpeedStatus(speed: number, isShow = true) {
    if (!isShow) {
      this.hidePlaybackSpeedStatus();
      return;
    }

    this.playbackSpeedContainer.textContent = `${speed.toFixed(1)}x`;
    this.playbackSpeedContainer.classList.add('show');
  }

  hidePlaybackSpeedStatus() {
    this.playbackSpeedContainer.classList.remove('show');
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
    const trackDisplayContainer = document.getElementsByClassName(TRACK_DISPLAY_CONTAINER_CLASS_NAME)[0];
    if (trackDisplayContainer) {
      this.appendContainer(trackDisplayContainer);
      this.observeContainer(trackDisplayContainer);
    }

    const sliderContainer = document.querySelector('div.slider');
    if (sliderContainer) {
      sliderContainer.appendChild(this.loopMarkerContainer);
    }

    const controlsLeft = document.querySelector('.controls-left');
    if (controlsLeft) {
      controlsLeft.appendChild(this.loopButton);
    }
  }

  private observeContainer(trackDisplayContainer: Element) {
    this.subtitleContainerObserver = new MutationObserver(() => {
      this.appendContainer(trackDisplayContainer);
    });
    this.subtitleContainerObserver.observe(trackDisplayContainer, { childList: true });
  }

  private setupPlaybackSpeedContainer() {
    this.playbackSpeedContainer.classList.add('playback-speed');
  }

  private appendContainer(trackDisplayContainer: Element) {
    const subtitleContainerWrapper = trackDisplayContainer.children[0];
    const containers = [
      this.subtitleContainer,
      this.toastContainer,
      this.loopStatusContainer,
      this.playbackSpeedContainer,
    ];

    containers.forEach((container) => {
      if (subtitleContainerWrapper && !subtitleContainerWrapper.contains(container)) {
        subtitleContainerWrapper.appendChild(container);
      }
    });
  }
}

export const elementStore = new ElementStore();
