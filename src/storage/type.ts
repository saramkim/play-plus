import { z } from 'zod';

import { savedSubtitleSchema, storageSchema, subtitleMetadataSchema } from './schema';

// common type
export type StorageChange<T> = { oldValue?: T; newValue?: T };

export type SavedSubtitle = z.infer<typeof savedSubtitleSchema>;
export type SubtitleMetadata = z.infer<typeof subtitleMetadataSchema>;

// chrome.storage.sync
export type StorageSchema = {
  [K in keyof typeof storageSchema]: z.infer<(typeof storageSchema)[K]>;
};
export type StorageKey = keyof StorageSchema;
export type StorageChanges = {
  [K in StorageKey]?: StorageChange<StorageSchema[K]>;
};

// chrome.storage.local
export interface LocalStorageSchema {
  savedSubtitles: SavedSubtitle[];
  registeredSubtitles: SubtitleMetadata[];
}
export type LocalStorageKey = keyof LocalStorageSchema;
export type LocalStorageChanges = {
  [K in LocalStorageKey]?: StorageChange<LocalStorageSchema[K]>;
};

// chrome.storage.session
export type SessionStorageSchema = {
  activeTab: chrome.tabs.Tab;
};
export type SessionStorageKey = keyof SessionStorageSchema;
export type SessionStorageChanges = {
  [K in SessionStorageKey]?: StorageChange<SessionStorageSchema[K]>;
};
