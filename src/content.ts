import { getStorage } from './utils/storage';

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
