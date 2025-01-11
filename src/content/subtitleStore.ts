import { SETTINGS } from '../utils/constants';
import { DEFAULT_CONFIG } from '../utils/default';
import { SubtitleConfig } from '../utils/storage';
import { SubtitleApiInfo, SubtitleLanguage } from '../utils/subtitle';
import { SubtitleData } from '../utils/subtitle';

type SubtitleSettingKey = 'primarySubtitle' | 'secondarySubtitle';
type SubtitleStore = {
  subtitleCache: Map<SubtitleLanguage, SubtitleData[]>;
  subtitleSettings: Record<SubtitleSettingKey, SubtitleConfig>;
  subtitleApiInfoList: SubtitleApiInfo[] | null;
};

const { PRIMARY, SECONDARY } = SETTINGS.SUBTITLES;

const subtitleStore: SubtitleStore = {
  subtitleCache: new Map(),
  subtitleSettings: {
    [PRIMARY.STORAGE_KEY]: DEFAULT_CONFIG[PRIMARY.STORAGE_KEY],
    [SECONDARY.STORAGE_KEY]: DEFAULT_CONFIG[SECONDARY.STORAGE_KEY],
  },
  subtitleApiInfoList: null,
};

export function initializeSubtitleStore(subtitleApiInfoList: SubtitleApiInfo[] | null) {
  subtitleStore.subtitleCache.clear();
  subtitleStore.subtitleApiInfoList = subtitleApiInfoList;
}

export function getSubtitleCache() {
  return subtitleStore.subtitleCache;
}

export function getSubtitleSettings() {
  return subtitleStore.subtitleSettings;
}

export function setSubtitleSetting(key: SubtitleSettingKey, settings: SubtitleConfig) {
  subtitleStore.subtitleSettings[key] = { ...subtitleStore.subtitleSettings[key], ...settings };
}

export function getSubtitleApiInfoList() {
  return subtitleStore.subtitleApiInfoList;
}
