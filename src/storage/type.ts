import { Language } from '@utils/constants';

import { SubtitleId } from './subtitle';

export type SkipTimeUnit = 'seconds' | 'minutes' | 'subtitles';
export type VideoSkipConfig = {
  enabled: boolean;
  forward: string;
  backward: string;
  skipTime: number;
  skipTimeUnit: SkipTimeUnit;
  fallbackTime: number;
  fallbackUnit: Exclude<SkipTimeUnit, 'subtitles'>;
};
export type SubtitleLanguage = 'en' | 'ko';
export type SubtitleConfig = {
  enabled: boolean;
  language: SubtitleLanguage;
  positionReference: 'top' | 'center' | 'bottom';
  positionOffset: number;
  color: string;
  fontSize: number;
  fontWeight: number;
  opacity: number;
  lineBreak: boolean;
  delay: number;
};
export type ShortcutsConfig = {
  enabled: boolean;
  savePrimary: string;
  saveSecondary: string;
  togglePrimary: string;
  toggleSecondary: string;
};
export type LoopConfig = {
  enabled: boolean;
  toggleLoop: string;
  startPoint: string;
  endPoint: string;
  loopCurrentSubtitle: string;
};

export type StorageSchema = {
  videoSkip: VideoSkipConfig;
  subVideoSkip: VideoSkipConfig;
  primarySubtitle: SubtitleConfig;
  secondarySubtitle: SubtitleConfig;
  shortcuts: ShortcutsConfig;
  loop: LoopConfig;
};
export type StorageKey = keyof StorageSchema;

export type StorageChange<T> = {
  oldValue?: T;
  newValue?: T;
};

export type StorageChanges = {
  [K in StorageKey]?: StorageChange<StorageSchema[K]>;
};

export type SavedSubtitle = {
  content: string;
  url: string;
  startTime: number;
  savedAt: string;
};

export type SubtitleMetadata = {
  id: SubtitleId;
  title: string;
  language: Language;
  savedAt: string;
};

export type LocalStorageSchema = {
  savedSubtitles: SavedSubtitle[];
  registeredSubtitles: SubtitleMetadata[];
};
export type LocalStorageKey = keyof LocalStorageSchema;

export type LocalStorageChanges = {
  [K in LocalStorageKey]?: StorageChange<LocalStorageSchema[K]>;
};

export type SessionStorageSchema = {
  activeTab: chrome.tabs.Tab;
};
export type SessionStorageKey = keyof SessionStorageSchema;

export type SessionStorageChanges = {
  [K in SessionStorageKey]?: StorageChange<SessionStorageSchema[K]>;
};
