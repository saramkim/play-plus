import {
  LoopConfig,
  VideoSkipConfig,
  SubtitleConfig,
  ShortcutsConfig,
  SavedSubtitle,
  SubtitleMetadata,
} from './schema';

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
