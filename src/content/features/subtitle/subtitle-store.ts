import { DEFAULT_CONFIG } from '@storage/default';
import { SubtitleId } from '@storage/subtitle';
import { StorageSchema } from '@storage/type';
import { SETTINGS, SubtitleSettingStorageKey } from '@utils/constants';
import { SubtitleData } from '@utils/parse';
import { create } from 'zustand';

export type SubtitleConfig = StorageSchema['primarySubtitle'];
export type SubtitleCacheKey = SubtitleConfig['language'] | SubtitleId;

const { PRIMARY, SECONDARY } = SETTINGS.SUBTITLES;

export interface SubtitleStoreState {
  subtitleCache: Partial<Record<SubtitleCacheKey, SubtitleData[]>>;
  subtitleSettings: Record<SubtitleSettingStorageKey, SubtitleConfig>;
  customSubtitleId: Record<SubtitleSettingStorageKey, SubtitleId | null>;

  setSubtitleCache: (key: SubtitleCacheKey, data: SubtitleData[]) => void;
  deleteSubtitleCache: (key: SubtitleCacheKey) => void;
  hasSubtitleCache: (key: SubtitleCacheKey) => boolean;

  getPrimarySubtitleAndDelay: () => { subtitles: SubtitleData[] | undefined; delay: number };

  setSubtitleSetting: (key: SubtitleSettingStorageKey, settings: SubtitleConfig) => void;

  setCustomSubtitleId: (key: SubtitleSettingStorageKey, id: SubtitleId | null) => void;
}

const initialState = {
  subtitleCache: {},
  subtitleSettings: {
    [PRIMARY.STORAGE_KEY]: DEFAULT_CONFIG[PRIMARY.STORAGE_KEY],
    [SECONDARY.STORAGE_KEY]: DEFAULT_CONFIG[SECONDARY.STORAGE_KEY],
  },
  customSubtitleId: {
    [PRIMARY.STORAGE_KEY]: null,
    [SECONDARY.STORAGE_KEY]: null,
  },
};

export const useSubtitleStore = create<SubtitleStoreState>((set, get) => ({
  ...initialState,

  setSubtitleCache: (key, data) =>
    set((state) => ({
      subtitleCache: { ...state.subtitleCache, [key]: data },
    })),
  deleteSubtitleCache: (key) =>
    set((state) => {
      const { [key]: _, ...rest } = state.subtitleCache;
      return { subtitleCache: rest };
    }),
  hasSubtitleCache: (key) => Object.prototype.hasOwnProperty.call(get().subtitleCache, key),

  getPrimarySubtitleAndDelay: () => {
    const state = get();
    const id = state.customSubtitleId[PRIMARY.STORAGE_KEY];
    const { language, delay } = state.subtitleSettings[PRIMARY.STORAGE_KEY];
    const subtitles = state.subtitleCache[id ?? language];
    return { subtitles, delay };
  },

  setSubtitleSetting: (key, settings) =>
    set((state) => ({
      subtitleSettings: {
        ...state.subtitleSettings,
        [key]: { ...state.subtitleSettings[key], ...settings },
      },
    })),

  setCustomSubtitleId: (key, id) =>
    set((state) => ({
      customSubtitleId: { ...state.customSubtitleId, [key]: id },
    })),
}));
