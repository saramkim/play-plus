import {
  ApiResponse,
  arrayToHeadersObject,
  extractSubtitleApiFromResponse,
  parseVTT,
  SubtitleData,
} from '../utils/subtitle';

export async function fetchAndSyncSubtitles(url: string, headerList: chrome.webRequest.HttpHeader[]) {
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
