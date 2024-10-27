import { getStorage } from './storage';

let skipTime = 10;

async function initializeSkipTime() {
  const SKIP_TIME_KEY = 'skipTime';
  skipTime = await getStorage(SKIP_TIME_KEY);

  chrome.storage.sync.onChanged.addListener((data) => {
    if (data[SKIP_TIME_KEY]) {
      skipTime = data[SKIP_TIME_KEY].newValue;
    }
  });
}

function setupKeyListener() {
  const keyMap: { [key: string]: () => void } = {
    ArrowRight: () => skipVideo(true),
    ArrowLeft: () => skipVideo(false),
  };

  document.addEventListener('keydown', (event) => {
    const activeElementTag = document.activeElement?.tagName || '';
    if (['INPUT', 'TEXTAREA'].includes(activeElementTag)) return;

    const action = keyMap[event.key];
    if (action) {
      event.preventDefault();
      event.stopImmediatePropagation();
      action();
    }
  });
}

async function skipVideo(forward: boolean) {
  const video = document.querySelector('video');

  if (video) {
    const { currentTime, duration } = video;
    video.currentTime = forward ? Math.min(currentTime + skipTime, duration - 1) : Math.max(currentTime - skipTime, 0);
  }
}

(async function () {
  await initializeSkipTime();
  setupKeyListener();
})();
