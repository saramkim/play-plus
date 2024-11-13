import { SubtitleConfig } from './storage';

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

export const parseVTT = (data: string) => {
  const subtitles: SubtitleData[] = [];
  const lines = data.split('\n');
  let currentSubtitle = { start: 0, end: 0, text: '' };

  lines.forEach((line) => {
    if (line.includes('-->')) {
      const [start, end] = line.split(' --> ');
      currentSubtitle.start = timeToSeconds(start.trim());
      currentSubtitle.end = timeToSeconds(end.trim());
    } else if (line.trim() === '') {
      subtitles.push({ ...currentSubtitle });
      currentSubtitle = { start: 0, end: 0, text: '' };
    } else {
      currentSubtitle.text += line + '\n';
    }
  });

  return subtitles;
};

export const createSubtitleContainer = (id: string) => {
  const subtitleContainer = document.createElement('div');
  subtitleContainer.id = id;
  applyStyles(subtitleContainer, {
    width: '100%',
    whiteSpace: 'pre-line',
    position: 'absolute',
    bottom: '2vh',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 'min(1.8vw, 3vh)',
    fontSize: 'min(1.8vw, 3vh)',
    textShadow: 'black 2px 2px 2px',
    fontFamily: 'Pretendard',
  });
  return subtitleContainer;
};

export const createSubtitleElement = (text: string, config: SubtitleConfig) => {
  const { enabled, color, fontSize, fontWeight } = config;
  const subtitle = document.createElement('p');

  subtitle.textContent = text;

  applyStyles(subtitle, {
    lineHeight: '1.5em',
    display: enabled ? 'block' : 'none',
    color: color,
    fontSize: `${0.5 + 0.1 * fontSize}em`,
    fontWeight: `${200 + 100 * fontWeight}`,
  });

  return subtitle;
};

const applyStyles = (element: HTMLElement, styles: Partial<CSSStyleDeclaration>) => {
  Object.assign(element.style, styles);
};

const timeToSeconds = (time: string) => {
  const [hours, minutes, seconds] = time.split(':');
  return Number(hours) * 3600 + Number(minutes) * 60 + parseFloat(seconds);
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
