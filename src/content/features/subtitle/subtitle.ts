import { createV2SyncStorage, V2SyncStorageChanges } from '@storage/v2/sync-storage';
import { V2SyncStorage } from '@storage/v2/type';
import { findSubtitle } from '@utils/helper';

import { elementStore } from '@/content/core/store/element-store';
import { useVideoStore } from '@/content/core/store/video-store';
import {
  selectSubtitleTrack,
  SUBTITLE_ROLES,
  useSubtitleStore,
} from '@/content/features/subtitle/subtitle-store';
import { applySubtitleStyles } from '@/content/features/subtitle/subtitle-utils';

type SubtitleSettings = Pick<V2SyncStorage, 'learningProfile' | 'subtitleDisplay'>;

export async function initializeSubtitleSync() {
  const storage = createV2SyncStorage(chrome.storage.sync);
  let isInitialized = false;
  let pendingSettings: Partial<SubtitleSettings> = {};

  const storageSubscription = storage.subscribe(
    (changes) => {
      const changedSettings = getChangedSettings(changes);
      if (!isInitialized) {
        pendingSettings = { ...pendingSettings, ...changedSettings };
        return;
      }

      applySettings(changedSettings);
    },
    () => {
      useSubtitleStore.getState().clearCaches();
      syncSubtitles(useVideoStore.getState().currentTime);
    }
  );

  try {
    const [learningProfile, subtitleDisplay] = await Promise.all([
      storage.get('learningProfile'),
      storage.get('subtitleDisplay'),
    ]);
    useSubtitleStore.getState().setSettings({ learningProfile, subtitleDisplay });
    applySettings(pendingSettings);
    isInitialized = true;
  } catch (error) {
    storageSubscription.remove();
    throw error;
  }

  const subtitleSubscription = useSubtitleStore.subscribe((state, previousState) => {
    const { currentTime } = useVideoStore.getState();
    syncSubtitles(currentTime, state.subtitleDisplay !== previousState.subtitleDisplay);
  });
  const videoSubscription = useVideoStore.subscribe(({ currentTime }) => {
    syncSubtitles(currentTime);
  });

  syncSubtitles(useVideoStore.getState().currentTime, true);

  return () => {
    storageSubscription.remove();
    subtitleSubscription();
    videoSubscription();
  };
}

export function syncSubtitles(currentTime: number, hasStyleChanged = false) {
  const state = useSubtitleStore.getState();

  for (const role of SUBTITLE_ROLES) {
    const subtitleElement = elementStore.getSubtitleElement(role);
    const display = state.subtitleDisplay[role];

    if (hasStyleChanged) applySubtitleStyles(subtitleElement, display);

    if (display.visibility === 'hidden') {
      subtitleElement.textContent = '';
      continue;
    }

    const { cues, delay } = selectSubtitleTrack(state, role);
    const cue = findSubtitle(cues, currentTime - delay);
    subtitleElement.textContent = cue?.text ?? '';
  }
}

const getChangedSettings = (changes: V2SyncStorageChanges): Partial<SubtitleSettings> => {
  if (changes.learningProfile && changes.learningProfile.newValue === undefined) {
    throw new Error('Canonical learning profile was removed');
  }
  if (changes.subtitleDisplay && changes.subtitleDisplay.newValue === undefined) {
    throw new Error('Canonical subtitle display was removed');
  }

  return {
    ...(changes.learningProfile?.newValue === undefined
      ? {}
      : { learningProfile: changes.learningProfile.newValue }),
    ...(changes.subtitleDisplay?.newValue === undefined
      ? {}
      : { subtitleDisplay: changes.subtitleDisplay.newValue }),
  };
};

const applySettings = (settings: Partial<SubtitleSettings>) => {
  if (settings.learningProfile === undefined && settings.subtitleDisplay === undefined) return;

  const state = useSubtitleStore.getState();
  state.setSettings({
    learningProfile: settings.learningProfile ?? state.learningProfile,
    subtitleDisplay: settings.subtitleDisplay ?? state.subtitleDisplay,
  });
};
