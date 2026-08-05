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

export type SubtitleReplayRequest = PendingSubtitleRequest & {
  capturedAt: number | null;
  contentInstanceId: string | null;
  documentId: string | null;
  requestId: string;
  videoId: string | null;
};

export type SessionStorageSchema = {
  activeTab: chrome.tabs.Tab;
  pendingViewActions: PendingViewAction[];
  pendingSubtitleRequests: Record<number, SubtitleReplayRequest>;
};

export type SessionStorageKey = keyof SessionStorageSchema;
export type SessionStorageChanges = {
  [K in SessionStorageKey]?: StorageChange<SessionStorageSchema[K]>;
};
