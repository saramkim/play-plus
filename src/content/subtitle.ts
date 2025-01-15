import { REVIEW, SETTINGS } from '../utils/constants';
import { getStorage } from '../storage/storage';
import {
  arrayToHeadersObject,
  createSubtitleElement,
  extractSubtitleApiInfoFromResponse,
  findCurrentSubtitle,
  parseVTT,
  SubtitleApiInfo,
  SubtitleData,
} from '../utils/subtitle';
import { getSubtitleContainer, getVideoElement } from './elementStore';
import { setupSubtitleSaveHandler } from './saveSubtitle';
import { getSubtitleApiInfoList, getSubtitleCache, getSubtitleSettings, setSubtitleSetting } from './subtitleStore';
import { StorageChanges } from '../storage/type';

const { SUBTITLES } = SETTINGS;

let handleVideoTimeupdate: ((arg?: Event | boolean) => void) | null;

export async function onSubtitleStorageChange(changes: StorageChanges) {
  for (const { STORAGE_KEY } of Object.values(SUBTITLES)) {
    const subtitleChanges = changes[STORAGE_KEY];

    if (subtitleChanges && subtitleChanges.newValue) {
      setSubtitleSetting(STORAGE_KEY, subtitleChanges.newValue);

      const subtitleApiInfoList = getSubtitleApiInfoList();
      if (subtitleChanges.newValue.enabled && subtitleApiInfoList) {
        await fetchAndSyncSubtitles(subtitleApiInfoList);

        const video = getVideoElement();
        if (video && !handleVideoTimeupdate) setupSubtitleSync(video);
      } else if (Object.values(getSubtitleSettings()).every(({ enabled }) => !enabled)) {
        stopSubtitleSync();
      }

      if (handleVideoTimeupdate) handleVideoTimeupdate(true);
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

export async function fetchAndSyncSubtitles(subtitleApiInfoList: SubtitleApiInfo[]) {
  const subtitleCache = getSubtitleCache();

  for (const { lang, url } of subtitleApiInfoList) {
    const isEnabled = Object.values(getSubtitleSettings()).some(
      ({ language, enabled }) => enabled && language === lang
    );
    if (isEnabled && !subtitleCache.has(lang)) {
      subtitleCache.set(lang, await fetchSubtitle(url));
    }
  }
}

export function setupSubtitleSync(video: HTMLVideoElement) {
  updateSubtitleText(video);

  handleVideoTimeupdate = (arg) => updateSubtitleText(video, typeof arg === 'boolean' ? arg : false);
  video.addEventListener('timeupdate', handleVideoTimeupdate);
}

function stopSubtitleSync() {
  const video = getVideoElement();

  if (video && handleVideoTimeupdate) {
    video.removeEventListener('timeupdate', handleVideoTimeupdate);
    handleVideoTimeupdate = null;

    const subtitleContainer = getSubtitleContainer();
    subtitleContainer.replaceChildren();
  }
}

async function fetchSubtitle(url: string): Promise<SubtitleData[]> {
  const response = await fetch(url);
  return parseVTT(await response.text());
}

function updateSubtitleText(video: HTMLVideoElement, hasStyleChanged = false) {
  const { currentTime } = video;
  const subtitleContainer = getSubtitleContainer();
  const subtitleCache = getSubtitleCache();

  if (hasStyleChanged) {
    const fragment = document.createDocumentFragment();

    for (const [key, config] of Object.entries(getSubtitleSettings())) {
      const { language, enabled } = config;
      const data = subtitleCache.get(language);

      if (data && enabled) {
        const subtitleElement = createSubtitleElement(language, config, key);

        setupSubtitle(subtitleElement, data, currentTime);
        setupSubtitleSaveHandler(subtitleElement);

        fragment.appendChild(subtitleElement);
      }
    }

    subtitleContainer.replaceChildren(fragment);
  } else {
    for (const [lang, subtitles] of subtitleCache) {
      const subtitleElement = subtitleContainer.querySelector(`#${lang}`) as HTMLElement | null;

      if (subtitleElement) {
        setupSubtitle(subtitleElement, subtitles, currentTime);
      } else {
        updateSubtitleText(video, true);
        break;
      }
    }
  }
}

function setupSubtitle(subtitleElement: HTMLElement, data: SubtitleData[], currentTime: number) {
  const { text, start } = findCurrentSubtitle(data, currentTime);

  subtitleElement.innerHTML = text;

  if (start) subtitleElement.dataset[REVIEW.DATA_ATTRIBUTE.START_TIME] = start.toString();
  else delete subtitleElement.dataset[REVIEW.DATA_ATTRIBUTE.START_TIME];
}
