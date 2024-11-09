import { LANGUAGE_CODE, SUBTITLE_CONTAINER_ID, TRACK_DISPLAY_CONTAINER_CLASS_NAME } from '../utils/constants';
import { getStorage, SubtitleConfig } from '../utils/storage';
import {
  arrayToHeadersObject,
  extractSubtitleApiInfoFromResponse,
  parseVTT,
  SubtitleApiInfo,
  SubtitleData,
  SubtitleLanguage,
} from '../utils/subtitle';

const subtitleCache = new Map<SubtitleLanguage, SubtitleData[]>();

let englishSubtitle: SubtitleConfig | null;
let koreanSubtitle: SubtitleConfig | null;
let subtitleApiInfoList: SubtitleApiInfo[] | null;
let subtitleContainerObserver: MutationObserver | null;
let handleVideoTimeupdate: (() => void) | null;

export async function initializeSubtitleSync() {
  chrome.storage.sync.onChanged.addListener(handleStorageChange);
  englishSubtitle = (await getStorage('englishSubtitle')) || null;
  koreanSubtitle = (await getStorage('koreanSubtitle')) || null;
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

  if (englishSubtitle?.enabled || koreanSubtitle?.enabled) {
    fetchAndSyncSubtitles(subtitleApiInfoList);
  }
}

async function handleStorageChange(changes: { [key: string]: chrome.storage.StorageChange }) {
  const subtitles = [
    { key: 'englishSubtitle', langCode: LANGUAGE_CODE.ENGLISH, setter: (value: any) => (englishSubtitle = value) },
    { key: 'koreanSubtitle', langCode: LANGUAGE_CODE.KOREAN, setter: (value: any) => (koreanSubtitle = value) },
  ] as const;

  for (const { key, langCode, setter } of subtitles) {
    if (changes[key]) {
      const { newValue } = changes[key];
      setter(newValue);

      if (newValue.enabled && subtitleApiInfoList) {
        await fetchAndSyncSubtitles(subtitleApiInfoList);
        showSubtitle(langCode);
      } else if (!isSubtitleEnabled()) {
        stopSubtitleSync();
      } else {
        hideSubtitle(langCode);
      }
    }
  }
}

function showSubtitle(lang: SubtitleLanguage) {
  const subtitleElement = selectSubtitleElement(lang);
  if (subtitleElement) subtitleElement.style.display = 'block';
}

function hideSubtitle(lang: SubtitleLanguage) {
  const subtitleElement = selectSubtitleElement(lang);
  if (subtitleElement) subtitleElement.style.display = 'none';
}

function selectSubtitleElement(lang: SubtitleLanguage) {
  const subtitleContainer = document.getElementById(SUBTITLE_CONTAINER_ID);
  return subtitleContainer?.querySelector(`#${lang}`) as HTMLPreElement | null;
}

async function fetchAndSyncSubtitles(subtitleApiInfoList: SubtitleApiInfo[]) {
  const video = await selectVideoElement();
  if (!video) return;

  for (const { lang, url } of subtitleApiInfoList) {
    if (isSubtitleEnabled(lang) && !subtitleCache.has(lang)) {
      subtitleCache.set(lang, await fetchSubtitle(url));
    }
  }

  if (handleVideoTimeupdate === null) setupSubtitleSync(video);
}

function isSubtitleEnabled(lang?: SubtitleLanguage) {
  if (lang) return { en: englishSubtitle?.enabled, ko: koreanSubtitle?.enabled }[lang];
  return englishSubtitle?.enabled || koreanSubtitle?.enabled;
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

function selectVideoElement(): Promise<HTMLVideoElement | null> {
  return new Promise((resolve) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        const video = document.querySelector('video');
        resolve(video);
      });
    } else {
      const video = document.querySelector('video');
      resolve(video);
    }
  });
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

  handleVideoTimeupdate = () => updateSubtitleText(video, subtitleContainer);
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

function updateSubtitleText(video: HTMLVideoElement, subtitleContainer: HTMLElement) {
  const { currentTime } = video;
  const subtitleText = Array.from(subtitleCache.entries())
    .sort(([langA], [langB]) => (langA === LANGUAGE_CODE.ENGLISH ? -1 : langB === LANGUAGE_CODE.ENGLISH ? 1 : 0))
    .map(([lang, subtitles]) => {
      const subtitle = subtitles.find(({ start, end }) => currentTime >= start && currentTime <= end);
      return subtitle
        ? `<p id="${lang}" style="color: white; display: ${isSubtitleEnabled(lang) ? 'block' : 'none'}">${
            subtitle.text
          }</p>`
        : '';
    })
    .join('');

  subtitleContainer.innerHTML = subtitleText;
}

function createSubtitleContainer(id: string) {
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
    lineHeight: 'min(3vw, 5vh)',
    color: 'white',
    textShadow: 'black 2px 2px 2px',
  });
  return subtitleContainer;
}

const applyStyles = (element: HTMLElement, styles: Partial<CSSStyleDeclaration>) => {
  Object.assign(element.style, styles);
};
