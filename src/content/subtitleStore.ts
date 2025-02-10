import { SETTINGS, SubtitleSettingStorageKey } from '../utils/constants';
import { DEFAULT_CONFIG } from '../storage/default';
import { SubtitleConfig } from '../storage/type';
import { SubtitleLanguage, SubtitleData } from '../utils/subtitle';

type SubtitleCacheKey = SubtitleLanguage;

type SubtitleStore = {
  subtitleCache: Map<SubtitleCacheKey, SubtitleData[]>;
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

export function getSubtitleCache(key: SubtitleCacheKey) {
  return subtitleStore.subtitleCache.get(key);
}

export function setSubtitleCache(key: SubtitleCacheKey, data: SubtitleData[]) {
  subtitleStore.subtitleCache.set(key, data);
}

export function deleteSubtitleCache(key: SubtitleCacheKey) {
  subtitleStore.subtitleCache.delete(key);
}

export function hasSubtitleCache(key: SubtitleCacheKey) {
  return subtitleStore.subtitleCache.has(key);
}

export function getPrimarySubtitleCache() {
  const { language } = getSubtitleSettings()[PRIMARY.STORAGE_KEY];
  return getSubtitleCache(language);
}

export function getSubtitleSettings() {
  return subtitleStore.subtitleSettings;
}

export function setSubtitleSetting(key: SubtitleSettingStorageKey, settings: SubtitleConfig) {
  subtitleStore.subtitleSettings[key] = { ...subtitleStore.subtitleSettings[key], ...settings };
}
