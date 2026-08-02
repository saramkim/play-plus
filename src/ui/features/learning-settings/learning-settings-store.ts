import { DEFAULT_V2_SYNC_STORAGE } from '@storage/v2/default';
import { V2SyncStorageApi } from '@storage/v2/sync-storage';
import { V2SyncStorage } from '@storage/v2/type';
import { create } from 'zustand';

interface LearningSettingsState {
  learningProfile: V2SyncStorage['learningProfile'];
  loading: boolean;
  subtitleDisplay: V2SyncStorage['subtitleDisplay'];
  initialize: () => Promise<{ remove: () => void }>;
  setLearningProfile: (value: V2SyncStorage['learningProfile']) => Promise<void>;
  setSubtitleDisplay: (value: V2SyncStorage['subtitleDisplay']) => Promise<void>;
}

export const createLearningSettingsStore = (storage: V2SyncStorageApi) =>
  create<LearningSettingsState>((set) => ({
    learningProfile: structuredClone(DEFAULT_V2_SYNC_STORAGE.learningProfile),
    loading: true,
    subtitleDisplay: structuredClone(DEFAULT_V2_SYNC_STORAGE.subtitleDisplay),

    initialize: async () => {
      const [learningProfile, subtitleDisplay] = await Promise.all([
        storage.get('learningProfile'),
        storage.get('subtitleDisplay'),
      ]);
      set({ learningProfile, loading: false, subtitleDisplay });

      return storage.subscribe((changes) => {
        if (changes.learningProfile) {
          set({
            learningProfile:
              changes.learningProfile.newValue ?? structuredClone(DEFAULT_V2_SYNC_STORAGE.learningProfile),
          });
        }
        if (changes.subtitleDisplay) {
          set({
            subtitleDisplay:
              changes.subtitleDisplay.newValue ?? structuredClone(DEFAULT_V2_SYNC_STORAGE.subtitleDisplay),
          });
        }
      });
    },

    setLearningProfile: async (value) => {
      await storage.set('learningProfile', value);
      set({ learningProfile: value });
    },

    setSubtitleDisplay: async (value) => {
      await storage.set('subtitleDisplay', value);
      set({ subtitleDisplay: value });
    },
  }));
