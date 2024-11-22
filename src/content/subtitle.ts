import { SETTINGS, SUBTITLE_CONTAINER_ID, TRACK_DISPLAY_CONTAINER_CLASS_NAME } from '../utils/constants';
import { DEFAULT_CONFIG } from '../utils/default';
import { selectVideoElement } from '../utils/dom';
import { getStorage, StorageChanges } from '../utils/storage';
import {
  arrayToHeadersObject,
  createSubtitleContainer,
  createSubtitleElement,
  extractSubtitleApiInfoFromResponse,
  findCurrentSubtitle,
  parseVTT,
  SubtitleApiInfo,
  SubtitleData,
  SubtitleLanguage,
} from '../utils/subtitle';

const { SUBTITLES } = SETTINGS;
const { PRIMARY, SECONDARY } = SUBTITLES;

const subtitleCache = new Map<SubtitleLanguage, SubtitleData[]>();

const subtitleSettings = {
  [PRIMARY.STORAGE_KEY]: DEFAULT_CONFIG[PRIMARY.STORAGE_KEY],
  [SECONDARY.STORAGE_KEY]: DEFAULT_CONFIG[SECONDARY.STORAGE_KEY],
};

let subtitleApiInfoList: SubtitleApiInfo[] | null;
let subtitleContainerObserver: MutationObserver | null;
let handleVideoTimeupdate: ((arg?: Event | boolean) => void) | null;

export function onSubtitleStorageChange(changes: StorageChanges) {
  for (const { STORAGE_KEY } of Object.values(SUBTITLES)) {
    const subtitleChanges = changes[STORAGE_KEY];

    if (subtitleChanges && subtitleChanges.newValue) {
      subtitleSettings[STORAGE_KEY] = { ...subtitleSettings[STORAGE_KEY], ...subtitleChanges.newValue };

      if (subtitleChanges.newValue.enabled && subtitleApiInfoList) {
        fetchAndSyncSubtitles(subtitleApiInfoList);
      } else if (Object.values(subtitleSettings).every(({ enabled }) => !enabled)) {
        stopSubtitleSync();
      }

      if (handleVideoTimeupdate) handleVideoTimeupdate(true);
    }
  }
}

export async function initializeSubtitleSync() {
  for (const { STORAGE_KEY } of Object.values(SUBTITLES)) {
    const data = await getStorage(STORAGE_KEY);
    if (data) subtitleSettings[STORAGE_KEY] = { ...subtitleSettings[STORAGE_KEY], ...data };
  }
}

export async function fetchVideoMetadata(url: string, headerList: chrome.webRequest.HttpHeader[]) {
  const headers = {
    ...arrayToHeadersObject(headerList),
    'X-Extension-Request': 'true', // 무한 루프 방지용 커스텀 헤더
  };
  const response = await fetch(url, { headers });
  const apiInfoList = extractSubtitleApiInfoFromResponse(await response.json());
  if (apiInfoList.length === 0) return;

  subtitleApiInfoList = apiInfoList;
  subtitleCache.clear();
  handleVideoTimeupdate = null;

  if (subtitleContainerObserver) {
    subtitleContainerObserver.disconnect();
    subtitleContainerObserver = null;
  }

  if (Object.values(subtitleSettings).some(({ enabled }) => enabled)) {
    fetchAndSyncSubtitles(subtitleApiInfoList);
  }
}

async function fetchAndSyncSubtitles(subtitleApiInfoList: SubtitleApiInfo[]) {
  const video = await selectVideoElement();
  if (!video) return;

  for (const { lang, url } of subtitleApiInfoList) {
    const isEnabled = Object.values(subtitleSettings).some(({ language, enabled }) => enabled && language === lang);
    if (isEnabled && !subtitleCache.has(lang)) {
      subtitleCache.set(lang, await fetchSubtitle(url));
    }
  }

  if (handleVideoTimeupdate === null) setupSubtitleSync(video);
}

function stopSubtitleSync() {
  const video = document.querySelector('video');
  const subtitleContainer = document.getElementById(SUBTITLE_CONTAINER_ID);

  if (video && handleVideoTimeupdate) {
    video.removeEventListener('timeupdate', handleVideoTimeupdate);
    handleVideoTimeupdate = null;
  }
  if (subtitleContainerObserver) {
    subtitleContainerObserver.disconnect();
    subtitleContainerObserver = null;
  }
  if (subtitleContainer) {
    subtitleContainer.remove();
  }
}

async function fetchSubtitle(url: string): Promise<SubtitleData[]> {
  const response = await fetch(url);
  return parseVTT(await response.text());
}

function setupSubtitleSync(video: HTMLVideoElement) {
  const trackDisplayContainer = document.getElementsByClassName(TRACK_DISPLAY_CONTAINER_CLASS_NAME)[0];
  const subtitleContainer =
    document.getElementById(SUBTITLE_CONTAINER_ID) || createSubtitleContainer(SUBTITLE_CONTAINER_ID);

  appendSubtitleContainer(trackDisplayContainer, subtitleContainer);
  observeSubtitleContainer(trackDisplayContainer, subtitleContainer);
  updateSubtitleText(video, subtitleContainer);

  handleVideoTimeupdate = (arg) =>
    typeof arg === 'boolean'
      ? updateSubtitleText(video, subtitleContainer, arg)
      : updateSubtitleText(video, subtitleContainer);
  video.addEventListener('timeupdate', handleVideoTimeupdate);
}

function observeSubtitleContainer(trackDisplayContainer: Element, subtitleContainer: HTMLElement) {
  subtitleContainerObserver = new MutationObserver(() => {
    appendSubtitleContainer(trackDisplayContainer, subtitleContainer);
  });

  subtitleContainerObserver.observe(trackDisplayContainer, { attributes: true });
}

function appendSubtitleContainer(trackDisplayContainer: Element, subtitleContainer: HTMLElement) {
  const subtitleContainerWrapper = trackDisplayContainer.children[0];
  if (subtitleContainerWrapper && !subtitleContainerWrapper.contains(subtitleContainer)) {
    subtitleContainerWrapper.appendChild(subtitleContainer);
  }
}

function updateSubtitleText(video: HTMLVideoElement, subtitleContainer: HTMLElement, hasStyleChanged = false) {
  const { currentTime } = video;

  if (hasStyleChanged) {
    const fragment = document.createDocumentFragment();

    for (const [key, config] of Object.entries(subtitleSettings)) {
      const { language, enabled } = config;
      const data = subtitleCache.get(language);

      if (data && enabled) {
        const subtitle = findCurrentSubtitle(data, currentTime);
        const subtitleElement = createSubtitleElement(language, subtitle, config);

        if (key === PRIMARY.STORAGE_KEY) fragment.prepend(subtitleElement);
        else fragment.appendChild(subtitleElement);
      }
    }

    subtitleContainer.replaceChildren(fragment);
  } else {
    for (const [lang, subtitles] of subtitleCache) {
      const subtitle = findCurrentSubtitle(subtitles, currentTime);
      const subtitleElement = subtitleContainer.querySelector(`#${lang}`);

      if (subtitleElement) {
        subtitleElement.innerHTML = subtitle;
      } else {
        updateSubtitleText(video, subtitleContainer, true);
        break;
      }
    }
  }
}
