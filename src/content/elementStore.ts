import {
  LOOP_BUTTON_ID,
  LOOP_MARKER_CONTAINER_ID,
  LOOP_STATUS_CONTAINER_ID,
  TOAST_CONTAINER_ID,
  TRACK_DISPLAY_CONTAINER_CLASS_NAME,
} from '../utils/constants';
import { SUBTITLE_CONTAINER_ID } from '../utils/constants';
import { createElement, createLoopIcon, selectVideoElement } from '../utils/dom';

type ElementStore = {
  videoElement: HTMLVideoElement | null;
  trackDisplayContainer: HTMLElement | null;
  subtitleContainer: HTMLElement;
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
  toastContainer: createElement(TOAST_CONTAINER_ID),
  sliderContainer: null,
  controlsLeft: null,
  loopMarkerContainer: createElement(LOOP_MARKER_CONTAINER_ID),
  loopStatusContainer: createElement(LOOP_STATUS_CONTAINER_ID),
  loopButton: createElement(LOOP_BUTTON_ID),
  subtitleContainerObserver: null,
};

function init() {
  elementStore.loopButton.appendChild(createLoopIcon());
}

export async function initializeElementStore() {
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

export function getSubtitleContainer() {
  return elementStore.subtitleContainer;
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

function setupContainer() {
  const {
    trackDisplayContainer,
    subtitleContainer,
    toastContainer,
    loopStatusContainer,
    sliderContainer,
    loopMarkerContainer,
  } = elementStore;

  resetLoopStatus();

  if (elementStore.subtitleContainerObserver) {
    elementStore.subtitleContainerObserver.disconnect();
    elementStore.subtitleContainerObserver = null;
  }

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

  elementStore.subtitleContainerObserver.observe(trackDisplayContainer, { attributes: true });
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
