import { getStorage } from '../utils/storage';
import {
  arrayToHeadersObject,
  extractSubtitleApiInfoFromResponse,
  parseVTT,
  SubtitleApiInfo,
  SubtitleData,
} from '../utils/subtitle';

const IS_SUBTITLE_ON_STORAGE_KEY = 'isSubtitleOn';
const TRACK_DISPLAY_CONTAINER_CLASS_NAME = 'vjs-text-track-display';
const SUBTITLE_CONTAINER_ID = 'pp-subtitle-container';

let subtitleApiInfoList: SubtitleApiInfo[] | null;
let subtitleContainerObserver: MutationObserver | null;
let handleVideoTimeupdate: (() => void) | null;

export async function initializeSubtitleSync() {
  chrome.storage.sync.onChanged.addListener(handleStorageChange);
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

  const isSubtitleOn = (await getStorage(IS_SUBTITLE_ON_STORAGE_KEY)) || false;
  if (isSubtitleOn) fetchAndSyncSubtitles(subtitleApiInfoList);
}

function handleStorageChange(changes: { [key: string]: chrome.storage.StorageChange }) {
  const isSubtitleOnChange = changes[IS_SUBTITLE_ON_STORAGE_KEY];
  if (isSubtitleOnChange && subtitleApiInfoList) {
    isSubtitleOnChange.newValue ? fetchAndSyncSubtitles(subtitleApiInfoList) : stopSubtitleSync();
  }
}

async function fetchAndSyncSubtitles(apiInfoList: SubtitleApiInfo[]) {
  const video = await selectVideoElement();
  if (!video) return;

  const subtitleDataList = await Promise.all(
    apiInfoList.map(async ({ lang, url }) => ({ lang, subtitles: await fetchSubtitle(url) }))
  );
  setupSubtitleSync(video, subtitleDataList);
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

function setupSubtitleSync(video: HTMLVideoElement, subtitleDataList: { lang: string; subtitles: SubtitleData[] }[]) {
  const trackDisplayContainer = document.getElementsByClassName(TRACK_DISPLAY_CONTAINER_CLASS_NAME)[0];
  const subtitleContainer = createSubtitleContainer();

  appendSubtitleContainer(trackDisplayContainer, subtitleContainer);
  observeSubtitleContainer(trackDisplayContainer, subtitleContainer);

  handleVideoTimeupdate = () => updateSubtitleText(video, subtitleContainer, subtitleDataList);
  video.addEventListener('timeupdate', handleVideoTimeupdate);
}

function observeSubtitleContainer(trackDisplayContainer: Element, subtitleContainer: HTMLDivElement) {
  subtitleContainerObserver = new MutationObserver(() => {
    appendSubtitleContainer(trackDisplayContainer, subtitleContainer);
  });

  subtitleContainerObserver.observe(trackDisplayContainer, { attributes: true });
}

function appendSubtitleContainer(trackDisplayContainer: Element, subtitleContainer: HTMLDivElement) {
  const subtitleContainerWrapper = trackDisplayContainer.children[0];
  if (subtitleContainerWrapper && !subtitleContainerWrapper.contains(subtitleContainer)) {
    subtitleContainerWrapper.appendChild(subtitleContainer);
  }
}

function updateSubtitleText(
  video: HTMLVideoElement,
  subtitleContainer: HTMLDivElement,
  subtitleDataList: { lang: string; subtitles: SubtitleData[] }[]
) {
  const { currentTime } = video;
  const subtitleText = subtitleDataList
    .sort(({ lang: langA }, { lang: langB }) => (langA === 'en' ? -1 : langB === 'en' ? 1 : 0))
    .map(({ subtitles }) => {
      const subtitle = subtitles.find(({ start, end }) => currentTime >= start && currentTime <= end);
      return subtitle ? `<p style="color: white;">${subtitle.text}</p>` : '';
    })
    .join('');

  subtitleContainer.innerHTML = subtitleText;
}

function createSubtitleContainer(): HTMLDivElement {
  const subtitleContainer = document.createElement('div');
  subtitleContainer.id = SUBTITLE_CONTAINER_ID;
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
