import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { SubtitleData } from './parse';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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

export const findSubtitle = (subtitles: SubtitleData[], time: number) => {
  const fixedTime = toFixedTime(time);
  let left = 0;
  let right = subtitles.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const { start, end } = subtitles[mid];

    if (isInTimeRange(start, end, time)) return subtitles[mid];

    if (fixedTime < toFixedTime(start)) right = mid - 1;
    else left = mid + 1;
  }

  return undefined;
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

export const toFixedTime = (n: number, precision = 1000) => Math.round(n * precision);

export const isInTimeRange = (start: number, end: number, time: number, precision = 1000) => {
  const t = toFixedTime(time, precision);
  return toFixedTime(start, precision) <= t && t <= toFixedTime(end, precision);
};

export const stripTags = (line: string): string => {
  return decodeHtmlEntities(removeMarkupTags(line)).trim();
};

const HTML_ENTITY_PATTERN = /&(?:#(?:[xX][\dA-Fa-f]+|\d+)|[A-Za-z][\dA-Za-z]*);?/gu;
const HTML_TAG_NAME_CHARACTER_PATTERN = /[\dA-Za-z:-]/u;
const HTML_TAG_NAME_START_PATTERN = /[A-Za-z]/u;

const removeMarkupTags = (input: string): string => {
  let plainText = '';
  let textStart = 0;
  let cursor = 0;

  while (cursor < input.length) {
    if (input[cursor] !== '<') {
      cursor += 1;
      continue;
    }

    const tagEnd = findMarkupTagEnd(input, cursor);
    if (tagEnd === undefined) {
      cursor += 1;
      continue;
    }

    plainText += input.slice(textStart, cursor);
    cursor = tagEnd;
    textStart = tagEnd;
  }

  return plainText + input.slice(textStart);
};

const findMarkupTagEnd = (input: string, start: number): number | undefined => {
  if (input.startsWith('<!--', start)) {
    const commentEnd = input.indexOf('-->', start + 4);
    return commentEnd === -1 ? undefined : commentEnd + 3;
  }

  let cursor = start + 1;
  if (input[cursor] === '!' || input[cursor] === '?') {
    return findClosingAngleBracket(input, cursor + 1);
  }
  if (input[cursor] === '/') cursor += 1;
  if (!HTML_TAG_NAME_START_PATTERN.test(input[cursor] ?? '')) return undefined;

  cursor += 1;
  while (HTML_TAG_NAME_CHARACTER_PATTERN.test(input[cursor] ?? '')) cursor += 1;

  const boundary = input[cursor];
  if (
    boundary !== '>' &&
    boundary !== '/' &&
    boundary !== '.' &&
    !/\s/u.test(boundary ?? '')
  ) {
    return undefined;
  }

  return findClosingAngleBracket(input, cursor);
};

const findClosingAngleBracket = (input: string, start: number): number | undefined => {
  let quote: '"' | "'" | undefined;

  for (let cursor = start; cursor < input.length; cursor += 1) {
    const character = input[cursor];
    if (quote !== undefined) {
      if (character === quote) quote = undefined;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '>') return cursor + 1;
  }

  return undefined;
};

const decodeHtmlEntities = (input: string): string => {
  let decoder: Range | undefined;

  return input.replace(HTML_ENTITY_PATTERN, (entity) => {
    // Only one alphanumeric entity token crosses this boundary. Decoding it in
    // a detached fragment can only produce text and never parses raw cue markup.
    decoder ??= document.createRange();
    return decoder.createContextualFragment(entity).textContent ?? entity;
  });
};

export const round = (value: number, decimals = 1) => Number(value.toFixed(decimals));
