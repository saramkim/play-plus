import { DEFAULT_CONFIG } from '@storage/default';
import { getStorage } from '@storage/index';
import { StorageChanges } from '@storage/type';
import { REVIEW, SETTINGS } from '@utils/constants';
import {
  applySubtitleStyles,
  arrayToHeadersObject,
  extractSubtitleApiInfoFromResponse,
  findCurrentSubtitle,
  parseVTT,
  SubtitleData,
} from '@utils/subtitle';
import { getSubtitleElement, getVideoElement } from './store/elementStore';
import {
  getCustomSubtitleId,
  getSubtitleCache,
  getSubtitleSettings,
  setSubtitleCache,
  setSubtitleSetting,
} from './store/subtitleStore';

const { SUBTITLES } = SETTINGS;

let handleVideoTimeupdate: (() => void) | null;

export async function onSubtitleStorageChange(changes: StorageChanges) {
  for (const { STORAGE_KEY } of Object.values(SUBTITLES)) {
    const change = changes[STORAGE_KEY];
    if (!change) continue;

    const newConfig = change.newValue || DEFAULT_CONFIG[STORAGE_KEY];
    setSubtitleSetting(STORAGE_KEY, newConfig);

    const video = getVideoElement();
    if (!video) continue;

    syncSubtitles(video, true);

    if (newConfig.enabled) {
      if (!handleVideoTimeupdate) setupSubtitleSync(video);
    } else if (Object.values(getSubtitleSettings()).every(({ enabled }) => !enabled)) {
      stopSubtitleSync(video);
    }
  }
}

export async function initializeSubtitleSync() {
  for (const { STORAGE_KEY } of Object.values(SUBTITLES)) {
    const data = await getStorage(STORAGE_KEY);
    setSubtitleSetting(STORAGE_KEY, data);
  }
}

export async function fetchAndCacheSubtitles(url: string, headers: chrome.webRequest.HttpHeader[]) {
  const subtitleApiInfoList = await fetchVideoMetadata(url, headers);
  for (const { lang, url } of subtitleApiInfoList) {
    setSubtitleCache(lang, await fetchSubtitle(url));
  }
}
``;
export function setupSubtitleSync(video: HTMLVideoElement) {
  syncSubtitles(video, true);
  handleVideoTimeupdate = () => syncSubtitles(video);
  video.addEventListener('timeupdate', handleVideoTimeupdate);
}

export function syncSubtitles(video: HTMLVideoElement, hasStyleChanged = false) {
  const { currentTime } = video;

  for (const [key, config] of Object.entries(getSubtitleSettings())) {
    const { language, enabled } = config;
    const customSubtitleId = getCustomSubtitleId(key);
    const data = getSubtitleCache(customSubtitleId ?? language);
    const subtitleElement = getSubtitleElement(key);

    if (hasStyleChanged) applySubtitleStyles(subtitleElement, config);

    if (data && enabled) {
      setupSubtitle(subtitleElement, data, currentTime);
    }
  }
}

async function fetchVideoMetadata(url: string, headerList: chrome.webRequest.HttpHeader[]) {
  const headers = {
    ...arrayToHeadersObject(headerList),
    'X-Extension-Request': 'true', // 무한 루프 방지용 커스텀 헤더
  };
  const response = await fetch(url, { headers });
  return extractSubtitleApiInfoFromResponse(await response.json());
}

function stopSubtitleSync(video: HTMLVideoElement) {
  if (handleVideoTimeupdate) {
    video.removeEventListener('timeupdate', handleVideoTimeupdate);
    handleVideoTimeupdate = null;
  }
}

async function fetchSubtitle(url: string): Promise<SubtitleData[]> {
  const response = await fetch(url);
  return parseVTT(await response.text());
}

function setupSubtitle(subtitleElement: HTMLElement, data: SubtitleData[], currentTime: number) {
  const { text, start } = findCurrentSubtitle(data, currentTime);

  subtitleElement.innerHTML = text;

  if (start) subtitleElement.dataset[REVIEW.DATA_ATTRIBUTE.START_TIME] = start.toString();
  else delete subtitleElement.dataset[REVIEW.DATA_ATTRIBUTE.START_TIME];
}
