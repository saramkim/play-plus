import { SETTINGS, SubtitleSettingStorageKey } from '../utils/constants';
import { DEFAULT_CONFIG } from '../storage/default';
import { SubtitleConfig } from '../storage/type';
import { SubtitleLanguage } from '../utils/subtitle';
import { SubtitleData } from '../utils/subtitle';

type SubtitleStore = {
  subtitleCache: Map<SubtitleLanguage, SubtitleData[]>;
  subtitleSettings: Record<SubtitleSettingStorageKey, SubtitleConfig>;
};

const { PRIMARY, SECONDARY } = SETTINGS.SUBTITLES;

const subtitleStore: SubtitleStore = {
  subtitleCache: new Map(),
  subtitleSettings: {
    [PRIMARY.STORAGE_KEY]: DEFAULT_CONFIG[PRIMARY.STORAGE_KEY],
    [SECONDARY.STORAGE_KEY]: DEFAULT_CONFIG[SECONDARY.STORAGE_KEY],
  },
};

export function getSubtitleCache() {
  return subtitleStore.subtitleCache;
}

export function getSubtitleSettings() {
  return subtitleStore.subtitleSettings;
}

export function setSubtitleSetting(key: SubtitleSettingStorageKey, settings: SubtitleConfig) {
  subtitleStore.subtitleSettings[key] = { ...subtitleStore.subtitleSettings[key], ...settings };
}
