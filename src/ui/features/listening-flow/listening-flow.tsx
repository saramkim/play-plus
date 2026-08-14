import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { ListeningProgressV1 } from '@storage/v2/type';
import { t } from '@utils/i18n';
import type { BeginListeningSessionResponse } from '@utils/message/type';
import type { PlaybackContextStatus } from '@utils/playback-context';
import { HeadphonesIcon, LoaderCircleIcon, RotateCcwIcon, Trash2Icon } from 'lucide-react';

import type { ListeningMissionSnapshot } from '@/listening/session/mission-reducer';
import {
  createListeningMissionTransport,
  type ListeningMissionTransport,
  type ListeningSessionController,
  type ListeningSessionFatalReason,
} from '@/ui/adapters/listening-mission-controller';
import { Button } from '@/ui/components/button';
import type { LearningSettingsStore } from '@/ui/features/learning-settings/learning-settings-store';
import { ListeningMission } from '@/ui/features/listening-mission/listening-mission';
import { LearningSettingsPage } from '@/ui/pages/learning-settings-page';
import { usePageStore } from '@/ui/store/page-store';
import { useTabStore } from '@/ui/store/tab-store';

import {
  selectContinueSegmentKeys,
  selectCurrentSegmentKeys,
  selectNextMissionSegmentKeys,
  summarizeListeningProgress,
  type ListeningProgressSummary,
  type ReadyListeningCatalog,
} from './listening-flow-model';


type CatalogUnavailableStatus =
  | 'no-video'
  | 'video-identity-unavailable'
  | 'no-learning-track'
  | 'no-segments';
type ResetTarget = 'all' | 'video';
type ResetRequest = Readonly<{
  tabContextKey: string;
  target: ResetTarget;
  videoId: string;
}>;

type LandingState =
  | { kind: 'loading' }
  | { kind: 'disconnected'; status: 'connecting' | 'disconnected' }
  | { context: PlaybackContextStatus; kind: 'playback-context' }
  | { kind: 'unavailable'; status: CatalogUnavailableStatus }
  | { kind: 'error' }
  | {
      catalog: ReadyListeningCatalog;
      kind: 'ready';
      progress: ListeningProgressV1;
      summary: ListeningProgressSummary;
    };

type ActiveMission = Readonly<{
  controller: ListeningSessionController;
  finalSegmentKey: ReadyListeningCatalog['segments'][number]['segmentKey'];
  sessionId: string;
  snapshot: ListeningMissionSnapshot;
  tabId: number;
}>;

type FatalTeardownState = Readonly<{
  error: boolean;
  pending: boolean;
  reason: ListeningSessionFatalReason;
  sessionId: string;
}>;

export interface ListeningLearningPageProps {
  progressRevision: number;
  settingsStore: LearningSettingsStore;
  transportFactory?: (tabId: number) => ListeningMissionTransport;
}

export function ListeningLearningPage({
  progressRevision,
  settingsStore,
  transportFactory = createListeningMissionTransport,
}: ListeningLearningPageProps) {
  const activeTabId = useTabStore((state) => state.activeTab?.id);
  const tabInfo = useTabStore((state) => state.tabInfo);
  const playbackContext = useTabStore((state) => state.playbackContext);
  const connectionStatus = tabInfo?.connectionStatus;
  const learningLanguage = settingsStore((state) => state.learningProfile.learningLanguage);
  const supportLanguage = settingsStore((state) => state.learningProfile.supportLanguage);
  const tabContextKey = `${activeTabId ?? 'none'}:${connectionStatus ?? 'unknown'}:${tabInfo?.videoStatus ?? 'unknown'}:${playbackContext?.contentEpoch ?? 'no-epoch'}:${playbackContext?.videoRevision ?? 'no-attachment'}:${playbackContext?.subtitleIdentity.subtitleRevision ?? 'no-subtitle'}:${playbackContext?.lifecycle ?? 'no-lifecycle'}:${playbackContext?.learningAvailable ?? false}:${learningLanguage}:${supportLanguage ?? 'none'}:${tabInfo?.learningSubtitleId ?? 'native'}:${tabInfo?.supportSubtitleId ?? 'none'}`;
  const acquireNavigationLock = usePageStore((state) => state.acquireNavigationLock);
  const transport = useMemo(
    () =>
      activeTabId === undefined || connectionStatus !== 'connected'
        || playbackContext?.learningAvailable !== true
        ? undefined
        : transportFactory(activeTabId),
    [activeTabId, connectionStatus, playbackContext?.learningAvailable, transportFactory]
  );
  const [activeMission, setActiveMission] = useState<ActiveMission>();
  const [announcement, setAnnouncement] = useState<string>();
  const [beginError, setBeginError] = useState<string>();
  const [beginPending, setBeginPending] = useState(false);
  const [fatalReason, setFatalReason] = useState<ListeningSessionFatalReason>();
  const [fatalTeardown, setFatalTeardown] = useState<FatalTeardownState>();
  const [landing, setLanding] = useState<LandingState>({ kind: 'loading' });
  const [reloadRevision, setReloadRevision] = useState(0);
  const [resumeError, setResumeError] = useState(false);
  const [resumePending, setResumePending] = useState(false);
  const [resetError, setResetError] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [resetRequest, setResetRequest] = useState<ResetRequest>();
  const activeMissionRef = useRef<ActiveMission | undefined>(undefined);
  const acquireNavigationLockRef = useRef(acquireNavigationLock);
  const beginGenerationRef = useRef(0);
  const beginPendingRef = useRef(false);
  const beginReleaseRef = useRef<(() => void) | undefined>(undefined);
  const currentResetTriggerRef = useRef<HTMLButtonElement>(null);
  const fatalHandlerRef = useRef<
    ((sessionId: string, reason: ListeningSessionFatalReason) => void) | undefined
  >(undefined);
  const loadGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  const nextAfterRef = useRef<ActiveMission['finalSegmentKey'] | undefined>(undefined);
  const ownershipRef = useRef(false);
  const resetAllTriggerRef = useRef<HTMLButtonElement>(null);
  const readyVideoIdRef = useRef<string | undefined>(undefined);
  const resetRequestRef = useRef<ResetRequest | undefined>(undefined);
  const resetSuccessFocusRef = useRef<ResetTarget | undefined>(undefined);
  const resetPendingRef = useRef(false);
  const releaseNavigationLockRef = useRef<(() => void) | undefined>(undefined);
  const transportRef = useRef(transport);
  const tabContextKeyRef = useRef(tabContextKey);
  const teardownGenerationRef = useRef(0);
  const teardownRef = useRef(false);
  const startSelectionGenerationRef = useRef(0);
  acquireNavigationLockRef.current = acquireNavigationLock;
  transportRef.current = transport;
  tabContextKeyRef.current = tabContextKey;
  resetRequestRef.current = resetRequest;
  if (landing.kind === 'ready') readyVideoIdRef.current = landing.catalog.videoId;

  const acquireMissionLock = useCallback(() => {
    if (releaseNavigationLockRef.current) return;
    releaseNavigationLockRef.current = acquireNavigationLockRef.current();
  }, []);

  const releaseMissionLock = useCallback(() => {
    releaseNavigationLockRef.current?.();
    releaseNavigationLockRef.current = undefined;
  }, []);

  const clearActiveMission = useCallback(() => {
    activeMissionRef.current = undefined;
    ownershipRef.current = false;
    teardownRef.current = false;
    releaseMissionLock();
    setActiveMission(undefined);
    setFatalTeardown(undefined);
  }, [releaseMissionLock]);

  const attemptFatalTeardown = useCallback(async (sessionId: string) => {
    const current = activeMissionRef.current;
    if (!current || current.sessionId !== sessionId) return;
    const generation = ++teardownGenerationRef.current;
    setFatalTeardown((state) =>
      state && state.sessionId === sessionId ? { ...state, error: false, pending: true } : state
    );
    let result: Awaited<ReturnType<ListeningSessionController['endSession']>>;
    try {
      result = await current.controller.endSession('restore-start');
    } catch {
      result = { status: 'error' };
    }
    if (
      !mountedRef.current ||
      generation !== teardownGenerationRef.current ||
      activeMissionRef.current?.sessionId !== sessionId
    ) {
      return;
    }
    if (result.status === 'error') {
      setFatalTeardown((state) =>
        state && state.sessionId === sessionId ? { ...state, error: true, pending: false } : state
      );
      return;
    }
    const reason = fatalHandlerReasonRef.current;
    clearActiveMission();
    setFatalReason(reason);
    setAnnouncement(undefined);
  }, [clearActiveMission]);

  const fatalHandlerReasonRef = useRef<ListeningSessionFatalReason>('error');
  fatalHandlerRef.current = (sessionId, reason) => {
    const current = activeMissionRef.current;
    if (!current || current.sessionId !== sessionId || teardownRef.current) return;
    fatalHandlerReasonRef.current = reason;
    teardownRef.current = true;
    current.controller.stopHeartbeat();
    setActiveMission(undefined);
    setFatalTeardown({ error: false, pending: true, reason, sessionId });
    void attemptFatalTeardown(sessionId);
  };

  const onOwnershipChange = useCallback((owned: boolean) => {
    if (owned === ownershipRef.current) return;
    ownershipRef.current = owned;
    const current = activeMissionRef.current;
    if (owned) {
      acquireMissionLock();
      current?.controller.startHeartbeat();
    } else {
      current?.controller.stopHeartbeat();
    }
  }, [acquireMissionLock]);

  const startMission = useCallback(
    async (
      currentTransport: ListeningMissionTransport,
      catalog: ReadyListeningCatalog,
      segmentKeys: readonly ReadyListeningCatalog['segments'][number]['segmentKey'][]
    ) => {
      const startTabId = activeTabId;
      if (
        startTabId === undefined ||
        segmentKeys.length === 0 ||
        beginPendingRef.current ||
        resetPendingRef.current ||
        resetRequestRef.current !== undefined ||
        activeMissionRef.current
      ) {
        return;
      }
      const generation = ++beginGenerationRef.current;
      const startTabContextKey = tabContextKey;
      const releaseBeginLock = once(acquireNavigationLockRef.current());
      beginPendingRef.current = true;
      beginReleaseRef.current = releaseBeginLock;
      setBeginPending(true);
      setBeginError(undefined);

      let response: BeginListeningSessionResponse;
      try {
        response = await currentTransport.beginSession(catalog, segmentKeys);
      } catch {
        response = { status: 'error' };
      }

      const staleRequest =
        !mountedRef.current ||
        generation !== beginGenerationRef.current ||
        tabContextKeyRef.current !== startTabContextKey ||
        transportRef.current !== currentTransport;
      if (staleRequest) {
        let ownedCurrentBeginLock = false;
        try {
          if (response.status === 'ready') {
            const abandoned = currentTransport.createSessionController(response, () => undefined);
            await abandoned.dispose();
          }
        } catch {
          // A rejected best-effort restore must still release this request's UI lock.
        } finally {
          releaseBeginLock();
          if (beginReleaseRef.current === releaseBeginLock) {
            beginReleaseRef.current = undefined;
            ownedCurrentBeginLock = true;
          }
        }
        if (ownedCurrentBeginLock) {
          beginPendingRef.current = false;
          if (mountedRef.current) setBeginPending(false);
        }
        return;
      }

      if (response.status !== 'ready') {
        beginPendingRef.current = false;
        setBeginPending(false);
        releaseBeginLock();
        if (beginReleaseRef.current === releaseBeginLock) {
          beginReleaseRef.current = undefined;
        }
        setBeginError(beginErrorMessage(response.status));
        if (
          response.status === 'stale' ||
          response.status === 'no-video' ||
          response.status === 'segment-unavailable'
        ) {
          setReloadRevision((revision) => revision + 1);
        }
        return;
      }

      try {
        const controller = currentTransport.createSessionController(response, (reason) =>
          fatalHandlerRef.current?.(response.sessionId, reason)
        );
        const snapshot = toMissionSnapshot(response.snapshot);
        const mission: ActiveMission = Object.freeze({
          controller,
          finalSegmentKey: snapshot.segments[snapshot.segments.length - 1].segmentKey,
          sessionId: response.sessionId,
          snapshot,
          tabId: startTabId,
        });
        releaseNavigationLockRef.current = releaseBeginLock;
        if (beginReleaseRef.current === releaseBeginLock) {
          beginReleaseRef.current = undefined;
        }
        beginPendingRef.current = false;
        setBeginPending(false);
        activeMissionRef.current = mission;
        setAnnouncement(undefined);
        setActiveMission(mission);
      } catch {
        let ownedCurrentBeginLock = false;
        try {
          const rejected = currentTransport.createSessionController(response, () => undefined);
          await rejected.dispose();
        } catch {
          // The session lease remains the final recovery boundary if disposal rejects.
        } finally {
          releaseBeginLock();
          if (beginReleaseRef.current === releaseBeginLock) {
            beginReleaseRef.current = undefined;
            ownedCurrentBeginLock = true;
          }
        }
        if (ownedCurrentBeginLock) {
          beginPendingRef.current = false;
          if (mountedRef.current) {
            setBeginPending(false);
            if (tabContextKeyRef.current === startTabContextKey) {
              setBeginError(t('v2_listening_landing_start_error'));
            }
          }
        }
      }
    },
    [activeTabId, tabContextKey]
  );

  const startFreshMission = useCallback(async (mode: 'continue' | 'current') => {
    const currentTransport = transportRef.current;
    if (
      !currentTransport ||
      beginPendingRef.current ||
      resetPendingRef.current ||
      resetRequestRef.current !== undefined ||
      activeMissionRef.current
    ) {
      return;
    }
    const generation = ++startSelectionGenerationRef.current;
    const startTabContextKey = tabContextKeyRef.current;
    beginPendingRef.current = true;
    setBeginPending(true);
    setBeginError(undefined);

    try {
      const [catalog, progress] = await Promise.all([
        currentTransport.getCatalog(),
        currentTransport.getProgress(),
      ]);
      if (
        !mountedRef.current ||
        generation !== startSelectionGenerationRef.current ||
        tabContextKeyRef.current !== startTabContextKey ||
        transportRef.current !== currentTransport
      ) {
        return;
      }
      if (catalog.status !== 'ready') {
        setBeginError(undefined);
        setLanding(
          catalog.status === 'error'
            ? { kind: 'error' }
            : { kind: 'unavailable', status: catalog.status }
        );
        return;
      }
      setLanding({
        catalog,
        kind: 'ready',
        progress,
        summary: summarizeListeningProgress(catalog, progress),
      });
      const keys =
        mode === 'continue'
          ? selectContinueSegmentKeys(catalog, progress)
          : selectCurrentSegmentKeys(catalog);
      if (keys.length === 0) {
        setBeginError(t('v2_listening_landing_current_unavailable'));
        return;
      }

      beginPendingRef.current = false;
      setBeginPending(false);
      await startMission(currentTransport, catalog, keys);
    } catch {
      if (
        mountedRef.current &&
        generation === startSelectionGenerationRef.current &&
        tabContextKeyRef.current === startTabContextKey &&
        transportRef.current === currentTransport
      ) {
        setBeginError(undefined);
        setLanding({ kind: 'error' });
      }
    } finally {
      if (generation === startSelectionGenerationRef.current && beginPendingRef.current) {
        beginPendingRef.current = false;
        setBeginPending(false);
      }
    }
  }, [startMission]);

  useEffect(() => {
    if (activeMission || fatalReason || fatalTeardown) return;
    const generation = ++loadGenerationRef.current;
    const startTabContextKey = tabContextKey;
    setBeginError(undefined);

    if (!transport) {
      if (
        activeTabId !== undefined &&
        connectionStatus === 'connected' &&
        playbackContext !== null
      ) {
        setLanding({ context: playbackContext, kind: 'playback-context' });
        return;
      }
      setLanding({
        kind: 'disconnected',
        status:
          activeTabId !== undefined && connectionStatus !== 'disconnected'
            ? 'connecting'
            : 'disconnected',
      });
      return;
    }

    setLanding({ kind: 'loading' });
    void (async () => {
      try {
        const [catalog, progress] = await Promise.all([
          transport.getCatalog(),
          transport.getProgress(),
        ]);
        if (
          !mountedRef.current ||
          generation !== loadGenerationRef.current ||
          tabContextKeyRef.current !== startTabContextKey ||
          activeMissionRef.current ||
          transportRef.current !== transport
        ) {
          return;
        }
        if (catalog.status === 'error') {
          setLanding({ kind: 'error' });
          return;
        }
        if (catalog.status !== 'ready') {
          setLanding({ kind: 'unavailable', status: catalog.status });
          return;
        }

        const nextAfter = nextAfterRef.current;
        if (nextAfter) {
          nextAfterRef.current = undefined;
          const keys = selectNextMissionSegmentKeys(catalog, progress, nextAfter);
          setLanding({
            catalog,
            kind: 'ready',
            progress,
            summary: summarizeListeningProgress(catalog, progress),
          });
          if (keys.length === 0) {
            return;
          }
          await startMission(transport, catalog, keys);
          return;
        }
        setLanding({
          catalog,
          kind: 'ready',
          progress,
          summary: summarizeListeningProgress(catalog, progress),
        });
      } catch {
        if (
          mountedRef.current &&
          generation === loadGenerationRef.current &&
          tabContextKeyRef.current === startTabContextKey &&
          transportRef.current === transport &&
          !activeMissionRef.current
        ) {
          setLanding({ kind: 'error' });
        }
      }
    })();
  }, [
    activeMission,
    activeTabId,
    connectionStatus,
    fatalReason,
    fatalTeardown,
    progressRevision,
    reloadRevision,
    startMission,
    tabContextKey,
    transport,
    playbackContext,
  ]);

  useEffect(() => {
    const current = activeMissionRef.current;
    if (
      !current ||
      (current.tabId === activeTabId && connectionStatus === 'connected') ||
      teardownRef.current
    ) {
      return;
    }
    fatalHandlerRef.current?.(current.sessionId, 'stale');
  }, [activeTabId, connectionStatus]);

  useEffect(() => {
    if (!beginPendingRef.current) return;
    beginGenerationRef.current += 1;
    startSelectionGenerationRef.current += 1;
    if (beginReleaseRef.current) return;
    beginPendingRef.current = false;
    setBeginPending(false);
  }, [activeTabId, connectionStatus, tabContextKey]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      loadGenerationRef.current += 1;
      beginGenerationRef.current += 1;
      startSelectionGenerationRef.current += 1;
      teardownGenerationRef.current += 1;
      const current = activeMissionRef.current;
      current?.controller.stopHeartbeat();
      activeMissionRef.current = undefined;
      const release = releaseNavigationLockRef.current;
      releaseNavigationLockRef.current = undefined;
      if (current) {
        void (async () => {
          try {
            await current.controller.dispose();
          } catch {
            // The content lease remains the final recovery boundary.
          } finally {
            release?.();
          }
        })();
      } else {
        release?.();
      }
    };
  }, []);

  const returnToIdle = useCallback(() => {
    clearActiveMission();
    setFatalReason(undefined);
    setReloadRevision((revision) => revision + 1);
  }, [clearActiveMission]);

  const startNextMission = useCallback(() => {
    const current = activeMissionRef.current;
    if (!current) return;
    nextAfterRef.current = current.finalSegmentKey;
    clearActiveMission();
    setFatalReason(undefined);
    setReloadRevision((revision) => revision + 1);
  }, [clearActiveMission]);

  const getPracticedAt = useCallback(() => new Date().toISOString(), []);

  const resumeAfterAdvertisement = async () => {
    const current = activeMissionRef.current;
    if (!current || resumePending) return;
    setResumeError(false);
    setResumePending(true);
    const result = await current.controller.resumeAfterAdvertisement();
    if (!mountedRef.current || activeMissionRef.current !== current) return;
    setResumePending(false);
    if (result === 'resumed') return;
    if (result === 'error') {
      setResumeError(true);
      return;
    }
    fatalHandlerRef.current?.(current.sessionId, result);
  };

  const openReset = (target: ResetTarget) => {
    if (beginPendingRef.current || resetPendingRef.current || landing.kind !== 'ready') return;
    const request = {
      tabContextKey,
      target,
      videoId: landing.catalog.videoId,
    } as const;
    setResetError(false);
    resetRequestRef.current = request;
    setResetRequest(request);
  };

  const closeReset = useCallback(() => {
    const target = resetRequest?.target;
    setResetError(false);
    resetRequestRef.current = undefined;
    setResetRequest(undefined);
    requestAnimationFrame(() =>
      (target === 'video' ? currentResetTriggerRef.current : resetAllTriggerRef.current)?.focus()
    );
  }, [resetRequest]);

  useEffect(() => {
    if (
      resetRequest &&
      (resetRequest.tabContextKey !== tabContextKey ||
        landing.kind !== 'ready' ||
        resetRequest.videoId !== landing.catalog.videoId)
    ) {
      closeReset();
    }
  }, [closeReset, landing, resetRequest, tabContextKey]);

  useEffect(() => {
    const target = resetSuccessFocusRef.current;
    if (!target || resetRequest || landing.kind !== 'ready') return;
    requestAnimationFrame(() => {
      const trigger =
        target === 'video' ? currentResetTriggerRef.current : resetAllTriggerRef.current;
      if (!trigger) return;
      trigger.focus();
      if (document.activeElement === trigger) resetSuccessFocusRef.current = undefined;
    });
  }, [landing, resetRequest]);

  const confirmReset = async () => {
    const request = resetRequest;
    if (
      !request ||
      beginPendingRef.current ||
      resetPendingRef.current ||
      !transport ||
      landing.kind !== 'ready'
    ) {
      return;
    }
    if (
      request.tabContextKey !== tabContextKey ||
      request.videoId !== landing.catalog.videoId
    ) {
      closeReset();
      return;
    }
    resetPendingRef.current = true;
    setResetPending(true);
    setResetError(false);
    try {
      const progress =
        request.target === 'video'
          ? await transport.clearVideoProgress(request.videoId)
          : await transport.clearAllProgress();
      if (
        !mountedRef.current ||
        request.tabContextKey !== tabContextKeyRef.current ||
        request.videoId !== readyVideoIdRef.current ||
        transportRef.current !== transport
      ) {
        return;
      }
      const completedTarget = request.target;
      resetSuccessFocusRef.current = completedTarget;
      resetRequestRef.current = undefined;
      setResetRequest(undefined);
      setLanding({
        catalog: landing.catalog,
        kind: 'ready',
        progress,
        summary: summarizeListeningProgress(landing.catalog, progress),
      });
      setAnnouncement(
        t(
          completedTarget === 'video'
            ? 'v2_listening_landing_reset_video_success'
            : 'v2_listening_landing_reset_all_success'
        )
      );
    } catch {
      if (
        mountedRef.current &&
        request.tabContextKey === tabContextKeyRef.current &&
        request.videoId === readyVideoIdRef.current &&
        transportRef.current === transport
      ) {
        setResetError(true);
      }
    } finally {
      resetPendingRef.current = false;
      if (mountedRef.current) setResetPending(false);
    }
  };

  if (activeMission) {
    const interrupted = playbackContext?.missionResumeRequired === true;
    const canResume =
      interrupted &&
      playbackContext.lifecycle === 'content' &&
      playbackContext.learningAvailable;
    return (
      <>
        <div className={interrupted ? 'hidden' : 'h-full min-h-0'} inert={interrupted}>
          <ListeningMission
            controller={activeMission.controller}
            getPracticedAt={getPracticedAt}
            snapshot={activeMission.snapshot}
            onExit={returnToIdle}
            onNextMission={startNextMission}
            onOwnershipChange={onOwnershipChange}
          />
        </div>
        {interrupted && (
          <MissionAdvertisementInterruption
            canResume={canResume}
            error={resumeError}
            pending={resumePending}
            onResume={() => void resumeAfterAdvertisement()}
          />
        )}
      </>
    );
  }

  if (fatalTeardown) {
    return (
      <FatalTeardown
        state={fatalTeardown}
        onRetry={() => void attemptFatalTeardown(fatalTeardown.sessionId)}
      />
    );
  }

  return (
    <section aria-label={t('v2_nav_learning')} className='h-full min-h-0 min-w-0'>
      <div
        className='h-full min-h-0 min-w-0 space-y-4 overflow-x-hidden overflow-y-auto p-4'
        data-scroll-owner='learning'
      >
        <section
          aria-labelledby='listening-mission-entry-title'
          className='min-w-0 space-y-3 rounded-xl border bg-background px-4 py-3 shadow'
        >
          <div className='flex min-w-0 items-center gap-2'>
            <HeadphonesIcon aria-hidden='true' className='size-5 shrink-0' />
            <h1 id='listening-mission-entry-title' className='min-w-0 text-wrap text-base font-semibold'>
              {t('v2_listening_landing_title')}
            </h1>
          </div>
          <p className='text-wrap text-sm text-muted-foreground'>
            {t('v2_listening_landing_description')}
          </p>
          {fatalReason ? (
            <FatalEntry reason={fatalReason} onRetry={() => setFatalReason(undefined)} />
          ) : (
            <LandingContent
              beginError={beginError}
              beginPending={beginPending}
              landing={landing}
              resetOpen={resetRequest !== undefined}
              resetPending={resetPending}
              onOpenReset={openReset}
              onRetry={() => setReloadRevision((revision) => revision + 1)}
              onStart={(mode) => void startFreshMission(mode)}
              currentResetTriggerRef={currentResetTriggerRef}
              resetAllTriggerRef={resetAllTriggerRef}
            />
          )}
          {announcement && <p role='status' className='text-wrap text-sm'>{announcement}</p>}
        </section>
        <LearningSettingsPage embedded store={settingsStore} />
      </div>
      {resetRequest && landing.kind === 'ready' && (
        <ResetConfirmation
          error={resetError}
          pending={resetPending}
          target={resetRequest.target}
          onCancel={closeReset}
          onConfirm={() => void confirmReset()}
        />
      )}
    </section>
  );
}

function LandingContent({
  beginError,
  beginPending,
  currentResetTriggerRef,
  landing,
  onOpenReset,
  onRetry,
  onStart,
  resetAllTriggerRef,
  resetOpen,
  resetPending,
}: {
  beginError?: string;
  beginPending: boolean;
  currentResetTriggerRef: React.RefObject<HTMLButtonElement | null>;
  landing: LandingState;
  onOpenReset: (target: ResetTarget) => void;
  onRetry: () => void;
  onStart: (mode: 'continue' | 'current') => void;
  resetAllTriggerRef: React.RefObject<HTMLButtonElement | null>;
  resetOpen: boolean;
  resetPending: boolean;
}) {
  if (landing.kind === 'loading') {
    return <p role='status' className='flex items-center gap-2 text-wrap text-sm'><LoaderCircleIcon className='size-4 animate-spin' />{t('v2_listening_landing_loading')}</p>;
  }
  if (landing.kind === 'disconnected') {
    return landing.status === 'connecting' ? (
      <LandingNotice title={t('v2_listening_landing_connecting_title')} description={t('v2_listening_landing_connecting_description')} />
    ) : (
      <LandingNotice title={t('v2_listening_landing_disconnected_title')} description={t('v2_listening_landing_disconnected_description')} />
    );
  }
  if (landing.kind === 'error') {
    return <LandingNotice action={t('v2_retry')} title={t('v2_listening_landing_error_title')} description={t('v2_listening_landing_error_description')} onAction={onRetry} />;
  }
  if (landing.kind === 'playback-context') {
    return (
      <LandingNotice
        title={t('v2_listening_playback_waiting_title')}
        description={t('v2_listening_playback_waiting_description')}
      />
    );
  }
  if (landing.kind === 'unavailable') {
    return <LandingNotice {...unavailableCopy(landing.status)} action={t('v2_retry')} onAction={onRetry} />;
  }

  const { catalog, summary } = landing;
  const currentAvailable = selectCurrentSegmentKeys(catalog).length > 0;
  return (
    <div className='min-w-0 space-y-3'>
      <dl className='grid min-w-0 grid-cols-2 gap-2 text-sm'>
        <ProgressFact label={t('v2_listening_landing_cleared')} value={`${summary.cleared} / ${summary.total}`} />
        <ProgressFact label={t('v2_listening_landing_mastered')} value={`${summary.mastered} / ${summary.total}`} />
        <ProgressFact label={t('v2_listening_landing_best_combo')} value={String(summary.bestCombo)} />
        <ProgressFact
          label={t('v2_listening_landing_last_practiced')}
          value={summary.lastPracticedAt ? formatPracticedAt(summary.lastPracticedAt) : t('v2_listening_landing_not_practiced')}
        />
      </dl>
      {catalog.supportAvailable && <p className='text-wrap text-xs text-muted-foreground'>{t('v2_listening_landing_support_available')}</p>}
      <p className='text-wrap text-xs text-muted-foreground'>{t('v2_listening_landing_caption_reminder')}</p>
      {beginError && <p role='alert' className='text-wrap text-sm text-destructive'>{beginError}</p>}
      <div className='grid min-w-0 gap-2 min-[360px]:grid-cols-2'>
        <Button className='min-h-11 h-auto min-w-0 whitespace-normal text-wrap' disabled={beginPending || resetOpen || resetPending} onClick={() => onStart('continue')}>
          {beginPending ? t('v2_listening_landing_starting') : t('v2_listening_landing_continue')}
        </Button>
        <Button className='min-h-11 h-auto min-w-0 whitespace-normal text-wrap' disabled={!currentAvailable || beginPending || resetOpen || resetPending} variant='outline' onClick={() => onStart('current')}>
          {t('v2_listening_landing_start_current')}
        </Button>
      </div>
      <div className='grid min-w-0 gap-2 border-t pt-3 min-[360px]:grid-cols-2'>
        <Button ref={currentResetTriggerRef} className='min-h-11 h-auto min-w-0 whitespace-normal text-wrap' disabled={beginPending || resetPending} size='sm' variant='outline' onClick={() => onOpenReset('video')}>
          <RotateCcwIcon />{t('v2_listening_landing_reset_video')}
        </Button>
        <Button ref={resetAllTriggerRef} className='min-h-11 h-auto min-w-0 whitespace-normal text-wrap' disabled={beginPending || resetPending} size='sm' variant='outline' onClick={() => onOpenReset('all')}>
          <Trash2Icon />{t('v2_listening_landing_reset_all')}
        </Button>
      </div>
    </div>
  );
}

function MissionAdvertisementInterruption({
  canResume,
  error,
  onResume,
  pending,
}: {
  canResume: boolean;
  error: boolean;
  onResume: () => void;
  pending: boolean;
}) {
  return (
    <section
      aria-live='polite'
      className='flex h-full min-h-0 flex-col items-center justify-center gap-3 overflow-y-auto p-6 text-center'
      data-scroll-owner='learning-advertisement'
    >
      <h1 className='text-wrap text-lg font-semibold'>
        {t(
          canResume
            ? 'v2_listening_advertisement_returned_title'
            : 'v2_listening_advertisement_title'
        )}
      </h1>
      <p className='text-wrap text-sm text-muted-foreground'>
        {t(
          canResume
            ? 'v2_listening_advertisement_returned_description'
            : 'v2_listening_advertisement_description'
        )}
      </p>
      {error && (
        <p role='alert' className='text-wrap text-sm text-destructive'>
          {t('v2_listening_advertisement_resume_error')}
        </p>
      )}
      {canResume && (
        <Button disabled={pending} onClick={onResume}>
          {t('v2_listening_advertisement_continue')}
        </Button>
      )}
    </section>
  );
}

function LandingNotice({ action, description, onAction, title }: { action?: string; description: string; onAction?: () => void; title: string }) {
  return (
    <div className='space-y-2' role={onAction ? 'alert' : 'status'}>
      <h2 className='text-wrap text-sm font-semibold'>{title}</h2>
      <p className='text-wrap text-sm text-muted-foreground'>{description}</p>
      {action && onAction && <Button className='min-h-11' size='sm' variant='outline' onClick={onAction}>{action}</Button>}
    </div>
  );
}

function FatalEntry({ reason, onRetry }: { reason: ListeningSessionFatalReason; onRetry: () => void }) {
  return <LandingNotice action={t('v2_retry')} description={fatalDescription(reason)} title={t('v2_listening_landing_fatal_title')} onAction={onRetry} />;
}

function FatalTeardown({
  onRetry,
  state,
}: {
  onRetry: () => void;
  state: FatalTeardownState;
}) {
  const retryRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (state.error) retryRef.current?.focus();
  }, [state.error]);

  return (
    <section className='flex h-full min-h-0 min-w-0 flex-col overflow-hidden' aria-labelledby='listening-fatal-end-title'>
      <div className='min-h-0 min-w-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto p-4' data-scroll-owner='listening-fatal-end'>
        <h1 id='listening-fatal-end-title' className='text-wrap text-base font-semibold'>{t('v2_listening_landing_fatal_ending_title')}</h1>
        <p className='text-wrap text-sm text-muted-foreground'>{fatalDescription(state.reason)}</p>
        {state.pending && <p role='status' className='flex items-center gap-2 text-wrap text-sm'><LoaderCircleIcon className='size-4 animate-spin' />{t('v2_listening_mission_ending')}</p>}
        {state.error && (
          <div className='space-y-3'>
            <p role='alert' className='text-wrap text-sm text-destructive'>{t('v2_listening_mission_end_error')}</p>
            <Button ref={retryRef} className='min-h-11 h-auto whitespace-normal text-wrap' onClick={onRetry}>{t('v2_listening_mission_retry_ending')}</Button>
          </div>
        )}
      </div>
    </section>
  );
}

function ProgressFact({ label, value }: { label: string; value: string }) {
  return <div className='min-w-0 rounded-lg bg-muted/60 p-2'><dt className='text-wrap text-xs text-muted-foreground'>{label}</dt><dd className='mt-1 min-w-0 text-wrap text-sm font-medium'>{value}</dd></div>;
}

function ResetConfirmation({ error, onCancel, onConfirm, pending, target }: { error: boolean; onCancel: () => void; onConfirm: () => void; pending: boolean; target: ResetTarget }) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
  }, [error]);
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && !pending) {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== 'Tab') return;
    const buttons = Array.from(
      dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []
    );
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
      <div ref={dialogRef} aria-describedby='listening-reset-description' aria-labelledby='listening-reset-title' aria-modal='true' className='w-full max-w-sm space-y-3 rounded-xl border bg-background p-4 shadow-xl' role='alertdialog' onKeyDown={onKeyDown}>
        <h2 id='listening-reset-title' className='text-wrap text-base font-semibold'>{t(target === 'video' ? 'v2_listening_landing_reset_video_confirm_title' : 'v2_listening_landing_reset_all_confirm_title')}</h2>
        <p id='listening-reset-description' className='text-wrap text-sm text-muted-foreground'>{t(target === 'video' ? 'v2_listening_landing_reset_video_confirm_description' : 'v2_listening_landing_reset_all_confirm_description')}</p>
        {error && <p role='alert' className='text-wrap text-sm text-destructive'>{t('v2_listening_landing_reset_error')}</p>}
        <div className='flex flex-wrap justify-end gap-2'>
          <Button className='min-h-11' disabled={pending} variant='outline' onClick={onCancel}>{t('cancel')}</Button>
          <Button ref={confirmRef} className='min-h-11 h-auto whitespace-normal text-wrap' aria-busy={pending || undefined} disabled={pending} onClick={onConfirm}>{pending ? t('v2_listening_landing_resetting') : t(target === 'video' ? 'v2_listening_landing_reset_video_confirm' : 'v2_listening_landing_reset_all_confirm')}</Button>
        </div>
      </div>
    </div>
  );
}

const toMissionSnapshot = (
  snapshot: Extract<BeginListeningSessionResponse, { status: 'ready' }>['snapshot']
): ListeningMissionSnapshot => Object.freeze({
  learningLanguage: snapshot.learningLanguage,
  segmenterVersion: snapshot.segmenterVersion,
  segments: Object.freeze(snapshot.segments.map((segment) => Object.freeze({
    ...(segment.alignedSupport ? { alignedSupport: Object.freeze({ sourceIndices: Object.freeze([...segment.alignedSupport.sourceIndices]), text: segment.alignedSupport.text }) } : {}),
    answerText: segment.answerText,
    segmentKey: segment.segmentKey,
    sourceIndices: Object.freeze([...segment.sourceIndices]),
    sourceKey: segment.sourceKey,
  }))),
  sourceKey: snapshot.sourceKey,
  videoId: snapshot.videoId,
});

const beginErrorMessage = (status: Exclude<BeginListeningSessionResponse['status'], 'ready'>) => {
  if (status === 'busy') return t('v2_listening_landing_busy');
  if (status === 'stale') return t('v2_listening_landing_begin_stale');
  if (status === 'no-video') return t('v2_listening_landing_fatal_no_video');
  if (status === 'segment-unavailable') return t('v2_listening_landing_fatal_segment_unavailable');
  return t('v2_listening_landing_start_error');
};

const unavailableCopy = (status: CatalogUnavailableStatus) => {
  if (status === 'no-video') return { description: t('v2_listening_landing_no_video_description'), title: t('v2_listening_landing_no_video_title') };
  if (status === 'video-identity-unavailable') return { description: t('v2_listening_landing_video_identity_unavailable_description'), title: t('v2_listening_landing_video_identity_unavailable_title') };
  if (status === 'no-learning-track') return { description: t('v2_listening_landing_no_learning_track_description'), title: t('v2_listening_landing_no_learning_track_title') };
  return { description: t('v2_listening_landing_no_segments_description'), title: t('v2_listening_landing_no_segments_title') };
};

const fatalDescription = (reason: ListeningSessionFatalReason) => {
  if (reason === 'stale') return t('v2_listening_landing_fatal_stale');
  if (reason === 'no-video') return t('v2_listening_landing_fatal_no_video');
  if (reason === 'segment-unavailable') return t('v2_listening_landing_fatal_segment_unavailable');
  return t('v2_listening_landing_fatal_error');
};

const once = (callback: () => void) => {
  let called = false;
  return () => {
    if (called) return;
    called = true;
    callback();
  };
};

const formatPracticedAt = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
