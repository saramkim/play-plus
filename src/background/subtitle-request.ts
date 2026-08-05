import type { SubtitleReplayRequest } from '@storage/session-type';
import { COUPANG_PLAY_SUBTITLE_API_URL } from '@utils/constants';
import { getCoupangPlayVideoId } from '@utils/coupang-play';
import type { MessageResponse } from '@utils/message';

import {
  clearSubtitleReplayRequest,
  getSubtitleReplayRequest,
  saveSubtitleReplayRequest,
} from './pending-actions';

type SubtitleRequestReplayDependencies = {
  clearReplay: typeof clearSubtitleReplayRequest;
  deliver: (tabId: number, payload: SubtitleReplayRequest) => Promise<MessageResponse<'fetchVideoMetadata'>>;
  getReplay: typeof getSubtitleReplayRequest;
  pingContent: (tabId: number) => Promise<MessageResponse<'pingContent'>>;
  saveReplay: typeof saveSubtitleReplayRequest;
};

type ContentStatus = {
  contentInstanceId?: string;
  documentId?: string | null;
  hasVideo: boolean;
  isVideoUrl: boolean;
  routeChangedAt?: number;
  videoId: string | null;
  videoRevision: number;
};

type NormalizedContentStatus = ContentStatus & {
  contentInstanceId: string;
  documentId: string | null;
  routeChangedAt: number;
};

type DetectedContent = Pick<
  NormalizedContentStatus,
  'contentInstanceId' | 'documentId' | 'routeChangedAt' | 'videoId' | 'videoRevision'
>;
type ContentSnapshot = DetectedContent &
  Pick<NormalizedContentStatus, 'hasVideo' | 'isVideoUrl'>;
type UnresolvedSubtitleReplayRequest = Omit<
  SubtitleReplayRequest,
  'capturedAt' | 'videoId'
>;
type ResolveVideoId = () => Promise<string | null>;

export type CaptureSubtitleRequest = (
  tabId: number,
  request: SubtitleReplayRequest | UnresolvedSubtitleReplayRequest,
  resolveVideoId?: ResolveVideoId,
  capturedAt?: number
) => Promise<void>;

export const createSubtitleRequestReplayController = (
  dependencies: SubtitleRequestReplayDependencies
) => {
  const captureRevisions = new Map<number, number>();
  const contentInstanceIds = new Map<number, string>();
  const contentStates = new Map<number, DetectedContent>();
  const deliveredStates = new Map<
    number,
    { contentInstanceId: string; requestId: string; videoRevision: number }
  >();
  const dirtyTabs = new Set<number>();
  const flushes = new Map<number, Promise<void>>();
  const generations = new Map<number, number>();
  const latestRouteChangedAt = new Map<number, number>();
  const latestVideoRevisions = new Map<number, number>();
  const ownershipRevisions = new Map<number, number>();
  const replayMutations = new Map<number, Promise<void>>();
  const routeVideoIds = new Map<number, string | null>();
  const statusMutations = new Map<number, Promise<void>>();

  const mutateReplay = async (tabId: number, mutation: () => Promise<void>) => {
    const previous = replayMutations.get(tabId) ?? Promise.resolve();
    const operation = previous.catch(() => undefined).then(mutation);
    replayMutations.set(tabId, operation);
    try {
      await operation;
    } finally {
      if (replayMutations.get(tabId) === operation) replayMutations.delete(tabId);
    }
  };

  const resetDetectedContent = (tabId: number) => {
    generations.set(tabId, (generations.get(tabId) ?? 0) + 1);
    contentStates.delete(tabId);
    deliveredStates.delete(tabId);
    latestVideoRevisions.delete(tabId);
  };

  const adoptContentRoute = (tabId: number, snapshot: DetectedContent) => {
    const previousRouteChangedAt = latestRouteChangedAt.get(tabId);
    if (
      previousRouteChangedAt !== undefined &&
      snapshot.routeChangedAt < previousRouteChangedAt
    ) {
      return false;
    }

    const routeChanged =
      routeVideoIds.has(tabId) && routeVideoIds.get(tabId) !== snapshot.videoId;
    const instanceChanged = contentInstanceIds.get(tabId) !== snapshot.contentInstanceId;
    routeVideoIds.set(tabId, snapshot.videoId);
    latestRouteChangedAt.set(tabId, snapshot.routeChangedAt);
    if (routeChanged) advanceOwnership(ownershipRevisions, tabId);
    if (routeChanged || instanceChanged) {
      contentInstanceIds.set(tabId, snapshot.contentInstanceId);
      resetDetectedContent(tabId);
    }
    return true;
  };

  const capture: CaptureSubtitleRequest = async (
    tabId,
    request,
    resolveVideoId,
    capturedAt
  ) => {
    const knownRouteChangedAt = latestRouteChangedAt.get(tabId);
    if (
      capturedAt !== undefined &&
      knownRouteChangedAt !== undefined &&
      capturedAt < knownRouteChangedAt
    ) {
      return;
    }

    const captureRevision = advanceOwnership(captureRevisions, tabId);
    let ownershipRevision = advanceOwnership(ownershipRevisions, tabId);
    let replay = await resolveReplayRequest(request, resolveVideoId, capturedAt);
    if (!replay || captureRevisions.get(tabId) !== captureRevision) return;

    let contentSnapshot: ContentSnapshot | null = null;
    if (
      capturedAt !== undefined ||
      (routeVideoIds.has(tabId) && routeVideoIds.get(tabId) !== replay.videoId)
    ) {
      contentSnapshot = await getContentSnapshot(dependencies, tabId);
      if (captureRevisions.get(tabId) !== captureRevision) return;
    }

    if (contentSnapshot) {
      if (replay.capturedAt !== null && replay.capturedAt < contentSnapshot.routeChangedAt) return;
      if (!adoptContentRoute(tabId, contentSnapshot)) return;
      if (
        replay.contentInstanceId !== null &&
        replay.contentInstanceId !== contentSnapshot.contentInstanceId
      ) {
        return;
      }
      replay = { ...replay, contentInstanceId: contentSnapshot.contentInstanceId };
      if (replay.videoId === null) replay = { ...replay, videoId: contentSnapshot.videoId };
      else if (replay.videoId !== contentSnapshot.videoId) return;
      ownershipRevision = advanceOwnership(ownershipRevisions, tabId);
    } else if (replay.contentInstanceId === null) {
      replay = { ...replay, videoId: null };
    } else if (routeVideoIds.has(tabId)) {
      const routeVideoId = routeVideoIds.get(tabId) ?? null;
      if (replay.videoId === null) replay = { ...replay, videoId: routeVideoId };
      else if (replay.videoId !== routeVideoId) {
        routeVideoIds.set(tabId, replay.videoId);
        latestRouteChangedAt.delete(tabId);
        contentInstanceIds.delete(tabId);
        resetDetectedContent(tabId);
        ownershipRevision = advanceOwnership(ownershipRevisions, tabId);
      }
    }

    const capturedReplay = replay;
    await mutateReplay(tabId, async () => {
      if (ownershipRevisions.get(tabId) !== ownershipRevision) return;
      await dependencies.saveReplay(tabId, capturedReplay);
    });
    if (ownershipRevisions.get(tabId) !== ownershipRevision) return;
    dirtyTabs.add(tabId);

    if (!contentStates.has(tabId) && replay.contentInstanceId !== null) {
      contentSnapshot ??= await getContentSnapshot(dependencies, tabId);
      if (ownershipRevisions.get(tabId) !== ownershipRevision) return;
      if (contentSnapshot && contentSnapshot.hasVideo) {
        if (
          replay.capturedAt !== null &&
          replay.contentInstanceId === null &&
          replay.capturedAt < contentSnapshot.routeChangedAt
        ) {
          await clearReplaySource(tabId, ownershipRevision);
          return;
        }
        if (!adoptContentRoute(tabId, contentSnapshot)) {
          await clearReplaySource(tabId, ownershipRevision);
          return;
        }
        ownershipRevision = ownershipRevisions.get(tabId) ?? ownershipRevision;
        contentStates.set(tabId, contentSnapshot);
        latestVideoRevisions.set(tabId, contentSnapshot.videoRevision);
        if (
          replay.contentInstanceId === null ||
          replay.contentInstanceId === contentSnapshot.contentInstanceId
        ) {
          replay = {
            ...replay,
            contentInstanceId: contentSnapshot.contentInstanceId,
            videoId: replay.videoId ?? contentSnapshot.videoId,
          };
          const boundReplay = replay;
          await mutateReplay(tabId, async () => {
            if (ownershipRevisions.get(tabId) !== ownershipRevision) return;
            await dependencies.saveReplay(tabId, boundReplay);
          });
          if (ownershipRevisions.get(tabId) !== ownershipRevision) return;
        }
        if (!isCompatibleReplay(replay, contentSnapshot)) {
          await clearReplaySource(tabId, ownershipRevision);
          return;
        }
      }
    }
    const content = contentStates.get(tabId);
    if (content && isCompatibleReplay(replay, content)) await flush(tabId);
  };

  const enqueueContentStatus = (
    tabId: number,
    status: NormalizedContentStatus,
    receivedOwnershipRevision: number
  ) => {
    const previous = statusMutations.get(tabId) ?? Promise.resolve();
    const operation = previous
      .catch(() => undefined)
      .then(() => applyContentStatus(tabId, status, receivedOwnershipRevision));
    statusMutations.set(tabId, operation);
    const removeCompletedOperation = () => {
      if (statusMutations.get(tabId) === operation) statusMutations.delete(tabId);
    };
    void operation.then(removeCompletedOperation, removeCompletedOperation);
    return operation;
  };

  const handleContentStatus = (tabId: number, status: ContentStatus) =>
    enqueueContentStatus(
      tabId,
      {
        ...status,
        contentInstanceId: status.contentInstanceId ?? 'unknown-content-instance',
        documentId: status.documentId ?? null,
        routeChangedAt: status.routeChangedAt ?? 0,
      },
      ownershipRevisions.get(tabId) ?? 0
    );

  const applyContentStatus = async (
    tabId: number,
    status: NormalizedContentStatus,
    receivedOwnershipRevision: number
  ) => {
    if (!adoptContentRoute(tabId, status)) return;

    const latestVideoRevision = latestVideoRevisions.get(tabId);
    if (latestVideoRevision !== undefined && status.videoRevision < latestVideoRevision) return;
    latestVideoRevisions.set(tabId, status.videoRevision);

    if (!status.isVideoUrl) {
      const clearedOwnershipRevision = advanceOwnership(ownershipRevisions, tabId);
      await clearReplaySource(tabId, clearedOwnershipRevision);
      return;
    }
    if (!status.hasVideo) {
      contentStates.delete(tabId);
      deliveredStates.delete(tabId);
      return;
    }

    let replay: SubtitleReplayRequest | undefined;
    let ownershipRevision = receivedOwnershipRevision;
    while (true) {
      await replayMutations.get(tabId)?.catch(() => undefined);
      replay = await dependencies.getReplay(tabId);
      const currentOwnershipRevision = ownershipRevisions.get(tabId) ?? 0;
      if (currentOwnershipRevision === ownershipRevision) break;
      ownershipRevision = currentOwnershipRevision;
    }

    if (
      routeVideoIds.get(tabId) !== status.videoId ||
      contentInstanceIds.get(tabId) !== status.contentInstanceId ||
      latestRouteChangedAt.get(tabId) !== status.routeChangedAt
    ) {
      return;
    }
    if ((latestVideoRevisions.get(tabId) ?? status.videoRevision) > status.videoRevision) return;
    if (replay) {
      if (replay.contentInstanceId === null) {
        if (
          replay.documentId === null ||
          status.documentId === null ||
          replay.documentId !== status.documentId ||
          (replay.capturedAt !== null && replay.capturedAt < status.routeChangedAt)
        ) {
          if (status.documentId !== null) {
            await clearReplaySource(tabId, ownershipRevision);
          }
          return;
        }
      }
      if (replay.videoId !== null && replay.videoId !== status.videoId) {
        await clearReplaySource(tabId, ownershipRevision);
        return;
      }

      if (
        replay.videoId === null ||
        replay.contentInstanceId !== status.contentInstanceId ||
        (status.documentId !== null && replay.documentId !== status.documentId)
      ) {
        const boundReplay = {
          ...replay,
          contentInstanceId: status.contentInstanceId,
          documentId: status.documentId ?? replay.documentId,
          videoId: status.videoId,
        };
        replay = boundReplay;
        await mutateReplay(tabId, async () => {
          if ((ownershipRevisions.get(tabId) ?? 0) !== ownershipRevision) return;
          await dependencies.saveReplay(tabId, boundReplay);
        });
        if ((ownershipRevisions.get(tabId) ?? 0) !== ownershipRevision) return;
        dirtyTabs.add(tabId);
      }
    }
    contentStates.set(tabId, {
      contentInstanceId: status.contentInstanceId,
      documentId: status.documentId,
      routeChangedAt: status.routeChangedAt,
      videoId: status.videoId,
      videoRevision: status.videoRevision,
    });
    const delivered = deliveredStates.get(tabId);
    if (
      replay &&
      !dirtyTabs.has(tabId) &&
      delivered?.contentInstanceId === status.contentInstanceId &&
      delivered?.requestId === replay.requestId &&
      delivered.videoRevision === status.videoRevision
    ) {
      return;
    }
    if ((ownershipRevisions.get(tabId) ?? 0) !== ownershipRevision) return;
    await flush(tabId);
  };

  const handleNavigation = async (tabId: number, url?: string | null) => {
    const nextVideoId = getCoupangPlayVideoId(url);
    if (routeVideoIds.has(tabId) && routeVideoIds.get(tabId) === nextVideoId) return;

    latestRouteChangedAt.delete(tabId);
    contentInstanceIds.delete(tabId);
    routeVideoIds.set(tabId, nextVideoId);
    const ownershipRevision = advanceOwnership(ownershipRevisions, tabId);
    resetDetectedContent(tabId);
    const replay = await dependencies.getReplay(tabId);
    if (ownershipRevisions.get(tabId) !== ownershipRevision) return;
    if (!replay) return;
    if (
      nextVideoId !== null &&
      (replay.videoId === nextVideoId ||
        (replay.contentInstanceId === null &&
          replay.documentId !== null &&
          replay.capturedAt !== null))
    ) {
      return;
    }
    await clearReplaySource(tabId, ownershipRevision);
  };

  const clear = async (tabId: number) => {
    latestRouteChangedAt.delete(tabId);
    contentInstanceIds.delete(tabId);
    routeVideoIds.set(tabId, null);
    const ownershipRevision = advanceOwnership(ownershipRevisions, tabId);
    await clearReplaySource(tabId, ownershipRevision);
  };

  const clearReplaySource = async (tabId: number, expectedOwnershipRevision?: number) => {
    if (
      expectedOwnershipRevision !== undefined &&
      (ownershipRevisions.get(tabId) ?? 0) !== expectedOwnershipRevision
    ) {
      return;
    }
    generations.set(tabId, (generations.get(tabId) ?? 0) + 1);
    contentStates.delete(tabId);
    deliveredStates.delete(tabId);
    dirtyTabs.delete(tabId);
    await mutateReplay(tabId, async () => {
      if (
        expectedOwnershipRevision !== undefined &&
        (ownershipRevisions.get(tabId) ?? 0) !== expectedOwnershipRevision
      ) {
        return;
      }
      await dependencies.clearReplay(tabId);
    });
  };

  const flush = (tabId: number): Promise<void> => {
    const active = flushes.get(tabId);
    if (active) return active;

    const promise = runFlush(tabId).finally(() => {
      if (flushes.get(tabId) === promise) flushes.delete(tabId);
    });
    flushes.set(tabId, promise);
    return promise;
  };

  const runFlush = async (tabId: number) => {
    let attemptedDelivery: string | null = null;

    while (contentStates.has(tabId)) {
      dirtyTabs.delete(tabId);
      const generation = generations.get(tabId) ?? 0;
      const replay = await dependencies.getReplay(tabId);
      const content = contentStates.get(tabId);
      if (
        !replay ||
        !content ||
        generation !== (generations.get(tabId) ?? 0) ||
        !isCompatibleReplay(replay, content)
      ) {
        return;
      }
      const deliveryKey = `${replay.requestId}:${content.contentInstanceId}:${content.videoRevision}`;
      if (deliveryKey === attemptedDelivery) return;
      attemptedDelivery = deliveryKey;

      try {
        const response = await dependencies.deliver(tabId, replay);
        if (!response.success) {
          if (await hasNewerFlushState(tabId, replay, content, generation)) continue;
          return;
        }
      } catch {
        if (await hasNewerFlushState(tabId, replay, content, generation)) continue;
        return;
      }

      if (generation !== (generations.get(tabId) ?? 0)) return;
      const latest = await dependencies.getReplay(tabId);
      const latestContent = contentStates.get(tabId);
      if (
        dirtyTabs.has(tabId) ||
        latest?.requestId !== replay.requestId ||
        latestContent?.contentInstanceId !== content.contentInstanceId ||
        latestContent?.videoRevision !== content.videoRevision
      ) {
        continue;
      }
      deliveredStates.set(tabId, {
        contentInstanceId: content.contentInstanceId,
        requestId: replay.requestId,
        videoRevision: content.videoRevision,
      });
      return;
    }
  };

  const hasNewerFlushState = async (
    tabId: number,
    replay: SubtitleReplayRequest,
    content: DetectedContent,
    generation: number
  ) => {
    if (generation !== (generations.get(tabId) ?? 0)) return false;
    const latest = await dependencies.getReplay(tabId);
    const latestContent = contentStates.get(tabId);
    return (
      dirtyTabs.has(tabId) ||
      latest?.requestId !== replay.requestId ||
      latestContent?.contentInstanceId !== content.contentInstanceId ||
      latestContent?.videoRevision !== content.videoRevision
    );
  };

  return { capture, clear, handleContentStatus, handleNavigation };
};

export const registerSubtitleRequestCapture = (
  capture: CaptureSubtitleRequest,
  resolveVideoId = defaultResolveVideoId
) => {
  chrome.webRequest.onSendHeaders.addListener(
    ({ documentId, requestHeaders, requestId, tabId, timeStamp, url }) => {
      const hasCustomHeader = requestHeaders?.some(
        (header) => header.name.toLowerCase() === 'x-extension-request'
      );
      if (hasCustomHeader || tabId < 0) return;

      void capture(
        tabId,
        {
          contentInstanceId: null,
          documentId: documentId ?? null,
          requestId,
          url,
          headers: requestHeaders ?? [],
        },
        () => resolveVideoId(tabId),
        timeStamp
      ).catch(() => console.error('Unable to preserve a subtitle request'));
    },
    { urls: [`${COUPANG_PLAY_SUBTITLE_API_URL}?*`] },
    ['requestHeaders']
  );
};

const getContentSnapshot = async (
  dependencies: Pick<SubtitleRequestReplayDependencies, 'pingContent'>,
  tabId: number
) => {
  try {
    const response = await dependencies.pingContent(tabId);
    return response.success
      ? {
          contentInstanceId: response.data.contentInstanceId,
          documentId: null,
          hasVideo: response.data.hasVideo,
          isVideoUrl: response.data.videoId !== null,
          routeChangedAt: response.data.routeChangedAt,
          videoId: response.data.videoId,
          videoRevision: response.data.videoRevision,
        }
      : null;
  } catch {
    return null;
  }
};

const isCompatibleVideo = (requestVideoId: string | null, currentVideoId: string | null) =>
  requestVideoId !== null && requestVideoId === currentVideoId;

const isCompatibleReplay = (request: SubtitleReplayRequest, content: DetectedContent) =>
  request.contentInstanceId !== null &&
  request.contentInstanceId === content.contentInstanceId &&
  isCompatibleVideo(request.videoId, content.videoId);

const advanceOwnership = (ownershipRevisions: Map<number, number>, tabId: number) => {
  const revision = (ownershipRevisions.get(tabId) ?? 0) + 1;
  ownershipRevisions.set(tabId, revision);
  return revision;
};

const resolveReplayRequest = async (
  request: SubtitleReplayRequest | UnresolvedSubtitleReplayRequest,
  resolveVideoId?: ResolveVideoId,
  capturedAt?: number
): Promise<SubtitleReplayRequest | null> => {
  if ('videoId' in request) {
    return { ...request, capturedAt: capturedAt ?? request.capturedAt };
  }
  if (!resolveVideoId) return null;
  return {
    ...request,
    capturedAt: capturedAt ?? null,
    videoId: await resolveVideoId(),
  };
};

const defaultResolveVideoId = async (tabId: number) => {
  try {
    return getCoupangPlayVideoId((await chrome.tabs.get(tabId)).url);
  } catch {
    return null;
  }
};
