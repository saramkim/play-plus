import { SubtitleConfig } from '@storage/type';
import { applyStyles, createElement } from './dom';

export const arrayToHeadersObject = (headersArray: chrome.webRequest.HttpHeader[]): Record<string, string> => {
  return headersArray.reduce((obj, item) => {
    return { ...obj, [item.name]: item.value };
  }, {});
};

export const extractSubtitleApiInfoFromResponse = (response: ApiResponse) => {
  return response.data.raw.text_tracks
    .filter(({ kind }) => kind === 'subtitles')
    .map(({ srclang, src }) => ({ lang: srclang!, url: src }));
};

export const findCurrentSubtitle = (subtitles: SubtitleData[], currentTime: number) => {
  let left = 0;
  let right = subtitles.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const { start, end, text } = subtitles[mid];

    if (currentTime >= start && currentTime <= end) return { text, start };

    if (currentTime < start) right = mid - 1;
    else left = mid + 1;
  }

  return { text: '' };
};

export const findCurrentSubtitleIndex = (subtitles: SubtitleData[], currentTime: number): number => {
  let left = 0;
  let right = subtitles.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const { start, end } = subtitles[mid];

    // 1️⃣ 현재 자막 범위 내에 있을 때
    if (currentTime >= start && currentTime <= end) return mid;

    // 2️⃣ 왼쪽 탐색
    if (currentTime < start) {
      if (mid === 0) return 0 - 0.5; // 첫 번째 자막 이전
      if (currentTime > subtitles[mid - 1].end) return mid - 0.5; // 자막 사이
      right = mid - 1;
    }
    // 3️⃣ 오른쪽 탐색
    else {
      if (mid === subtitles.length - 1) return subtitles.length - 1 + 0.5; // 마지막 자막 이후
      if (currentTime < subtitles[mid + 1].start) return mid + 0.5; // 자막 사이
      left = mid + 1;
    }
  }

  return -1; // 시간 범위를 벗어난 경우
};

export const createSubtitleElement = (id: string) => {
  const subtitle = createElement(id, 'p');

  applyStyles(subtitle, {
    lineHeight: '1.5em',
    display: 'none',
    position: 'absolute',
    left: '50%',
    pointerEvents: 'auto',
    cursor: 'pointer',
    zIndex: '1000',
    padding: '0 0.5em',
    border: '1px solid transparent',
  });

  return subtitle;
};

export const applySubtitleStyles = (subtitle: HTMLElement, config: SubtitleConfig) => {
  const { enabled, positionReference, positionOffset, color, fontSize, fontWeight, opacity, lineBreak } = config;

  const positions = {
    top: { top: `${positionOffset}px`, bottom: 'auto' },
    center: { top: `calc(50% + ${positionOffset}px)`, bottom: 'auto' },
    bottom: { top: 'auto', bottom: `${positionOffset}px` },
  };

  applyStyles(subtitle, {
    ...positions[positionReference],
    display: enabled ? 'block' : 'none',
    color,
    fontSize: `${0.5 + 0.1 * fontSize}em`,
    fontWeight: `${200 + 100 * fontWeight}`,
    opacity: `${opacity * 0.01}`,
    whiteSpace: lineBreak ? 'pre-line' : 'nowrap',
    transform: positionReference === 'center' ? 'translate(-50%, -50%)' : 'translateX(-50%)',
  });
};

export type SubtitleLanguage = 'en' | 'ko';

export type SubtitleApiInfo = {
  lang: SubtitleLanguage;
  url: string;
};

export type SubtitleData = {
  start: number;
  end: number;
  text: string;
  settings?: string[];
};

export type ApiResponse = {
  success: boolean;
  data: Data;
  meta: Meta;
  'x-payload-signature': string;
  'body-signature': string;
  'client-ip': string;
};

type CuePoint = {
  force_stop: boolean;
  id: string;
  metadata: string;
  name: string;
  time: number;
  type: string;
};

type KeySystem = {
  certificate_url?: string;
  key_request_url: string;
  license_url?: string;
};

type Source = {
  key_systems: {
    'com.apple.fps.1_0'?: KeySystem;
    'com.widevine.alpha'?: KeySystem;
  };
  src: string;
  type: string;
};

type TextTrack = {
  account_id: string | null;
  asset_id: string | null;
  bandwidth: number | null;
  default: boolean | null;
  height: number | null;
  id: string | null;
  kind: string;
  label: string;
  mime_type: string;
  sources: { src: string }[];
  src: string;
  srclang: SubtitleLanguage | null;
  width: number | null;
};

type RawData = {
  account_id: string;
  created_at: string;
  cue_points: CuePoint[];
  duration: number;
  id: string;
  published_at: string;
  sources: Source[];
  text_tracks: TextTrack[];
  updated_at: string;
};

type Data = {
  raw: RawData;
  preferredDrm: string | null;
  streamId: string;
};

type Meta = {
  now: number;
  requestId: string;
};
