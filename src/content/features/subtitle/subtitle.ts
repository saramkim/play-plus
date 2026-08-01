import { DEFAULT_CONFIG } from '@storage/default';
import { getStorage } from '@storage/index';
import { StorageChanges } from '@storage/type';
import { REVIEW, SETTINGS } from '@utils/constants';
import { findSubtitle } from '@utils/helper';
import { sendMessage } from '@utils/message/index';
import { SubtitleData } from '@utils/parse';

import { elementStore } from '@/content/core/store/element-store';
import { useVideoStore } from '@/content/core/store/video-store';
import { useSubtitleStore } from '@/content/features/subtitle/subtitle-store';
import { applySubtitleStyles } from '@/content/features/subtitle/subtitle-utils';

const { SUBTITLES } = SETTINGS;

export async function onSubtitleStorageChange(changes: StorageChanges) {
  for (const { STORAGE_KEY } of Object.values(SUBTITLES)) {
    const change = changes[STORAGE_KEY];
    if (!change) continue;

    const newConfig = change.newValue || DEFAULT_CONFIG[STORAGE_KEY];
    useSubtitleStore.getState().setSubtitleSetting(STORAGE_KEY, newConfig);

    const { currentTime } = useVideoStore.getState();
    syncSubtitles(currentTime, true);
  }
}

export async function initializeSubtitleSync() {
  for (const { STORAGE_KEY } of Object.values(SUBTITLES)) {
    const data = await getStorage(STORAGE_KEY);
    useSubtitleStore.getState().setSubtitleSetting(STORAGE_KEY, data);
  }
  return setupSubtitleSync();
}

export function syncSubtitles(currentTime: number, hasStyleChanged = false) {
  const { subtitleSettings, customSubtitleId, subtitleCache } = useSubtitleStore.getState();
  for (const [key, config] of Object.entries(subtitleSettings)) {
    const { language, enabled } = config;
    const data = subtitleCache[customSubtitleId[key] ?? language];
    const subtitleElement = elementStore.getSubtitleElement(key);

    if (hasStyleChanged) applySubtitleStyles(subtitleElement, config);

    if (data && enabled) {
      setupSubtitle(subtitleElement, data, currentTime);
    }
  }
}

function setupSubtitleSync() {
  const { currentTime } = useVideoStore.getState();
  syncSubtitles(currentTime, true);

  return useVideoStore.subscribe(({ currentTime }) => {
    syncSubtitles(currentTime);
    sendMessage('updateCurrentTime', currentTime);
  });
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
