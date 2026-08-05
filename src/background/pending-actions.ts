import { getSessionStorage, setSessionStorage } from '@storage/session';
import type { PendingViewAction, SubtitleReplayRequest } from '@storage/session-type';

let subtitleReplayMutation = Promise.resolve();

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

export const saveSubtitleReplayRequest = (tabId: number, request: SubtitleReplayRequest) =>
  mutateSubtitleReplayRequests(async () => {
    const requests = (await getSessionStorage('pendingSubtitleRequests')) ?? {};
    await setSessionStorage('pendingSubtitleRequests', { ...requests, [tabId]: request });
  });

export const getSubtitleReplayRequest = async (tabId: number) => {
  await subtitleReplayMutation;
  const requests = (await getSessionStorage('pendingSubtitleRequests')) ?? {};
  const request: unknown = requests[tabId];
  if (request === undefined) return undefined;
  if (isSubtitleReplayRequest(request)) return request;

  await clearSubtitleReplayRequest(tabId);
  return undefined;
};

export const clearSubtitleReplayRequest = (tabId: number) =>
  mutateSubtitleReplayRequests(async () => {
    const requests = (await getSessionStorage('pendingSubtitleRequests')) ?? {};
    if (!requests[tabId]) return;

    const remaining = { ...requests };
    delete remaining[tabId];
    await setSessionStorage('pendingSubtitleRequests', remaining);
  });

const mutateSubtitleReplayRequests = <T>(mutation: () => Promise<T>) => {
  const next = subtitleReplayMutation.then(mutation, mutation);
  subtitleReplayMutation = next.then(
    () => undefined,
    () => undefined
  );
  return next;
};

const isSubtitleReplayRequest = (value: unknown): value is SubtitleReplayRequest => {
  if (typeof value !== 'object' || value === null) return false;
  const request = value as Partial<SubtitleReplayRequest>;
  return (
    (request.capturedAt === null ||
      (typeof request.capturedAt === 'number' && Number.isFinite(request.capturedAt))) &&
    (request.contentInstanceId === null || typeof request.contentInstanceId === 'string') &&
    (request.documentId === null || typeof request.documentId === 'string') &&
    typeof request.requestId === 'string' &&
    (request.videoId === null || typeof request.videoId === 'string') &&
    typeof request.url === 'string' &&
    Array.isArray(request.headers)
  );
};
