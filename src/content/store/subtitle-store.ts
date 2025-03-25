import { DEFAULT_CONFIG } from '@storage/default';
import { SubtitleId } from '@storage/subtitle';
import { SubtitleConfig, SubtitleLanguage } from '@storage/type';
import { SETTINGS, SubtitleSettingStorageKey } from '@utils/constants';
import { SubtitleData } from '@utils/parse';

type SubtitleCacheKey = SubtitleLanguage | SubtitleId;

const { PRIMARY, SECONDARY } = SETTINGS.SUBTITLES;

class SubtitleStore {
  private subtitleCache = new Map<SubtitleCacheKey, SubtitleData[]>();
  private subtitleSettings: Record<SubtitleSettingStorageKey, SubtitleConfig> = {
    [PRIMARY.STORAGE_KEY]: DEFAULT_CONFIG[PRIMARY.STORAGE_KEY],
    [SECONDARY.STORAGE_KEY]: DEFAULT_CONFIG[SECONDARY.STORAGE_KEY],
  };
  private customSubtitleId: Record<SubtitleSettingStorageKey, SubtitleId | null> = {
    [PRIMARY.STORAGE_KEY]: null,
    [SECONDARY.STORAGE_KEY]: null,
  };

  getSubtitleCache(key: SubtitleCacheKey) {
    return this.subtitleCache.get(key);
  }

  setSubtitleCache(key: SubtitleCacheKey, data: SubtitleData[]) {
    this.subtitleCache.set(key, data);
  }

  deleteSubtitleCache(key: SubtitleCacheKey) {
    this.subtitleCache.delete(key);
  }

  hasSubtitleCache(key: SubtitleCacheKey) {
    return this.subtitleCache.has(key);
  }

  getPrimarySubtitleAndDelay() {
    const id = this.getCustomSubtitleId(PRIMARY.STORAGE_KEY);
    const { language, delay } = this.getSubtitleSettings()[PRIMARY.STORAGE_KEY];
    return { subtitles: this.getSubtitleCache(id ?? language), delay };
  }

  getSubtitleSettings() {
    return this.subtitleSettings;
  }

  setSubtitleSetting(key: SubtitleSettingStorageKey, settings: SubtitleConfig) {
    this.subtitleSettings[key] = { ...this.subtitleSettings[key], ...settings };
  }

  getCustomSubtitleId(key: SubtitleSettingStorageKey) {
    return this.customSubtitleId[key];
  }

  setCustomSubtitleId(key: SubtitleSettingStorageKey, id: SubtitleId | null) {
    this.customSubtitleId[key] = id;
  }
}

export const subtitleStore = new SubtitleStore();
