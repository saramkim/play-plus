import { REVIEW, SETTINGS } from '../utils/constants';
import { getStorage } from '../storage/storage';
import {
  applySubtitleStyles,
  arrayToHeadersObject,
  extractSubtitleApiInfoFromResponse,
  findCurrentSubtitle,
  parseVTT,
  SubtitleApiInfo,
  SubtitleData,
} from '../utils/subtitle';
import { getSubtitleElement, getVideoElement } from './elementStore';
import { getSubtitleCache, getSubtitleSettings, setSubtitleCache, setSubtitleSetting } from './subtitleStore';
import { StorageChanges } from '../storage/type';
import { DEFAULT_CONFIG } from '../storage/default';

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

export async function fetchVideoMetadata(url: string, headerList: chrome.webRequest.HttpHeader[]) {
  const headers = {
    ...arrayToHeadersObject(headerList),
    'X-Extension-Request': 'true', // 무한 루프 방지용 커스텀 헤더
  };
  const response = await fetch(url, { headers });
  const apiInfoList = extractSubtitleApiInfoFromResponse(await response.json());
  if (apiInfoList.length === 0) return null;
  return apiInfoList;
}

export async function fetchAndCacheSubtitles(subtitleApiInfoList: SubtitleApiInfo[]) {
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

function syncSubtitles(video: HTMLVideoElement, hasStyleChanged = false) {
  const { currentTime } = video;

  for (const [key, config] of Object.entries(getSubtitleSettings())) {
    const { language, enabled } = config;
    const data = getSubtitleCache(language);
    const subtitleElement = getSubtitleElement(key);

    if (hasStyleChanged) applySubtitleStyles(subtitleElement, config);

    if (data && enabled) {
      setupSubtitle(subtitleElement, data, currentTime);
    }
  }
}

function setupSubtitle(subtitleElement: HTMLElement, data: SubtitleData[], currentTime: number) {
  const { text, start } = findCurrentSubtitle(data, currentTime);

  subtitleElement.innerHTML = text;

  if (start) subtitleElement.dataset[REVIEW.DATA_ATTRIBUTE.START_TIME] = start.toString();
  else delete subtitleElement.dataset[REVIEW.DATA_ATTRIBUTE.START_TIME];
}
