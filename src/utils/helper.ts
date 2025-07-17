import { SubtitleData } from './parse';

export const formatTime = (seconds: number): string => {
  const roundedSeconds = Math.round(seconds);
  let hours = Math.floor(roundedSeconds / 3600);
  let minutes = Math.floor((roundedSeconds % 3600) / 60);
  let remainingSeconds = roundedSeconds % 60;

  if (remainingSeconds === 60) {
    remainingSeconds = 0;
    minutes += 1;

    if (minutes === 60) {
      minutes = 0;
      hours += 1;
    }
  }

  const parts = [
    hours > 0 ? String(hours).padStart(2, '0') : null,
    String(minutes).padStart(2, '0'),
    String(remainingSeconds).padStart(2, '0'),
  ].filter(Boolean);

  return parts.join(':');
};

/**
 * 주어진 시간에 해당하는 자막 인덱스를 반환한다.
 *
 * - 자막 범위에 정확히 포함되면 정수 인덱스를 반환
 * - 자막과 자막 사이에 위치하면 `n + 0.5` 형식으로 반환
 */
export const findSubtitleIndex = (subtitles: SubtitleData[], time: number): number => {
  const fixedTime = toFixedTime(time);
  let left = 0;
  let right = subtitles.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const { start, end } = subtitles[mid];

    if (isInTimeRange(start, end, time)) return mid;

    if (fixedTime < toFixedTime(start)) {
      if (mid === 0) return 0 - 0.5; // 첫 번째 자막 이전
      if (fixedTime > toFixedTime(subtitles[mid - 1].end)) return mid - 0.5; // 자막 사이
      right = mid - 1;
    } else {
      if (mid === subtitles.length - 1) return subtitles.length - 1 + 0.5; // 마지막 자막 이후
      if (fixedTime < toFixedTime(subtitles[mid + 1].start)) return mid + 0.5; // 자막 사이
      left = mid + 1;
    }
  }

  return -1;
};

export const toFixedTime = (n: number, precision = 100) => Math.round(n * precision);

export const isInTimeRange = (start: number, end: number, time: number, precision = 100) => {
  const t = toFixedTime(time, precision);
  return toFixedTime(start, precision) <= t && t <= toFixedTime(end, precision);
};

export const stripTags = (line: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${line}</div>`, 'text/html');
  return doc.body.textContent?.trim() ?? '';
};
