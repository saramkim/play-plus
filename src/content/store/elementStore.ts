import {
  LOOP_BUTTON_ID,
  LOOP_MARKER_CONTAINER_ID,
  LOOP_STATUS_CONTAINER_ID,
  PRIMARY_SUBTITLE_ID,
  SECONDARY_SUBTITLE_ID,
  SETTINGS,
  SUBTITLE_CONTAINER_ID,
  SubtitleSettingStorageKey,
  TOAST_CONTAINER_ID,
  TRACK_DISPLAY_CONTAINER_CLASS_NAME,
} from '@utils/constants';
import { createElement, createLoopIcon, selectVideoElement } from '@utils/dom';
import { applySubtitleStyles, createSubtitleElement } from '@utils/subtitle';
import { setupSubtitleSaveHandler } from '../saveSubtitle';
import { getSubtitleSettings } from './subtitleStore';

type ElementStore = {
  videoElement: HTMLVideoElement | null;
  trackDisplayContainer: HTMLElement | null;
  subtitleContainer: HTMLElement;
  primarySubtitle: HTMLElement;
  secondarySubtitle: HTMLElement;
  toastContainer: HTMLElement;
  sliderContainer: HTMLElement | null;
  controlsLeft: HTMLElement | null;
  loopMarkerContainer: HTMLElement;
  loopStatusContainer: HTMLElement;
  loopButton: HTMLElement;
  subtitleContainerObserver: MutationObserver | null;
};

const elementStore: ElementStore = {
  videoElement: null,
  trackDisplayContainer: null,
  subtitleContainer: createElement(SUBTITLE_CONTAINER_ID),
  primarySubtitle: createSubtitleElement(PRIMARY_SUBTITLE_ID),
  secondarySubtitle: createSubtitleElement(SECONDARY_SUBTITLE_ID),
  toastContainer: createElement(TOAST_CONTAINER_ID),
  sliderContainer: null,
  controlsLeft: null,
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
  resetContainers();

  const video = await setVideoElement();
  setTrackDisplayContainer();
  setSliderContainer();
  setupContainer();
  setupControls();
  return video;
}

export function getVideoElement() {
  return elementStore.videoElement;
}

export function getTrackDisplayContainer() {
  return elementStore.trackDisplayContainer;
}

export function getToastContainer() {
  return elementStore.toastContainer;
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

export function resetLoopStatus() {
  const { loopMarkerContainer, loopStatusContainer, loopButton } = elementStore;
  loopMarkerContainer.classList.remove('show');
  loopStatusContainer.classList.remove('show');
  loopStatusContainer.classList.remove('spin');
  loopButton.classList.remove('active');
}

function resetContainers() {
  const { toastContainer, subtitleContainerObserver } = elementStore;

  toastContainer.replaceChildren();
  resetLoopStatus();

  if (subtitleContainerObserver) {
    subtitleContainerObserver.disconnect();
    elementStore.subtitleContainerObserver = null;
  }
}

function setupContainer() {
  const {
    trackDisplayContainer,
    subtitleContainer,
    toastContainer,
    loopStatusContainer,
    sliderContainer,
    loopMarkerContainer,
  } = elementStore;

  if (trackDisplayContainer) {
    appendContainer(trackDisplayContainer, [subtitleContainer, toastContainer, loopStatusContainer]);
    observeContainer(trackDisplayContainer, [subtitleContainer, toastContainer, loopStatusContainer]);
  }

  if (sliderContainer) {
    sliderContainer.appendChild(loopMarkerContainer);
  }
}

function observeContainer(trackDisplayContainer: Element, containers: HTMLElement[]) {
  elementStore.subtitleContainerObserver = new MutationObserver(() => {
    appendContainer(trackDisplayContainer, containers);
  });

  elementStore.subtitleContainerObserver.observe(trackDisplayContainer, { childList: true });
}

function appendContainer(trackDisplayContainer: Element, containers: HTMLElement[]) {
  const subtitleContainerWrapper = trackDisplayContainer.children[0];

  containers.forEach((container) => {
    if (subtitleContainerWrapper && !subtitleContainerWrapper.contains(container)) {
      subtitleContainerWrapper.appendChild(container);
    }
  });
}

async function setVideoElement() {
  const video = await selectVideoElement();
  elementStore.videoElement = video;
  return video;
}

function setTrackDisplayContainer() {
  elementStore.trackDisplayContainer = document.getElementsByClassName(
    TRACK_DISPLAY_CONTAINER_CLASS_NAME
  )[0] as HTMLElement;
}

function setSliderContainer() {
  elementStore.sliderContainer = document.querySelector('div.slider');
}

function setupControls() {
  const controlsLeft = document.querySelector('.controls-left');
  if (!controlsLeft) return;

  controlsLeft.appendChild(elementStore.loopButton);
}

init();
