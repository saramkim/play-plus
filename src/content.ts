import { getStorage } from './utils/storage';
import {
  ApiResponse,
  arrayToHeadersObject,
  extractSubtitleApiFromResponse,
  parseVTT,
  SubtitleData,
} from './utils/subtitle';

chrome.runtime.onMessage.addListener((message) => {
  if (message) {
    if (message.url && message.headers) {
      fetchAndSyncSubtitles(message.url, message.headers);
    }
  }
});

async function fetchAndSyncSubtitles(url: string, headerList: chrome.webRequest.HttpHeader[]) {
  const video = await getVideoElement();
  const headers = {
    ...arrayToHeadersObject(headerList),
    'X-Extension-Request': 'true', // 무한 루프 방지용 커스텀 헤더
  };

  fetch(url, { headers: headers })
    .then((response) => response.json())
    .then((response: ApiResponse) => {
      const apiList = extractSubtitleApiFromResponse(response);
      const fetchList = apiList.map(({ url }) => fetchSubtitle(url));

      Promise.all(fetchList).then(([englishSubtitles, koreanSubtitles]) => {
        syncSubtitles(video, englishSubtitles, koreanSubtitles);
      });
    });
}

function getVideoElement(): Promise<HTMLVideoElement> {
  return new Promise((resolve) => {
    const video = document.querySelector('video');
    if (video) {
      resolve(video);
    } else {
      const observer = new MutationObserver(() => {
        const video = document.querySelector('video');
        if (video) {
          observer.disconnect();
          resolve(video);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    }
  });
}

async function fetchSubtitle(url: string) {
  const response = await fetch(url);
  const text = await response.text();
  return parseVTT(text);
}

function syncSubtitles(video: HTMLVideoElement, englishSubtitles: SubtitleData[], koreanSubtitles: SubtitleData[]) {
  const trackDisplayContainer = document.getElementsByClassName('vjs-text-track-display');
  const subtitleContainer = document.createElement('div');

  const setSubtitleContainerStyles = () => {
    subtitleContainer.style.width = '100%';
    subtitleContainer.style.whiteSpace = 'pre-line';
    subtitleContainer.style.position = 'absolute';
    subtitleContainer.style.bottom = '2vh';
    subtitleContainer.style.textAlign = 'center';
    subtitleContainer.style.display = 'flex';
    subtitleContainer.style.flexDirection = 'column';
    subtitleContainer.style.gap = 'min(1.8vw, 3vh)';
    subtitleContainer.style.fontSize = 'min(1.8vw, 3vh)';
    subtitleContainer.style.lineHeight = 'min(3vw, 5vh)';
    subtitleContainer.style.color = 'white';
    subtitleContainer.style.textShadow = 'black 2px 2px 2px';
  };

  setSubtitleContainerStyles();

  const observer = new MutationObserver(() => {
    const subTitleContainerWrapper = trackDisplayContainer[0].children[0];
    if (subTitleContainerWrapper && !subTitleContainerWrapper.contains(subtitleContainer)) {
      subTitleContainerWrapper.appendChild(subtitleContainer);
    }
  });

  if (trackDisplayContainer[0]) {
    observer.observe(trackDisplayContainer[0], { attributes: true });
  }

  video.addEventListener('timeupdate', () => {
    const currentTime = video.currentTime;
    const englishSubtitle = englishSubtitles.find(({ start, end }) => currentTime >= start && currentTime <= end);
    const koreanSubtitle = koreanSubtitles.find(({ start, end }) => currentTime >= start && currentTime <= end);

    subtitleContainer.innerHTML = `
    <p style="color: white;">${englishSubtitle ? englishSubtitle.text : ''}</p>
    <p style="color: white;">${koreanSubtitle ? koreanSubtitle.text : ''}</p>
      `;
  });
}

let mainSkipTime = 10;
let subSkipTime = 10;
const SKIP_TIME_STORAGE_KEY = 'skipTime';
const SUB_KEY_STORAGE_KEY = 'subKey';

async function initializeSkipTimeSetting() {
  mainSkipTime = (await getStorage(SKIP_TIME_STORAGE_KEY)) || 10;

  chrome.storage.sync.onChanged.addListener((changes) => {
    if (changes[SKIP_TIME_STORAGE_KEY]) {
      mainSkipTime = changes[SKIP_TIME_STORAGE_KEY].newValue;
    }
    if (changes[SUB_KEY_STORAGE_KEY]) {
      subSkipTime = changes[SUB_KEY_STORAGE_KEY].newValue.skipTime;
    }
  });
}

async function initializeKeyBindings() {
  const keyBindings: { [key: string]: () => void } = {
    ArrowRight: () => skipVideoTime(mainSkipTime),
    ArrowLeft: () => skipVideoTime(-mainSkipTime),
  };
  const subKeyConfig = await getStorage(SUB_KEY_STORAGE_KEY);

  if (subKeyConfig) {
    const { forward, backward, skipTime } = subKeyConfig;
    subSkipTime = skipTime;
    keyBindings[forward] = () => skipVideoTime(subSkipTime);
    keyBindings[backward] = () => skipVideoTime(-subSkipTime);
  }

  document.addEventListener('keydown', handleKeydown(keyBindings));
}

function handleKeydown(keyBindings: { [key: string]: () => void }) {
  return (event: KeyboardEvent) => {
    const activeElementTag = document.activeElement?.tagName || '';
    if (['INPUT', 'TEXTAREA'].includes(activeElementTag)) return;

    const action = keyBindings[event.code];
    if (action) {
      event.preventDefault();
      event.stopImmediatePropagation();
      action();
    }
  };
}

function skipVideoTime(seconds: number) {
  const video = document.querySelector('video');
  if (video) {
    video.currentTime = Math.min(Math.max(video.currentTime + seconds, 0), video.duration - 1);
  }
}

(async function () {
  await initializeSkipTimeSetting();
  await initializeKeyBindings();
})();
