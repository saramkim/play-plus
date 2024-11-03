import { arrayToHeadersObject, extractSubtitleApiFromResponse, parseVTT, SubtitleData } from '../utils/subtitle';

export async function fetchAndSyncSubtitles(url: string, headerList: chrome.webRequest.HttpHeader[]) {
  const video = await selectVideoElement();
  const headers = {
    ...arrayToHeadersObject(headerList),
    'X-Extension-Request': 'true', // 무한 루프 방지용 커스텀 헤더
  };
  const response = await fetch(url, { headers });
  const apiList = extractSubtitleApiFromResponse(await response.json());
  if (apiList.length === 0) return;

  const subtitleDataList = await Promise.all(
    apiList.map(async ({ lang, url }) => ({ lang, subtitles: await fetchSubtitle(url) }))
  );
  syncSubtitles(video, subtitleDataList);
}

function selectVideoElement(): Promise<HTMLVideoElement> {
  return new Promise((resolve) => {
    const video = document.querySelector('video');
    if (video) return resolve(video);

    const observer = new MutationObserver(() => {
      const video = document.querySelector('video');
      if (video) {
        observer.disconnect();
        resolve(video);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  });
}

async function fetchSubtitle(url: string): Promise<SubtitleData[]> {
  const response = await fetch(url);
  return parseVTT(await response.text());
}

function syncSubtitles(video: HTMLVideoElement, subtitleDataList: { lang: string; subtitles: SubtitleData[] }[]) {
  const trackDisplayContainer = document.getElementsByClassName('vjs-text-track-display')[0];
  const subtitleContainer = createSubtitleContainer();

  observeSubtitleContainer(trackDisplayContainer, subtitleContainer);
  video.addEventListener('timeupdate', () => updateSubtitleText(video, subtitleContainer, subtitleDataList));
}

function observeSubtitleContainer(trackDisplayContainer: Element, subtitleContainer: HTMLDivElement) {
  const observer = new MutationObserver(() => {
    const subTitleContainerWrapper = trackDisplayContainer.children[0];
    if (subTitleContainerWrapper && !subTitleContainerWrapper.contains(subtitleContainer)) {
      subTitleContainerWrapper.appendChild(subtitleContainer);
    }
  });

  observer.observe(trackDisplayContainer, { attributes: true });
}

function updateSubtitleText(
  video: HTMLVideoElement,
  subtitleContainer: HTMLDivElement,
  subtitleDataList: { lang: string; subtitles: SubtitleData[] }[]
) {
  const currentTime = video.currentTime;
  const subtitleText = subtitleDataList
    .sort((a, b) => (a.lang === 'en' ? -1 : b.lang === 'en' ? 1 : 0))
    .map(({ subtitles }) => {
      const subtitle = subtitles.find(({ start, end }) => currentTime >= start && currentTime <= end);
      return subtitle ? `<p style="color: white;">${subtitle.text}</p>` : '';
    })
    .join('');

  subtitleContainer.innerHTML = subtitleText;
}

function createSubtitleContainer(): HTMLDivElement {
  const subtitleContainer = document.createElement('div');
  const style: Partial<CSSStyleDeclaration> = {
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
  };

  Object.assign(subtitleContainer.style, style);

  return subtitleContainer;
}
