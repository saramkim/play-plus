import { getSessionStorage, setSessionStorage } from '@storage/session';

export type PendingViewAction = {
  url: string;
  startTime: number;
  videoId: string | null;
};

export type PendingSubtitleRequest = {
  url: string;
  headers: chrome.webRequest.HttpHeader[];
};

export const enqueueViewAction = async (action: PendingViewAction) => {
  const actions = (await getSessionStorage('pendingViewActions')) ?? [];
  await setSessionStorage('pendingViewActions', [...actions, action]);
};

export const takeViewAction = async (videoId: string | null, url?: string) => {
  const actions = (await getSessionStorage('pendingViewActions')) ?? [];
  let matchingIndex = -1;

  for (let index = actions.length - 1; index >= 0; index -= 1) {
    if (videoId ? actions[index].videoId === videoId : actions[index].url === url) {
      matchingIndex = index;
      break;
    }
  }

  if (matchingIndex < 0) return undefined;
  const [action] = actions.splice(matchingIndex, 1);
  await setSessionStorage('pendingViewActions', actions);
  return action;
};

export const savePendingSubtitleRequest = async (tabId: number, request: PendingSubtitleRequest) => {
  const requests = (await getSessionStorage('pendingSubtitleRequests')) ?? {};
  await setSessionStorage('pendingSubtitleRequests', { ...requests, [tabId]: request });
};

export const takePendingSubtitleRequest = async (tabId: number) => {
  const requests = (await getSessionStorage('pendingSubtitleRequests')) ?? {};
  const request = requests[tabId];
  if (!request) return undefined;

  const remaining = { ...requests };
  delete remaining[tabId];
  await setSessionStorage('pendingSubtitleRequests', remaining);
  return request;
};
