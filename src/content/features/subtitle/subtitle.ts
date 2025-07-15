import { DEFAULT_CONFIG } from '@storage/default';
import { getStorage } from '@storage/index';
import { StorageChanges } from '@storage/type';
import { REVIEW, SETTINGS } from '@utils/constants';
import { sendMessage } from '@utils/message/index';
import { parseVTT, SubtitleData } from '@utils/parse';

import { elementStore } from '@/content/store/element-store';
import { subtitleStore } from '@/content/store/subtitle-store';
import { useVideoStore } from '@/content/store/video-store';
import {
  applySubtitleStyles,
  arrayToHeadersObject,
  extractSubtitleApiInfoFromResponse,
  findSubtitle,
} from '@/content/utils/subtitle';

const { SUBTITLES } = SETTINGS;

export async function onSubtitleStorageChange(changes: StorageChanges) {
  for (const { STORAGE_KEY } of Object.values(SUBTITLES)) {
    const change = changes[STORAGE_KEY];
    if (!change) continue;

    const newConfig = change.newValue || DEFAULT_CONFIG[STORAGE_KEY];
    subtitleStore.setSubtitleSetting(STORAGE_KEY, newConfig);

    const { currentTime } = useVideoStore.getState();
    syncSubtitles(currentTime, true);
  }
}

export async function initializeSubtitleSync() {
  for (const { STORAGE_KEY } of Object.values(SUBTITLES)) {
    const data = await getStorage(STORAGE_KEY);
    subtitleStore.setSubtitleSetting(STORAGE_KEY, data);
  }
  setupSubtitleSync();
}

export async function fetchSubtitles(url: string, headers: chrome.webRequest.HttpHeader[]) {
  const subtitleApiInfoList = await fetchVideoMetadata(url, headers);
  return Promise.all(
    subtitleApiInfoList.map(async ({ lang, url }) => ({ lang, subtitleData: await fetchSubtitle(url) }))
  );
}

export function syncSubtitles(currentTime: number, hasStyleChanged = false) {
  for (const [key, config] of Object.entries(subtitleStore.getSubtitleSettings())) {
    const { language, enabled, delay } = config;
    const customSubtitleId = subtitleStore.getCustomSubtitleId(key);
    const data = subtitleStore.getSubtitleCache(customSubtitleId ?? language);
    const subtitleElement = elementStore.getSubtitleElement(key);

    if (hasStyleChanged) applySubtitleStyles(subtitleElement, config);

    if (data && enabled) {
      setupSubtitle(subtitleElement, data, currentTime - delay);
    }
  }
}

function setupSubtitleSync() {
  useVideoStore.subscribe(({ currentTime }) => {
    syncSubtitles(currentTime);
    sendMessage('updateCurrentTime', currentTime);
  });
}

async function fetchVideoMetadata(url: string, headerList: chrome.webRequest.HttpHeader[]) {
  const headers = {
    ...arrayToHeadersObject(headerList),
    'X-Extension-Request': 'true', // 무한 루프 방지용 커스텀 헤더
  };
  const response = await fetch(url, { headers });
  return extractSubtitleApiInfoFromResponse(await response.json());
}

async function fetchSubtitle(url: string): Promise<SubtitleData[]> {
  const response = await fetch(url);
  return parseVTT(await response.text());
}

function setupSubtitle(subtitleElement: HTMLElement, data: SubtitleData[], currentTime: number) {
  const subtitle = findSubtitle(data, currentTime);

  if (subtitle) {
    const startTime = String(subtitle.start);
    if (subtitleElement.dataset[REVIEW.DATA_ATTRIBUTE.START_TIME] !== startTime) {
      subtitleElement.innerHTML = subtitle.text;
      subtitleElement.dataset[REVIEW.DATA_ATTRIBUTE.START_TIME] = startTime;
    }
  } else {
    subtitleElement.innerHTML = '';
    delete subtitleElement.dataset[REVIEW.DATA_ATTRIBUTE.START_TIME];
  }
}
