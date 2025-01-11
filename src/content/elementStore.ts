import { TOAST_CONTAINER_ID, TRACK_DISPLAY_CONTAINER_CLASS_NAME } from '../utils/constants';
import { SUBTITLE_CONTAINER_ID } from '../utils/constants';
import { createElement, selectVideoElement } from '../utils/dom';

type ElementStore = {
  videoElement: HTMLVideoElement | null;
  trackDisplayContainer: HTMLElement | null;
  subtitleContainer: HTMLElement;
  toastContainer: HTMLElement;
  subtitleContainerObserver: MutationObserver | null;
};

const elementStore: ElementStore = {
  videoElement: null,
  trackDisplayContainer: null,
  subtitleContainer: createElement(SUBTITLE_CONTAINER_ID),
  toastContainer: createElement(TOAST_CONTAINER_ID),
  subtitleContainerObserver: null,
};

export async function initializeElementStore() {
  const video = await setVideoElement();

  setTrackDisplayContainer();

  if (elementStore.subtitleContainerObserver) {
    elementStore.subtitleContainerObserver.disconnect();
    elementStore.subtitleContainerObserver = null;
  }
  setupContainer();

  elementStore.subtitleContainer.replaceChildren();
  elementStore.toastContainer.replaceChildren();

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

function setupContainer() {
  const trackDisplayContainer = getTrackDisplayContainer();
  const subtitleContainer = getSubtitleContainer();
  const toastContainer = getToastContainer();

  if (!trackDisplayContainer) return;

  appendContainer(trackDisplayContainer, [subtitleContainer, toastContainer]);
  observeContainer(trackDisplayContainer, [subtitleContainer, toastContainer]);
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
