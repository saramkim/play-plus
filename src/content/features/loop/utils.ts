export const isOutsideLoopRange = (current: number, start: number, end: number): boolean => {
  const buffer = 0.5;
  return current < start - buffer || current > end + buffer;
};

export const getPositionByTime = (video: HTMLVideoElement, time: number): string => {
  return `${(time / video.duration) * 100}%`;
};

export const getPositionByMouse = (container: HTMLElement, e: MouseEvent): string => {
  const { left, width } = container.getBoundingClientRect();
  const current = e.pageX - left;
  const x = Math.max(0, Math.min(current, width));
  return `${(x / width) * 100}%`;
};

export const getTimeByOffsetLeft = (container: HTMLElement, offsetLeft: number, duration: number): number => {
  const { width } = container.getBoundingClientRect();
  return (offsetLeft / width) * duration;
};
