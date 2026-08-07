import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import type { TabInfo } from '@storage/tab';
import { sendMessageToTab } from '@utils/message';
import type { SubtitleOverviewResponse } from '@utils/message/type';

import { useTabStore } from '@/ui/store/tab-store';

import { isSameContentVideoIdentity } from './subtitle-overview-model';

const VIDEO_TIME_POLL_DELAY_MS = 500;

export type ReadySubtitleOverview = Extract<
  SubtitleOverviewResponse,
  { status: 'ready' }
>;

export type SubtitleOverviewViewState =
  | { status: 'loading' }
  | { status: 'disconnected' }
  | {
      status: 'ready';
      context: CurrentRequestInput;
      revision: number;
      snapshot: ReadySubtitleOverview;
    }
  | { status: 'no-video' }
  | { status: 'stale' }
  | { status: 'error' };

export const useSubtitleOverview = () => {
  const activeTab = useTabStore((state) => state.activeTab);
  const tabInfo = useTabStore((state) => state.tabInfo);
  const [viewState, setViewState] = useState<SubtitleOverviewViewState>({ status: 'loading' });
  const generationRef = useRef(0);

  const activeTabId = activeTab?.id;
  const activeTabUrl = activeTab?.url;
  const connectionStatus = tabInfo?.connectionStatus;
  const videoStatus = tabInfo?.videoStatus;
  const learningSubtitleId = tabInfo?.learningSubtitleId ?? null;
  const supportSubtitleId = tabInfo?.supportSubtitleId ?? null;

  const loadSnapshot = useCallback(
    (pendingStatus: 'loading' | 'no-video' | 'stale' = 'loading') => {
      const tabId = activeTabId;
      const generation = ++generationRef.current;

      if (tabId === undefined || connectionStatus === 'disconnected') {
        setViewState({ status: 'disconnected' });
        return;
      }
      if (connectionStatus !== 'connected') {
        setViewState({ status: 'loading' });
        return;
      }

      setViewState({ status: pendingStatus });
      void sendMessageToTab(tabId, 'getSubtitleOverview').then(
        (response) => {
          if (
            !isCurrentRequest(
              {
                activeTabUrl,
                generation,
                learningSubtitleId,
                supportSubtitleId,
                tabId,
                videoStatus,
              },
              generationRef
            )
          ) {
            return;
          }
          if (!response.success) {
            setViewState({ status: 'error' });
            return;
          }

          const result = response.data;
          if (result.status === 'ready') {
            setViewState({
              status: 'ready',
              context: {
                activeTabUrl,
                generation,
                learningSubtitleId,
                supportSubtitleId,
                tabId,
                videoStatus,
              },
              revision: generation,
              snapshot: result,
            });
            return;
          }
          setViewState({ status: result.status });
        },
        () => {
          if (
            isCurrentRequest(
              {
                activeTabUrl,
                generation,
                learningSubtitleId,
                supportSubtitleId,
                tabId,
                videoStatus,
              },
              generationRef
            )
          ) {
            setViewState({ status: 'error' });
          }
        }
      );
    }, [
      activeTabId,
      activeTabUrl,
      connectionStatus,
      learningSubtitleId,
      supportSubtitleId,
      videoStatus,
    ]
  );

  useEffect(() => {
    loadSnapshot();
    return () => {
      generationRef.current += 1;
    };
  }, [loadSnapshot]);

  const readyIdentity = viewState.status === 'ready' ? viewState.snapshot.identity : undefined;
  const readySubtitleRevision =
    viewState.status === 'ready' ? viewState.snapshot.subtitleRevision : undefined;
  useEffect(() => {
    if (
      viewState.status !== 'ready' ||
      connectionStatus !== 'connected' ||
      activeTabId === undefined ||
      readyIdentity === undefined ||
      readySubtitleRevision === undefined
    ) {
      return;
    }

    let cancelled = false;
    let timeoutId: number | undefined;
    const generation = generationRef.current;
    const identity = readyIdentity;
    const subtitleRevision = readySubtitleRevision;

    const schedule = () => {
      if (!cancelled && isCurrentGeneration(generation, generationRef)) {
        timeoutId = window.setTimeout(poll, VIDEO_TIME_POLL_DELAY_MS);
      }
    };

    const poll = async () => {
      if (cancelled || !isCurrentGeneration(generation, generationRef)) return;

      try {
        const response = await sendMessageToTab(activeTabId, 'getVideoTime');
        if (
          cancelled ||
          !isCurrentGeneration(generation, generationRef) ||
          useTabStore.getState().activeTab?.id !== activeTabId
        ) {
          return;
        }
        if (!response.success) {
          generationRef.current += 1;
          setViewState({ status: 'error' });
          return;
        }

        const result = response.data;
        if (
          !isSameContentVideoIdentity(identity, result.identity) ||
          (result.status === 'ready' && result.subtitleRevision !== subtitleRevision)
        ) {
          generationRef.current += 1;
          setViewState({ status: 'stale' });
          loadSnapshot('stale');
          return;
        }
        if (result.status === 'no-video') {
          generationRef.current += 1;
          setViewState({ status: 'no-video' });
          return;
        }

        setViewState((current) =>
          current.status === 'ready'
            ? {
                ...current,
                snapshot: { ...current.snapshot, currentTime: result.currentTime },
              }
            : current
        );
        schedule();
      } catch {
        if (!cancelled && isCurrentGeneration(generation, generationRef)) {
          generationRef.current += 1;
          setViewState({ status: 'error' });
        }
      }
    };

    schedule();
    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [
    activeTabId,
    connectionStatus,
    loadSnapshot,
    readyIdentity?.contentInstanceId,
    readyIdentity?.routeChangedAt,
    readyIdentity?.videoId,
    readyIdentity?.videoRevision,
    readySubtitleRevision,
    viewState.status,
  ]);

  return {
    activeTabId,
    refresh: loadSnapshot,
    viewState: getSafeViewState(viewState, {
      activeTabId,
      activeTabUrl,
      connectionStatus,
      learningSubtitleId,
      supportSubtitleId,
      videoStatus,
    }),
  };
};

interface CurrentRequestInput {
  activeTabUrl: string | undefined;
  generation: number;
  learningSubtitleId: string | null;
  supportSubtitleId: string | null;
  tabId: number;
  videoStatus?: TabInfo['videoStatus'];
}

const isCurrentRequest = (
  request: CurrentRequestInput,
  generationRef: RefObject<number>
) => {
  const current = useTabStore.getState();
  return (
    isCurrentGeneration(request.generation, generationRef) &&
    current.activeTab?.id === request.tabId &&
    current.activeTab.url === request.activeTabUrl &&
    current.tabInfo?.videoStatus === request.videoStatus &&
    (current.tabInfo?.learningSubtitleId ?? null) === request.learningSubtitleId &&
    (current.tabInfo?.supportSubtitleId ?? null) === request.supportSubtitleId
  );
};

const isCurrentGeneration = (generation: number, generationRef: RefObject<number>) =>
  generationRef.current === generation;

interface CurrentViewContext {
  activeTabId: number | undefined;
  activeTabUrl: string | undefined;
  connectionStatus: TabInfo['connectionStatus'];
  learningSubtitleId: string | null;
  supportSubtitleId: string | null;
  videoStatus: TabInfo['videoStatus'];
}

const getSafeViewState = (
  state: SubtitleOverviewViewState,
  current: CurrentViewContext
): SubtitleOverviewViewState => {
  if (current.activeTabId === undefined || current.connectionStatus === 'disconnected') {
    return { status: 'disconnected' };
  }
  if (current.connectionStatus !== 'connected') return { status: 'loading' };
  if (state.status !== 'ready') return state;

  const { context } = state;
  return context.tabId === current.activeTabId &&
    context.activeTabUrl === current.activeTabUrl &&
    context.videoStatus === current.videoStatus &&
    context.learningSubtitleId === current.learningSubtitleId &&
    context.supportSubtitleId === current.supportSubtitleId
    ? state
    : { status: 'loading' };
};
