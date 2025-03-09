import { DEFAULT_CONFIG } from '@storage/default';
import { SubtitleId } from '@storage/subtitle';
import { SubtitleConfig, SubtitleLanguage } from '@storage/type';
import { SETTINGS, SubtitleSettingStorageKey } from '@utils/constants';
import { SubtitleData } from '@utils/parse';

type SubtitleCacheKey = SubtitleLanguage | SubtitleId;

type SubtitleStore = {
  subtitleCache: Map<SubtitleCacheKey, SubtitleData[]>;
  subtitleSettings: Record<SubtitleSettingStorageKey, SubtitleConfig>;
  customSubtitleId: Record<SubtitleSettingStorageKey, SubtitleId | null>;
};

const { PRIMARY, SECONDARY } = SETTINGS.SUBTITLES;

const subtitleStore: SubtitleStore = {
  subtitleCache: new Map(),
  subtitleSettings: {
    [PRIMARY.STORAGE_KEY]: DEFAULT_CONFIG[PRIMARY.STORAGE_KEY],
    [SECONDARY.STORAGE_KEY]: DEFAULT_CONFIG[SECONDARY.STORAGE_KEY],
  },
  customSubtitleId: {
    [PRIMARY.STORAGE_KEY]: null,
    [SECONDARY.STORAGE_KEY]: null,
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

export function getPrimarySubtitleAndDelay() {
  const id = getCustomSubtitleId(PRIMARY.STORAGE_KEY);
  const { language, delay } = getSubtitleSettings()[PRIMARY.STORAGE_KEY];
  return { subtitles: getSubtitleCache(id ?? language), delay };
}

export function getSubtitleSettings() {
  return subtitleStore.subtitleSettings;
}

export function setSubtitleSetting(key: SubtitleSettingStorageKey, settings: SubtitleConfig) {
  subtitleStore.subtitleSettings[key] = { ...subtitleStore.subtitleSettings[key], ...settings };
}

export function getCustomSubtitleId(key: SubtitleSettingStorageKey) {
  return subtitleStore.customSubtitleId[key];
}

export function setCustomSubtitleId(key: SubtitleSettingStorageKey, id: SubtitleId | null) {
  subtitleStore.customSubtitleId[key] = id;
}
