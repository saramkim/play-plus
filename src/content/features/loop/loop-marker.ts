import { createMarker } from '@/content/core/utils/dom';
import { videoManager } from '@/content/core/video/video-manager';

import { getPositionByMouse, getTimeByOffsetLeft } from './loop-utils';

export const START_MARKER_ID = 'loop-marker-start';
export const END_MARKER_ID = 'loop-marker-end';

export class LoopMarker {
  private marker: HTMLElement;
  private isDragging: boolean;
  private container: HTMLElement;
  private setTime: (time: number) => void;

  constructor(id: string, label: string, container: HTMLElement, setTime: (time: number) => void) {
    this.marker = createMarker(id, label);
    this.isDragging = false;
    this.container = container;
    this.setTime = setTime;
    this.initialize();
  }

  updateTime(time: number) {
    this.setTime(time);
    this.moveByTime(time);
  }

  updateState(enabled: boolean) {
    this.marker.style.color = enabled ? 'var(--pp-primary)' : 'darkgray';
  }

  cancelDrag() {
    this.isDragging = false;
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('mousemove', this.handleMouseMove);
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

  private moveByTime(time: number) {
    const video = videoManager.get();
    if (!video) return;
    const position = `${(time / video.duration) * 100}%`;
    this.updatePosition(position);
  }

  private handleMouseUp = () => {
    if (!this.isDragging) return;

    const video = videoManager.get();
    this.cancelDrag();
    if (!video) return;

    const time = getTimeByOffsetLeft(this.container, this.marker.offsetLeft, video.duration);
    this.setTime(time);
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
