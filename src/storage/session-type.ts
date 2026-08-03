export type StorageChange<T> = { oldValue?: T; newValue?: T };

export type PendingViewAction = {
  url: string;
  startTime: number;
  videoId: string | null;
};

export type PendingSubtitleRequest = {
  url: string;
  headers: chrome.webRequest.HttpHeader[];
};

export type SessionStorageSchema = {
  activeTab: chrome.tabs.Tab;
  pendingViewActions: PendingViewAction[];
  pendingSubtitleRequests: Record<number, PendingSubtitleRequest>;
};

export type SessionStorageKey = keyof SessionStorageSchema;
export type SessionStorageChanges = {
  [K in SessionStorageKey]?: StorageChange<SessionStorageSchema[K]>;
};
