import { DEFAULT_CONFIG } from '@storage/default';
import { getStorage } from '@storage/index';
import { StorageChanges } from '@storage/type';
import { SETTINGS } from '@utils/constants';
import { createElement, createLoopIcon, createMarker, showToast } from '@utils/dom';
import { formatTime } from '@utils/helper';
import { t } from '@utils/i18n';
import { findCurrentSubtitleIndex } from '@utils/subtitle';
import {
  getLoopButton,
  getLoopMarkerContainer,
  getLoopStatusContainer,
  getVideoElement,
  resetLoopStatus,
} from './store/elementStore';
import { getPrimarySubtitleCache } from './store/subtitleStore';

const { STORAGE_KEY } = SETTINGS.LOOP;
const START_MARKER_ID = 'loop-marker-start';
const END_MARKER_ID = 'loop-marker-end';
const LOOP_CONSTANTS = {
  DEFAULT_LOOP_TIME: 10,
  BUFFER_TIME: 0.5,
} as const;

const markerContainer = getLoopMarkerContainer();
const loopStatusContainer = getLoopStatusContainer();
const loopButton = getLoopButton();

type State = {
  enabled: boolean;
  isLooping: boolean;
  handleTimeUpdate: (() => void) | null;
  isMarkerShowing: boolean;
};

type MarkerState = {
  marker: HTMLElement;
  status: HTMLElement;
  isDragging: boolean;
  time: number;
};

const state: State = {
  enabled: false,
  isLooping: false,
  handleTimeUpdate: null,
  isMarkerShowing: false,
};

const markerState: Record<string, MarkerState> = {
  [START_MARKER_ID]: {
    marker: createMarker(START_MARKER_ID, 'S'),
    status: createElement('loop-status-start'),
    isDragging: false,
    time: 0,
  },
  [END_MARKER_ID]: {
    marker: createMarker(END_MARKER_ID, 'E'),
    status: createElement('loop-status-end'),
    isDragging: false,
    time: LOOP_CONSTANTS.DEFAULT_LOOP_TIME,
  },
};

export const initializeLoopSetting = async () => {
  const data = await getStorage(STORAGE_KEY);
  state.enabled = data.enabled;

  initializeLoopUI();
};

export const onLoopStorageChange = (changes: StorageChanges) => {
  const loopChanges = changes[STORAGE_KEY];
  if (loopChanges) {
    const { enabled } = loopChanges.newValue || DEFAULT_CONFIG[STORAGE_KEY];
    if (!enabled) {
      loop(false);
      resetLoopStatus();
      state.isMarkerShowing = false;
    }
    loopButton.classList.toggle('show', enabled);
  }
};

export const toggleLoop = () => {
  loop(!state.isLooping);
};

export const setStartPoint = (time?: number) => {
  const video = getVideoElement();
  if (!video) return;

  const { currentTime } = video;
  const startTime = time !== undefined ? Math.max(time, 0) : currentTime;

  if (!state.isMarkerShowing) {
    showLoopMarkers();
    setEndPoint(currentTime + LOOP_CONSTANTS.DEFAULT_LOOP_TIME);
  }

  updateTime(START_MARKER_ID, startTime);
};

export const setEndPoint = (time?: number) => {
  const video = getVideoElement();
  if (!video) return;

  const { currentTime, duration } = video;
  const endTime = time !== undefined ? Math.min(time, duration - 1) : currentTime;

  if (!state.isMarkerShowing) {
    showLoopMarkers();
    setStartPoint(currentTime - LOOP_CONSTANTS.DEFAULT_LOOP_TIME);
  }

  updateTime(END_MARKER_ID, endTime);
};

export const setupLoopHandler = (video: HTMLVideoElement) => {
  state.isMarkerShowing = false;
  state.isLooping = false;

  state.handleTimeUpdate = () => timeUpdateHandler(video);
};

export const loopCurrentSubtitle = () => {
  try {
    const video = getVideoElement();
    if (!video) throw new Error(t('error_video_not_found'));

    const subtitles = getPrimarySubtitleCache();
    if (!subtitles || subtitles.length === 0) throw new Error(t('error_no_subtitle'));

    const index = findCurrentSubtitleIndex(subtitles, video.currentTime);
    const currentSubtitle = subtitles[index];
    if (!currentSubtitle) throw new Error(t('error_no_subtitle'));

    const { start, end } = currentSubtitle;
    if (state.isLooping && markerState[START_MARKER_ID].time === start && markerState[END_MARKER_ID].time === end) {
      loop(false);
    } else {
      setStartPoint(start);
      setEndPoint(end);
      loop(true);
    }
  } catch (e) {
    handleLoopError(e);
  }
};

const initializeLoopUI = () => {
  const loopIcon = createElement('pp-loop-icon');
  loopIcon.appendChild(createLoopIcon());
  loopStatusContainer.appendChild(loopIcon);

  loopButton.classList.toggle('show', state.enabled);
  loopButton.addEventListener('click', toggleLoop);

  Object.entries(markerState).forEach(([key, { status, marker }]) => {
    loopStatusContainer.appendChild(status);
    markerContainer.appendChild(marker);

    marker.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      markerState[key].isDragging = true;

      const position = getPositionByMouse(markerContainer, e);
      updateMarkerPosition(marker, position);

      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('mousemove', handleMouseMove);
    });
  });
};

const loop = (isLooping: boolean) => {
  const video = getVideoElement();
  if (!video) return;

  try {
    if (isLooping) startLoop(video);
    else stopLoop(video);

    updateLoopUI(isLooping);
    state.isLooping = isLooping;
  } catch (e) {
    handleLoopError(e);
  }
};

const startLoop = (video: HTMLVideoElement) => {
  const { currentTime } = video;
  const startTime = markerState[START_MARKER_ID].time;
  const endTime = markerState[END_MARKER_ID].time;

  if (!state.isMarkerShowing) {
    showLoopMarkers();
    setStartPoint(currentTime);
    setEndPoint(currentTime + LOOP_CONSTANTS.DEFAULT_LOOP_TIME);
  } else if (startTime >= endTime) {
    throw new Error(t('error_loop_time_message'));
  } else if (currentTime < startTime || currentTime > endTime) {
    video.currentTime = startTime;
  }

  video.play();
  video.addEventListener('timeupdate', state.handleTimeUpdate!);
};

const stopLoop = (video: HTMLVideoElement) => {
  video.removeEventListener('timeupdate', state.handleTimeUpdate!);
};

const updateLoopUI = (isLooping: boolean) => {
  loopButton.classList.toggle('active', isLooping);
  loopStatusContainer.classList.toggle('show', isLooping);
  loopStatusContainer.classList.toggle('spin', isLooping);
};

const handleLoopError = (e: unknown) => {
  const message = e instanceof Error ? e.message : JSON.stringify(e);
  showToast(t('error_loop'), message, 'error');
};

const showLoopMarkers = () => {
  markerContainer.classList.add('show');
  state.isMarkerShowing = true;
};

const handleMouseUp = () => {
  const draggedMarker = Object.values(markerState).find(({ isDragging }) => isDragging);
  const video = getVideoElement();
  if (!draggedMarker || !video) return;

  draggedMarker.isDragging = false;
  draggedMarker.time = getTimeByOffsetLeft(draggedMarker.marker.offsetLeft, video.duration);
  draggedMarker.status.textContent = formatTime(draggedMarker.time);

  document.removeEventListener('mouseup', handleMouseUp);
  document.removeEventListener('mousemove', handleMouseMove);
};

const handleMouseMove = (e: MouseEvent) => {
  const draggedMarker = Object.values(markerState).find(({ isDragging }) => isDragging);
  if (!draggedMarker) return;

  const position = getPositionByMouse(markerContainer, e);
  updateMarkerPosition(draggedMarker.marker, position);
};

const getTimeByOffsetLeft = (offsetLeft: number, duration: number) => {
  const { width } = markerContainer.getBoundingClientRect();
  return (offsetLeft / width) * duration;
};

const getPositionByMouse = (container: HTMLElement, e: MouseEvent) => {
  const { left, width } = container.getBoundingClientRect();
  const current = e.pageX - left;
  const x = Math.max(0, Math.min(current, width));
  return `${(x / width) * 100}%`;
};

const getPositionByTime = (video: HTMLVideoElement, time: number) => {
  return `${(time / video.duration) * 100}%`;
};

const updateTime = (markerId: string, time: number) => {
  const markerData = markerState[markerId];
  if (markerData.time === time) return;

  markerData.time = time;
  markerData.status.textContent = formatTime(time);

  moveMarkerByTime(markerData.marker, time);
};

const moveMarkerByTime = (marker: HTMLElement, time: number) => {
  const video = getVideoElement();
  if (!video) return;

  const position = getPositionByTime(video, time);
  updateMarkerPosition(marker, position);
};

const updateMarkerPosition = (marker: HTMLElement, position: string) => {
  marker.style.left = position;
  marker.style.transform = `translateX(-${marker.clientWidth / 2}px)`;
};

const timeUpdateHandler = (video: HTMLVideoElement) => {
  const { currentTime } = video;
  if (currentTime === 0) return;

  const startTime = markerState[START_MARKER_ID].time;
  const endTime = markerState[END_MARKER_ID].time;

  if (isOutsideLoopRange(currentTime, startTime, endTime)) {
    loop(false);
    showToast(t('info_loop_stop'), t('info_loop_stop_message'), 'info');
  } else if (currentTime >= endTime) {
    video.currentTime = startTime;
  }
};

const isOutsideLoopRange = (current: number, start: number, end: number): boolean => {
  const buffer = LOOP_CONSTANTS.BUFFER_TIME;
  return current < start - buffer || current > end + buffer;
};
