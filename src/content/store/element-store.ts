import { SETTINGS, SubtitleSettingStorageKey } from '@utils/constants';

import { setupSubtitleSaveHandler } from '@/content/features/subtitle/save-subtitle';
import { createElement, createLoopIcon, detectVideoElement } from '@/content/utils/dom';
import { applySubtitleStyles, createSubtitleElement } from '@/content/utils/subtitle';

import { getSubtitleSettings } from './subtitle-store';

const TRACK_DISPLAY_CONTAINER_CLASS_NAME = 'vjs-text-track-display';

const SUBTITLE_CONTAINER_ID = 'pp-subtitle-container';
const TOAST_CONTAINER_ID = 'pp-toast-container';
const LOOP_MARKER_CONTAINER_ID = 'pp-loop-marker-container';
const LOOP_STATUS_CONTAINER_ID = 'pp-loop-status-container';
const LOOP_BUTTON_ID = 'pp-loop-button';

type ElementStore = {
  videoElement: HTMLVideoElement | null;
  subtitleContainer: HTMLElement;
  primarySubtitle: HTMLElement;
  secondarySubtitle: HTMLElement;
  toastContainer: HTMLElement;
  loopMarkerContainer: HTMLElement;
  loopStatusContainer: HTMLElement;
  loopButton: HTMLElement;
  subtitleContainerObserver: MutationObserver | null;
};

const elementStore: ElementStore = {
  videoElement: null,
  subtitleContainer: createElement(SUBTITLE_CONTAINER_ID),
  primarySubtitle: createSubtitleElement(),
  secondarySubtitle: createSubtitleElement(),
  toastContainer: createElement(TOAST_CONTAINER_ID),
  loopMarkerContainer: createElement(LOOP_MARKER_CONTAINER_ID),
  loopStatusContainer: createElement(LOOP_STATUS_CONTAINER_ID),
  loopButton: createElement(LOOP_BUTTON_ID),
  subtitleContainerObserver: null,
};

const subtitleElementMap = {
  [SETTINGS.SUBTITLES.PRIMARY.STORAGE_KEY]: elementStore.primarySubtitle,
  [SETTINGS.SUBTITLES.SECONDARY.STORAGE_KEY]: elementStore.secondarySubtitle,
};

function init() {
  elementStore.loopButton.appendChild(createLoopIcon());
  setupSubtitleElement();
}

function setupSubtitleElement() {
  const fragment = document.createDocumentFragment();

  for (const [key, config] of Object.entries(getSubtitleSettings())) {
    const subtitleElement = subtitleElementMap[key];
    applySubtitleStyles(subtitleElement, config);
    setupSubtitleSaveHandler(subtitleElement);
    fragment.appendChild(subtitleElement);
  }

  elementStore.subtitleContainer.replaceChildren(fragment);
}

export function getSubtitleElement(key: SubtitleSettingStorageKey) {
  return subtitleElementMap[key];
}

export async function initializeElementStore() {
  const video = await detectVideoElement();
  elementStore.videoElement = video;
  setupContainer();
  return video;
}

export function getVideoElement() {
  return elementStore.videoElement;
}

export function getLoopMarkerContainer() {
  return elementStore.loopMarkerContainer;
}

export function getLoopStatusContainer() {
  return elementStore.loopStatusContainer;
}

export function getLoopButton() {
  return elementStore.loopButton;
}

export function getToastContainer() {
  return elementStore.toastContainer;
}

export function resetLoopStatus() {
  const { loopMarkerContainer, loopStatusContainer, loopButton } = elementStore;
  loopMarkerContainer.classList.remove('show');
  loopStatusContainer.classList.remove('show');
  loopStatusContainer.classList.remove('spin');
  loopButton.classList.remove('active');
}

export function resetElementStore() {
  const { toastContainer, subtitleContainerObserver } = elementStore;
  elementStore.videoElement = null;
  toastContainer.replaceChildren();
  resetLoopStatus();

  if (subtitleContainerObserver) {
    subtitleContainerObserver.disconnect();
    elementStore.subtitleContainerObserver = null;
  }
}

function setupContainer() {
  const trackDisplayContainer = document.getElementsByClassName(TRACK_DISPLAY_CONTAINER_CLASS_NAME)[0];
  if (trackDisplayContainer) {
    appendContainer(trackDisplayContainer);
    observeContainer(trackDisplayContainer);
  }

  const sliderContainer = document.querySelector('div.slider');
  if (sliderContainer) {
    sliderContainer.appendChild(elementStore.loopMarkerContainer);
  }

  const controlsLeft = document.querySelector('.controls-left');
  if (controlsLeft) {
    controlsLeft.appendChild(elementStore.loopButton);
  }
}

function observeContainer(trackDisplayContainer: Element) {
  elementStore.subtitleContainerObserver = new MutationObserver(() => {
    appendContainer(trackDisplayContainer);
  });
  elementStore.subtitleContainerObserver.observe(trackDisplayContainer, { childList: true });
}

function appendContainer(trackDisplayContainer: Element) {
  const subtitleContainerWrapper = trackDisplayContainer.children[0];
  const { subtitleContainer, toastContainer, loopStatusContainer } = elementStore;

  [subtitleContainer, toastContainer, loopStatusContainer].forEach((container) => {
    if (subtitleContainerWrapper && !subtitleContainerWrapper.contains(container)) {
      subtitleContainerWrapper.appendChild(container);
    }
  });
}

init();
