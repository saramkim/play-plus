import { DEFAULT_V2_SYNC_STORAGE } from '@storage/v2/default';
import { v2SyncStorageSchema } from '@storage/v2/schema';
import { V2SyncStorageApi } from '@storage/v2/sync-storage';
import { V2SyncStorage } from '@storage/v2/type';
import { create } from 'zustand';

interface LearningSettingsState extends V2SyncStorage {
  error: boolean;
  loading: boolean;
  initialize: () => Promise<{ remove: () => void }>;
  setLearningProfile: (value: V2SyncStorage['learningProfile']) => Promise<void>;
  setSubtitleDisplay: (value: V2SyncStorage['subtitleDisplay']) => Promise<void>;
  setLearningControls: (value: Pick<V2SyncStorage, 'learningControls' | 'playbackSpeed' | 'shortcuts'>) => Promise<void>;
}

export type LearningSettingsStore = ReturnType<typeof createLearningSettingsStore>;

export const createLearningSettingsStore = (storage: V2SyncStorageApi) =>
  create<LearningSettingsState>((set, get) => ({
    ...structuredClone(DEFAULT_V2_SYNC_STORAGE),
    error: false,
    loading: true,

    initialize: async () => {
      const values = await storage.getAll();
      set({ ...values, error: false, loading: false });

      return storage.subscribe(
        (changes) => {
          const next: Partial<LearningSettingsState> = {};
          for (const key of Object.keys(changes) as (keyof V2SyncStorage)[]) {
            const value = changes[key]?.newValue;
            if (value === undefined) {
              set({ error: true, loading: true });
              return;
            }
            Object.assign(next, { [key]: value });
          }
          set(next);
        },
        () => set({ error: true, loading: true })
      );
    },

    setLearningProfile: async (value) => {
      if (get().error) throw new Error('Learning settings are unavailable');
      await storage.set('learningProfile', value);
      set({ learningProfile: value });
    },

    setSubtitleDisplay: async (value) => {
      if (get().error) throw new Error('Learning settings are unavailable');
      await storage.set('subtitleDisplay', value);
      set({ subtitleDisplay: value });
    },

    setLearningControls: async (value) => {
      if (get().error) throw new Error('Learning settings are unavailable');
      const parsed = v2SyncStorageSchema.parse({
        learningProfile: get().learningProfile,
        subtitleDisplay: get().subtitleDisplay,
        ...value,
      });
      await storage.setMany({
        learningControls: parsed.learningControls,
        shortcuts: parsed.shortcuts,
        playbackSpeed: parsed.playbackSpeed,
      });
      set(value);
    },
  }));
