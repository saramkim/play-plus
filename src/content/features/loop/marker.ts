import { formatTime } from '@utils/helper';

import { elementStore } from '@/content/store/element-store';
import { createMarker } from '@/content/utils/dom';

import { LOOP_CONSTANTS } from './controller';
import { getPositionByMouse, getTimeByOffsetLeft } from './utils';

export const START_MARKER_ID = 'loop-marker-start';
export const END_MARKER_ID = 'loop-marker-end';

export class LoopMarker {
  private marker: HTMLElement;
  private status: HTMLElement;
  private isDragging: boolean;
  private time: number;
  private container: HTMLElement;

  constructor(id: string, label: string, container: HTMLElement) {
    this.marker = createMarker(id, label);
    this.status = document.createElement('div');
    this.isDragging = false;
    this.time = id === START_MARKER_ID ? 0 : LOOP_CONSTANTS.DEFAULT_LOOP_TIME;
    this.container = container;
    this.initialize();
  }

  updateTime(time: number) {
    if (this.time === time) return;
    this.time = time;
    this.status.textContent = formatTime(time);
    this.moveByTime(time);
  }

  moveByTime(time: number) {
    const video = elementStore.getVideoElement();
    if (!video) return;
    const position = `${(time / video.duration) * 100}%`;
    this.updatePosition(position);
  }

  getTime() {
    return this.time;
  }

  getStatus() {
    return this.status;
  }

  private initialize() {
    this.container.appendChild(this.marker);
    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.marker.addEventListener('mousedown', (e: MouseEvent) => {
      e.stopPropagation();
      this.isDragging = true;
      const position = getPositionByMouse(this.container, e);
      this.updatePosition(position);
      document.addEventListener('mouseup', this.handleMouseUp);
      document.addEventListener('mousemove', this.handleMouseMove);
    });
  }

  private handleMouseUp = () => {
    if (!this.isDragging) return;

    const video = elementStore.getVideoElement();
    if (!video) return;

    this.isDragging = false;
    this.time = getTimeByOffsetLeft(this.container, this.marker.offsetLeft, video.duration);
    this.status.textContent = formatTime(this.time);

    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('mousemove', this.handleMouseMove);
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.isDragging) return;
    const position = getPositionByMouse(this.container, e);
    this.updatePosition(position);
  };

  private updatePosition(position: string) {
    this.marker.style.left = position;
    this.marker.style.transform = `translateX(-${this.marker.clientWidth / 2}px)`;
  }
}
