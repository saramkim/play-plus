import { z } from 'zod';

import type { LearningCard, V2SubtitleCue } from '@storage/v2/type';
import type { Language } from '@utils/constants';
import type {
  BeginListeningSessionResponse,
  ContentVideoIdentity,
  EndListeningSessionResponse,
  HeartbeatListeningSessionResponse,
  ListeningCatalogResponse,
  ListeningSessionSnapshot,
  MessageSchema,
  PlayListeningSegmentResponse,
  ResumeListeningSessionAfterAdvertisementResponse,
  SaveListeningSegmentResponse,
} from '@utils/message/type';
import type { PlaybackContextStatus } from '@utils/playback-context';

import { useVideoStore } from '@/content/core/store/video-store';
import {
  buildLearningCardFromListeningSegment,
} from '@/content/features/learning-playback/learning-card-builder';
import {
  saveLearningCard,
  type LearningCardSaveResult,
} from '@/content/features/learning-playback/learning-card-save-coordinator';
import { useListeningMissionActiveStore } from '@/content/features/listening-session/mission-active-store';
import { syncSubtitles } from '@/content/features/subtitle/subtitle';
import {
  buildListeningSegmentCatalog,
  type ListeningPracticeSegment,
} from '@/listening/domain/segment-catalog';
import {
  LISTENING_SEGMENTER_VERSION,
  listeningSegmentKeySchema,
  type ListeningSourceKey,
} from '@/listening/domain/source-identity';

const LISTENING_SESSION_LEASE_MS = 15_000;
const LISTENING_CLIP_PREROLL_MS = 250;
const LISTENING_CLIP_POSTROLL_MS = 350;
const MAX_REMEMBERED_ENDED_SESSIONS = 32;

type TimerHandle = ReturnType<typeof setTimeout>;

type BeginListeningSessionParams = MessageSchema['beginListeningSession']['params'];
type HeartbeatListeningSessionParams = MessageSchema['heartbeatListeningSession']['params'];
type PlayListeningSegmentParams = MessageSchema['playListeningSegment']['params'];
type SaveListeningSegmentParams = MessageSchema['saveListeningSegment']['params'];
type EndListeningSessionParams = MessageSchema['endListeningSession']['params'];
type EndListeningSessionMode = EndListeningSessionParams['mode'];
type ResumeListeningSessionParams =
  MessageSchema['resumeListeningSessionAfterAdvertisement']['params'];

const nonnegativeSafeIntegerSchema = z
  .number()
  .int()
  .nonnegative()
  .refine(Number.isSafeInteger);
const contentVideoIdentitySchema = z
  .object({
    contentEpoch: nonnegativeSafeIntegerSchema,
    contentInstanceId: z.string().min(1),
    routeChangedAt: z.number().finite().nonnegative(),
    videoId: z.string().min(1).nullable(),
    videoRevision: nonnegativeSafeIntegerSchema,
  })
  .strict();
const sessionIdSchema = z.string().min(1);
const beginParamsSchema = z
  .object({
    expectedIdentity: contentVideoIdentitySchema,
    expectedSubtitleRevision: nonnegativeSafeIntegerSchema,
    segmentKeys: z.array(listeningSegmentKeySchema),
  })
  .strict();
const heartbeatParamsSchema = z
  .object({
    sessionId: sessionIdSchema,
    expectedIdentity: contentVideoIdentitySchema,
    expectedSubtitleRevision: nonnegativeSafeIntegerSchema,
  })
  .strict();
const playParamsSchema = z
  .object({
    sessionId: sessionIdSchema,
    segmentKey: listeningSegmentKeySchema,
    rate: z.union([z.literal(1), z.literal(0.75)]),
  })
  .strict();
const saveParamsSchema = z
  .object({
    sessionId: sessionIdSchema,
    segmentKey: listeningSegmentKeySchema,
  })
  .strict();
const endParamsSchema = z
  .object({
    sessionId: sessionIdSchema,
    mode: z.enum(['restore-start', 'complete-stay', 'continue-watching']),
  })
  .strict();
const resumeParamsSchema = z
  .object({
    sessionId: sessionIdSchema,
    expectedIdentity: contentVideoIdentitySchema,
    expectedSubtitleRevision: nonnegativeSafeIntegerSchema,
  })
  .strict();

export interface ListeningSessionTrack {
  cues: readonly V2SubtitleCue[];
  delaySeconds: number;
  language: Language;
}

export interface ListeningSessionLearningTrack extends ListeningSessionTrack {
  sourceKey: ListeningSourceKey;
}

export interface ListeningSessionContext {
  identity: ContentVideoIdentity;
  learning: ListeningSessionLearningTrack | null;
  playbackContext: PlaybackContextStatus;
  subtitleRevision: number;
  support: ListeningSessionTrack | null;
  video: HTMLVideoElement | null;
  watchedUrl: string;
}

type LearningCardFactory = () => LearningCard | null | undefined;

export interface ListeningSessionCoordinatorDependencies {
  readContext: () => ListeningSessionContext;
  isIdentityCurrent: (identity: ContentVideoIdentity) => boolean;
  isCurrentVideo: (video: HTMLVideoElement) => boolean;
  clearTimer?: (timerId: TimerHandle) => void;
  createSessionId?: () => string;
  now?: () => number;
  resyncSubtitles?: () => void;
  saveCard?: (createCard: LearningCardFactory) => Promise<LearningCardSaveResult>;
  setMissionActive?: (active: boolean) => void;
  setTimer?: (callback: () => void, delayMs: number) => TimerHandle;
}

export interface ListeningSessionCoordinator {
  getCatalog: () => Promise<ListeningCatalogResponse>;
  begin: (params: BeginListeningSessionParams) => Promise<BeginListeningSessionResponse>;
  heartbeat: (
    params: HeartbeatListeningSessionParams
  ) => Promise<HeartbeatListeningSessionResponse>;
  play: (params: PlayListeningSegmentParams) => Promise<PlayListeningSegmentResponse>;
  save: (params: SaveListeningSegmentParams) => Promise<SaveListeningSegmentResponse>;
  end: (params: EndListeningSessionParams) => Promise<EndListeningSessionResponse>;
  handlePlaybackContextChange: () => void;
  isAdvertisementResumeRequired: () => boolean;
  resumeAfterAdvertisement: (
    params: ResumeListeningSessionParams
  ) => Promise<ResumeListeningSessionAfterAdvertisementResponse>;
  dispose: () => void;
}

interface ReadyListeningSessionContext extends ListeningSessionContext {
  identity: ContentVideoIdentity & { videoId: string };
  learning: ListeningSessionLearningTrack;
  video: HTMLVideoElement;
}

interface PreparedCatalog {
  catalog: readonly ListeningPracticeSegment[];
  context: ReadyListeningSessionContext;
}

type CatalogPreparationResult =
  | { status: 'ready'; prepared: PreparedCatalog }
  | {
      status:
        | 'no-video'
        | 'video-identity-unavailable'
        | 'no-learning-track'
        | 'no-segments'
        | 'stale'
        | 'error';
    };

interface CapturedPlaybackState {
  currentTime: number;
  paused: boolean;
  playbackRate: number;
}

interface ActiveListeningSession {
  catalog: readonly ListeningPracticeSegment[];
  captured: CapturedPlaybackState;
  context: PreparedCatalog['context'];
  endRetryRequired: boolean;
  lastHeartbeatAt: number;
  lastPracticedEndpoint: number;
  leaseTimer: TimerHandle | null;
  pendingEndMode: EndListeningSessionMode | null;
  selectedSegments: readonly ListeningPracticeSegment[];
  sessionId: string;
  snapshot: ListeningSessionSnapshot;
  suspendedForAdvertisement: boolean;
  video: HTMLVideoElement;
}

interface ActiveClip {
  cleanup: () => void;
  generation: number;
  settle: (result: PlayListeningSegmentResponse) => void;
}

type SessionValidationResult =
  | { status: 'valid'; context: PreparedCatalog['context'] }
  | { status: 'stale' | 'no-video' | 'segment-unavailable' | 'error' };

export const createListeningSessionCoordinator = (
  dependencies: ListeningSessionCoordinatorDependencies
): ListeningSessionCoordinator => {
  const now = dependencies.now ?? (() => Date.now());
  const createSessionId = dependencies.createSessionId ?? (() => crypto.randomUUID());
  const setTimer =
    dependencies.setTimer ??
    ((callback: () => void, delayMs: number) => globalThis.setTimeout(callback, delayMs));
  const clearTimer =
    dependencies.clearTimer ?? ((timerId: TimerHandle) => globalThis.clearTimeout(timerId));
  const saveCard = dependencies.saveCard ?? saveLearningCard;
  const setMissionActive =
    dependencies.setMissionActive ??
    ((active: boolean) => useListeningMissionActiveStore.getState().setActive(active));
  const resyncSubtitles =
    dependencies.resyncSubtitles ??
    (() => syncSubtitles(useVideoStore.getState().currentTime));

  let activeSession: ActiveListeningSession | null = null;
  let activeClip: ActiveClip | null = null;
  let clipGeneration = 0;
  const endedSessionIds = new Set<string>();

  const applySuppression = (active: boolean) => {
    setMissionActive(active);
    resyncSubtitles();
  };

  const canSafelyControlCapturedVideo = (
    session: ActiveListeningSession,
    context: ListeningSessionContext
  ) =>
    context.video === session.video &&
    session.video.isConnected &&
    dependencies.isCurrentVideo(session.video);

  const canSafelyRestoreCapturedVideo = (
    session: ActiveListeningSession,
    context: ListeningSessionContext
  ) =>
    canSafelyControlCapturedVideo(session, context) &&
    dependencies.isIdentityCurrent(context.identity) &&
    isSameIdentity(context.identity, session.context.identity);

  const isSessionContextCurrent = (
    session: ActiveListeningSession,
    context: ListeningSessionContext
  ) =>
    canSafelyRestoreCapturedVideo(session, context) &&
    context.subtitleRevision === session.context.subtitleRevision &&
    context.learning?.sourceKey === session.context.learning.sourceKey;

  const safelyClearSuppression = () => {
    try {
      setMissionActive(false);
    } catch {
      // Cleanup continues even when an injected presentation seam fails.
    }
    try {
      resyncSubtitles();
    } catch {
      // Media/session ownership must still be released.
    }
  };

  const rememberEndedSession = (sessionId: string) => {
    endedSessionIds.add(sessionId);
    while (endedSessionIds.size > MAX_REMEMBERED_ENDED_SESSIONS) {
      const oldest = endedSessionIds.values().next().value as string | undefined;
      if (oldest === undefined) break;
      endedSessionIds.delete(oldest);
    }
  };

  const settleActiveClip = (result: PlayListeningSegmentResponse) => {
    const clip = activeClip;
    if (!clip) return;
    activeClip = null;
    clip.cleanup();
    clip.settle(result);
  };

  const invalidateActiveClip = () => settleActiveClip({ status: 'stale' });

  const supersedeActiveClip = () => settleActiveClip({ status: 'error' });

  const suspendActiveClip = () => settleActiveClip({ status: 'suspended' });

  const clearLease = (session: ActiveListeningSession) => {
    if (session.leaseTimer === null) return;
    try {
      clearTimer(session.leaseTimer);
    } catch {
      // Ownership cleanup continues even if an injected timer seam fails.
    }
    session.leaseTimer = null;
  };

  const releaseSession = (session: ActiveListeningSession) => {
    if (activeSession !== session) return;
    invalidateActiveClip();
    clearLease(session);
    activeSession = null;
    safelyClearSuppression();
    rememberEndedSession(session.sessionId);
  };

  const abandonSessionWithoutSeeking = (session: ActiveListeningSession) => {
    releaseSession(session);
  };

  const stopAndReleaseSessionWithoutSeeking = (
    session: ActiveListeningSession,
    context: ListeningSessionContext
  ) => {
    if (!canSafelyControlCapturedVideo(session, context)) {
      abandonSessionWithoutSeeking(session);
      return;
    }
    invalidateActiveClip();
    try {
      session.video.pause();
    } catch {
      // Continue releasing ownership if the current media element rejects control.
    }
    try {
      session.video.playbackRate = session.captured.playbackRate;
    } catch {
      // The route's current position remains untouched even if rate restoration fails.
    }
    releaseSession(session);
  };

  const restorePlayback = async (
    session: ActiveListeningSession,
    mode: EndListeningSessionMode
  ) => {
    const video = session.video;
    const targetTime =
      mode === 'restore-start'
        ? session.captured.currentTime
        : session.lastPracticedEndpoint;

    video.pause();
    video.currentTime = targetTime;
    video.playbackRate = session.captured.playbackRate;

    const shouldPlay =
      mode === 'continue-watching' ||
      (mode === 'restore-start' && !session.captured.paused);
    if (shouldPlay) await video.play();
  };

  const finishSession = async (
    session: ActiveListeningSession,
    mode: EndListeningSessionMode,
    retainForRetry: boolean
  ): Promise<EndListeningSessionResponse> => {
    invalidateActiveClip();
    session.pendingEndMode = mode;
    session.endRetryRequired = false;
    session.lastHeartbeatAt = now();
    scheduleLease(session);

    try {
      await restorePlayback(session, mode);
    } catch {
      if (activeSession !== session && endedSessionIds.has(session.sessionId)) {
        return { status: 'already-ended' };
      }
      if (retainForRetry && activeSession === session) {
        session.pendingEndMode = null;
        session.endRetryRequired = true;
        session.lastHeartbeatAt = now();
        scheduleLease(session);
      } else {
        releaseSession(session);
      }
      return { status: 'error' };
    }

    releaseSession(session);
    return { status: 'ended' };
  };

  const emergencyRestoreAndRelease = (session: ActiveListeningSession) => {
    invalidateActiveClip();
    clearLease(session);
    session.pendingEndMode = 'restore-start';
    const restoration = restorePlayback(session, 'restore-start');
    releaseSession(session);
    void restoration.catch(() => undefined);
  };

  const expireLease = async (session: ActiveListeningSession) => {
    if (activeSession !== session) return;
    let context: ListeningSessionContext;
    try {
      context = dependencies.readContext();
    } catch {
      abandonSessionWithoutSeeking(session);
      return;
    }
    const canRestore = canSafelyRestoreCapturedVideo(session, context);
    if (!canRestore) {
      stopAndReleaseSessionWithoutSeeking(session, context);
      return;
    }
    emergencyRestoreAndRelease(session);
  };

  function scheduleLease(session: ActiveListeningSession, delayMs = LISTENING_SESSION_LEASE_MS) {
    clearLease(session);
    session.leaseTimer = setTimer(() => {
      session.leaseTimer = null;
      if (activeSession !== session) return;
      const remaining = LISTENING_SESSION_LEASE_MS - (now() - session.lastHeartbeatAt);
      if (remaining > 0) {
        scheduleLease(session, remaining);
        return;
      }
      void expireLease(session);
    }, delayMs);
  }

  const prepareCatalog = async (): Promise<CatalogPreparationResult> => {
    try {
      const context = dependencies.readContext();
      if (!context.playbackContext.learningAvailable) {
        return { status: 'video-identity-unavailable' };
      }
      if (!context.video || !dependencies.isCurrentVideo(context.video)) {
        return { status: 'no-video' };
      }
      if (context.identity.videoId === null) {
        return { status: 'video-identity-unavailable' };
      }
      if (!dependencies.isIdentityCurrent(context.identity)) {
        return { status: 'video-identity-unavailable' };
      }
      if (!context.learning || context.learning.cues.length === 0) {
        return { status: 'no-learning-track' };
      }

      const catalog = freezeCatalog(
        await buildListeningSegmentCatalog({
          learningCues: context.learning.cues,
          learningDelaySeconds: context.learning.delaySeconds,
          sourceKey: context.learning.sourceKey,
          supportCues: context.support?.cues,
          supportDelaySeconds: context.support?.delaySeconds,
        })
      );
      const latest = dependencies.readContext();
      if (
        !isSameCatalogContext(context, latest) ||
        !dependencies.isIdentityCurrent(latest.identity)
      ) {
        return { status: 'stale' };
      }
      if (catalog.length === 0) return { status: 'no-segments' };

      return {
        status: 'ready',
        prepared: {
          catalog,
          context: context as ReadyListeningSessionContext,
        },
      };
    } catch {
      return { status: 'error' };
    }
  };

  const getCatalog = async (): Promise<ListeningCatalogResponse> => {
    const result = await prepareCatalog();
    if (result.status !== 'ready') {
      return { status: result.status === 'stale' ? 'error' : result.status };
    }
    const { catalog, context } = result.prepared;

    return {
      status: 'ready',
      identity: cloneIdentity(context.identity),
      subtitleRevision: context.subtitleRevision,
      videoId: context.identity.videoId,
      sourceKey: context.learning.sourceKey,
      currentTime: context.video.currentTime,
      segmenterVersion: LISTENING_SEGMENTER_VERSION,
      supportAvailable: catalog.some(({ alignedSupport }) => alignedSupport !== undefined),
      segments: catalog.map(({ endMs, segmentKey, startMs }) => ({
        segmentKey,
        startMs,
        endMs,
      })),
    };
  };

  const rollbackFailedBegin = (
    session: ActiveListeningSession | null,
    context: ReadyListeningSessionContext,
    captured: CapturedPlaybackState | null
  ) => {
    if (session) {
      invalidateActiveClip();
      clearLease(session);
      if (activeSession === session) activeSession = null;
      rememberEndedSession(session.sessionId);
    }
    safelyClearSuppression();

    if (!captured) return;
    let latest: ListeningSessionContext;
    try {
      latest = dependencies.readContext();
    } catch {
      return;
    }
    if (
      latest.video !== context.video ||
      !isSameIdentity(context.identity, latest.identity) ||
      !dependencies.isIdentityCurrent(latest.identity) ||
      !dependencies.isCurrentVideo(context.video)
    ) {
      return;
    }
    try {
      context.video.pause();
      context.video.currentTime = captured.currentTime;
      context.video.playbackRate = captured.playbackRate;
      if (!captured.paused) void context.video.play().catch(() => undefined);
    } catch {
      // The failed begin still relinquishes all Play Plus transient ownership.
    }
  };

  const begin = async (
    params: BeginListeningSessionParams
  ): Promise<BeginListeningSessionResponse> => {
    const parsedParams = beginParamsSchema.safeParse(params);
    if (!parsedParams.success) return { status: 'error' };
    const request = parsedParams.data;
    if (activeSession) return { status: 'busy' };

    const result = await prepareCatalog();
    if (activeSession) return { status: 'busy' };
    if (result.status !== 'ready') {
      if (result.status === 'no-video') return { status: 'no-video' };
      if (result.status === 'error') return { status: 'error' };
      if (result.status === 'stale') return { status: 'stale' };
      if (result.status === 'video-identity-unavailable') return { status: 'stale' };
      return { status: 'segment-unavailable' };
    }

    const { catalog, context } = result.prepared;
    if (
      !isSameIdentity(request.expectedIdentity, context.identity) ||
      request.expectedSubtitleRevision !== context.subtitleRevision
    ) {
      return { status: 'stale' };
    }

    const selectedSegments = selectRequestedSegments(catalog, request.segmentKeys);
    if (!selectedSegments) return { status: 'segment-unavailable' };

    const latest = dependencies.readContext();
    if (
      !isSameCatalogContext(context, latest) ||
      !dependencies.isIdentityCurrent(latest.identity)
    ) {
      return { status: 'stale' };
    }

    let startedSession: ActiveListeningSession | null = null;
    let captured: CapturedPlaybackState | null = null;
    try {
      const sessionId = createUniqueSessionId(createSessionId, endedSessionIds);
      const snapshot = createImmutableSnapshot(context, selectedSegments);
      captured = {
        currentTime: context.video.currentTime,
        paused: context.video.paused,
        playbackRate: context.video.playbackRate,
      };
      context.video.pause();

      const session: ActiveListeningSession = {
        catalog,
        captured,
        context,
        endRetryRequired: false,
        lastHeartbeatAt: now(),
        lastPracticedEndpoint: captured.currentTime,
        leaseTimer: null,
        pendingEndMode: null,
        selectedSegments,
        sessionId,
        snapshot,
        suspendedForAdvertisement: false,
        video: context.video,
      };
      startedSession = session;
      activeSession = session;
      applySuppression(true);
      scheduleLease(session);

      return {
        status: 'ready',
        sessionId,
        identity: cloneIdentity(context.identity),
        subtitleRevision: context.subtitleRevision,
        snapshot,
      };
    } catch {
      rollbackFailedBegin(startedSession, context, captured);
      return { status: 'error' };
    }
  };

  const validateSession = (
    session: ActiveListeningSession
  ): SessionValidationResult => {
    let context: ListeningSessionContext;
    try {
      context = dependencies.readContext();
    } catch {
      return { status: 'error' };
    }
    if (!context.video) return { status: 'no-video' };
    if (!isSessionContextCurrent(session, context)) {
      return { status: 'stale' };
    }
    return { status: 'valid', context: context as PreparedCatalog['context'] };
  };

  const validateSessionCatalog = async (
    session: ActiveListeningSession
  ): Promise<SessionValidationResult> => {
    const validation = validateSession(session);
    if (validation.status !== 'valid') return validation;

    try {
      const catalog = await buildListeningSegmentCatalog({
        learningCues: validation.context.learning.cues,
        learningDelaySeconds: validation.context.learning.delaySeconds,
        sourceKey: validation.context.learning.sourceKey,
        supportCues: validation.context.support?.cues,
        supportDelaySeconds: validation.context.support?.delaySeconds,
      });
      if (activeSession !== session) return { status: 'stale' };
      const latestValidation = validateSession(session);
      if (latestValidation.status !== 'valid') return latestValidation;
      const currentIndices = session.selectedSegments.map(({ segmentKey }) =>
        catalog.findIndex((segment) => segment.segmentKey === segmentKey)
      );
      if (
        currentIndices.some((index) => index < 0) ||
        currentIndices.some(
          (index, position) => position > 0 && index !== currentIndices[position - 1] + 1
        )
      ) {
        return { status: 'segment-unavailable' };
      }
      return latestValidation;
    } catch {
      return { status: 'error' };
    }
  };

  const handleTerminalValidation = async (
    session: ActiveListeningSession,
    status: Exclude<SessionValidationResult['status'], 'valid'>
  ) => {
    if (status === 'error') return;
    if (activeSession !== session) return;
    let context: ListeningSessionContext;
    try {
      context = dependencies.readContext();
    } catch {
      abandonSessionWithoutSeeking(session);
      return;
    }
    if (canSafelyRestoreCapturedVideo(session, context)) {
      await finishSession(session, 'restore-start', false);
      return;
    }
    stopAndReleaseSessionWithoutSeeking(session, context);
  };

  const heartbeat = async (
    params: HeartbeatListeningSessionParams
  ): Promise<HeartbeatListeningSessionResponse> => {
    const parsedParams = heartbeatParamsSchema.safeParse(params);
    if (!parsedParams.success) return { status: 'error' };
    const request = parsedParams.data;
    const session = activeSession;
    if (!session || session.sessionId !== request.sessionId) return { status: 'stale' };
    if (
      !isSameIdentity(request.expectedIdentity, session.context.identity) ||
      request.expectedSubtitleRevision !== session.context.subtitleRevision
    ) {
      return { status: 'stale' };
    }

    if (session.suspendedForAdvertisement) {
      session.lastHeartbeatAt = now();
      scheduleLease(session);
      return { status: 'alive' };
    }

    // Canonical source/cue mutations always increment subtitleRevision. Keep the
    // five-second heartbeat cheap; begin and explicit saves own catalog rebuilds.
    const validation = validateSession(session);
    if (validation.status !== 'valid') {
      await handleTerminalValidation(session, validation.status);
      return { status: validation.status };
    }

    session.lastHeartbeatAt = now();
    scheduleLease(session);
    return { status: 'alive' };
  };

  const play = async (
    params: PlayListeningSegmentParams
  ): Promise<PlayListeningSegmentResponse> => {
    const parsedParams = playParamsSchema.safeParse(params);
    if (!parsedParams.success) return { status: 'error' };
    const request = parsedParams.data;
    const session = activeSession;
    if (!session || session.sessionId !== request.sessionId) return { status: 'stale' };
    if (session.suspendedForAdvertisement) return { status: 'suspended' };
    if (session.pendingEndMode !== null || session.endRetryRequired) {
      return { status: 'error' };
    }

    const validation = validateSession(session);
    if (validation.status !== 'valid') {
      await handleTerminalValidation(session, validation.status);
      return { status: validation.status };
    }
    const segment = session.selectedSegments.find(
      ({ segmentKey }) => segmentKey === request.segmentKey
    );
    if (!segment) {
      await handleTerminalValidation(session, 'segment-unavailable');
      return { status: 'segment-unavailable' };
    }

    supersedeActiveClip();
    return startClip(session, segment, request.rate);
  };

  const startClip = (
    session: ActiveListeningSession,
    segment: ListeningPracticeSegment,
    rate: 1 | 0.75
  ): Promise<PlayListeningSegmentResponse> => {
    const video = session.video;
    const catalogIndex = session.catalog.findIndex(
      ({ segmentKey }) => segmentKey === segment.segmentKey
    );
    const nextSegment = session.catalog[catalogIndex + 1];
    const stopMs = getClipStopMs(segment, nextSegment);
    const startSeconds = Math.max(0, segment.startMs - LISTENING_CLIP_PREROLL_MS) / 1000;
    const stopSeconds = Math.max(0, stopMs) / 1000;
    const generation = ++clipGeneration;

    return new Promise((resolve) => {
      let settled = false;
      let frameCallbackId: number | null = null;
      let pauseRequested = false;
      let playbackStarted = false;
      let seekPrepared = false;

      const cleanup = () => {
        video.removeEventListener('canplay', onReady);
        video.removeEventListener('loadedmetadata', onReady);
        video.removeEventListener('error', onMediaError);
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('timeupdate', onTimeUpdate);
        video.removeEventListener('ended', onEnded);
        video.removeEventListener('pause', onPause);
        if (frameCallbackId !== null && 'cancelVideoFrameCallback' in video) {
          video.cancelVideoFrameCallback(frameCallbackId);
        }
        frameCallbackId = null;
      };

      const settle = (result: PlayListeningSegmentResponse) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (activeClip?.generation === generation) activeClip = null;
        resolve(result);
      };

      const isLive = () => {
        if (activeSession !== session || activeClip?.generation !== generation) return false;
        let context: ListeningSessionContext;
        try {
          context = dependencies.readContext();
        } catch {
          abandonSessionWithoutSeeking(session);
          return false;
        }
        if (isSessionContextCurrent(session, context)) {
          return true;
        }
        if (canSafelyRestoreCapturedVideo(session, context)) {
          void finishSession(session, 'restore-start', false);
        } else {
          stopAndReleaseSessionWithoutSeeking(session, context);
        }
        return false;
      };

      const settlePlayedAtStop = () => {
        try {
          video.currentTime = stopSeconds;
        } catch {
          settle({ status: 'error' });
          return;
        }
        session.lastPracticedEndpoint = stopSeconds;
        settle({ status: 'played' });
      };

      const completeAtStop = () => {
        if (!isLive()) {
          settle({ status: 'stale' });
          return;
        }
        pauseRequested = true;
        video.pause();
        if (!settled) settlePlayedAtStop();
      };

      const checkTime = () => {
        if (!isLive()) {
          settle({ status: 'stale' });
          return;
        }
        if (video.currentTime * 1000 >= stopMs) completeAtStop();
      };

      const scheduleFrame = () => {
        if (settled || !('requestVideoFrameCallback' in video)) return;
        frameCallbackId = video.requestVideoFrameCallback(() => {
          frameCallbackId = null;
          checkTime();
          scheduleFrame();
        });
      };

      function onReady() {
        if (!isLive()) {
          settle({ status: 'stale' });
          return;
        }
        prepareSeek();
      }

      function onSeeked() {
        if (!isLive()) {
          settle({ status: 'stale' });
          return;
        }
        if (video.seeking || Math.abs(video.currentTime - startSeconds) > 0.001) return;
        video.removeEventListener('seeked', onSeeked);
        startPlayback();
      }

      function onMediaError() {
        settle({ status: 'error' });
      }

      function onTimeUpdate() {
        checkTime();
      }

      function onEnded() {
        if (!isLive()) {
          settle({ status: 'stale' });
          return;
        }
        video.removeEventListener('pause', onPause);
        video.pause();
        session.lastPracticedEndpoint = video.currentTime;
        settle({ status: 'played' });
      }

      function onPause() {
        if (pauseRequested || video.currentTime * 1000 >= stopMs) {
          settlePlayedAtStop();
          return;
        }
        settle({ status: 'error' });
      }

      function prepareSeek() {
        if (seekPrepared) return;
        seekPrepared = true;
        video.removeEventListener('canplay', onReady);
        video.removeEventListener('loadedmetadata', onReady);
        try {
          video.currentTime = startSeconds;
          video.playbackRate = rate;
        } catch {
          settle({ status: 'error' });
          return;
        }

        if (video.seeking) {
          video.addEventListener('seeked', onSeeked);
          return;
        }
        startPlayback();
      }

      function startPlayback() {
        if (playbackStarted) return;
        playbackStarted = true;

        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('ended', onEnded);
        video.addEventListener('pause', onPause);
        void video.play().then(
          () => {
            if (!isLive()) {
              settle({ status: 'stale' });
              return;
            }
            checkTime();
            scheduleFrame();
          },
          () => {
            video.pause();
            settle({ status: 'error' });
          }
        );
      }

      activeClip = { cleanup, generation, settle };
      video.addEventListener('error', onMediaError);
      if (video.readyState >= 1) prepareSeek();
      else {
        video.addEventListener('canplay', onReady);
        video.addEventListener('loadedmetadata', onReady);
      }
    });
  };

  const save = async (
    params: SaveListeningSegmentParams
  ): Promise<SaveListeningSegmentResponse> => {
    const parsedParams = saveParamsSchema.safeParse(params);
    if (!parsedParams.success) return { status: 'error' };
    const request = parsedParams.data;
    const session = activeSession;
    if (!session || session.sessionId !== request.sessionId) return { status: 'stale' };
    if (session.suspendedForAdvertisement) return { status: 'busy' };
    if (session.pendingEndMode !== null || session.endRetryRequired) {
      return { status: 'error' };
    }

    const validation = await validateSessionCatalog(session);
    if (validation.status !== 'valid') {
      await handleTerminalValidation(session, validation.status);
      return { status: validation.status };
    }
    if (activeSession !== session) return { status: 'stale' };
    if (session.pendingEndMode !== null || session.endRetryRequired) {
      return { status: 'error' };
    }
    const segment = session.selectedSegments.find(
      ({ segmentKey }) => segmentKey === request.segmentKey
    );
    if (!segment) {
      await handleTerminalValidation(session, 'segment-unavailable');
      return { status: 'segment-unavailable' };
    }

    let unavailableStatus: 'stale' | 'no-video' | 'segment-unavailable' | 'error' =
      'segment-unavailable';
    let supportIncluded = false;
    let result: LearningCardSaveResult;
    try {
      result = await saveCard(() => {
        const current = validateSession(session);
        if (current.status !== 'valid') {
          unavailableStatus = current.status;
          return null;
        }
        const built = buildLearningCardFromListeningSegment({
          answerText: segment.answerText,
          ...(segment.alignedSupport ? { supportText: segment.alignedSupport.text } : {}),
          startMs: segment.startMs,
          endMs: segment.endMs,
          learningLanguage: current.context.learning.language,
          supportLanguage: current.context.support?.language ?? null,
          url: current.context.watchedUrl,
        });
        if (built.status !== 'created') return null;
        supportIncluded = 'support' in built.card.content;
        return built.card;
      });
    } catch {
      return { status: 'error' };
    }

    if (activeSession !== session) return { status: 'stale' };
    const completionValidation = validateSession(session);
    if (completionValidation.status !== 'valid') {
      await handleTerminalValidation(session, completionValidation.status);
      return { status: completionValidation.status };
    }

    if (result.status === 'busy') return { status: 'busy' };
    if (result.status === 'error') return { status: 'error' };
    if (result.status === 'card-unavailable') {
      await handleTerminalValidation(session, unavailableStatus);
      return { status: unavailableStatus };
    }
    return { status: supportIncluded ? 'saved-with-support' : 'saved-learning-only' };
  };

  const end = async (
    params: EndListeningSessionParams
  ): Promise<EndListeningSessionResponse> => {
    const parsedParams = endParamsSchema.safeParse(params);
    if (!parsedParams.success) return { status: 'error' };
    const request = parsedParams.data;
    const session = activeSession;
    if (!session) {
      return endedSessionIds.has(request.sessionId)
        ? { status: 'already-ended' }
        : { status: 'stale' };
    }
    if (session.sessionId !== request.sessionId) return { status: 'stale' };
    if (session.suspendedForAdvertisement) {
      abandonSessionWithoutSeeking(session);
      return { status: 'ended' };
    }
    if (session.pendingEndMode !== null && session.pendingEndMode !== request.mode) {
      return { status: 'error' };
    }

    const validation = validateSession(session);
    if (validation.status !== 'valid') {
      if (validation.status === 'error') return { status: 'error' };
      await handleTerminalValidation(session, validation.status);
      return { status: validation.status === 'no-video' ? 'no-video' : 'stale' };
    }
    return finishSession(session, request.mode, true);
  };

  const dispose = () => {
    const session = activeSession;
    if (!session) return;
    let context: ListeningSessionContext;
    try {
      context = dependencies.readContext();
    } catch {
      abandonSessionWithoutSeeking(session);
      return;
    }
    if (!canSafelyRestoreCapturedVideo(session, context)) {
      stopAndReleaseSessionWithoutSeeking(session, context);
      return;
    }
    void finishSession(session, 'restore-start', false);
  };

  const handlePlaybackContextChange = () => {
    const session = activeSession;
    if (!session) return;
    let context: ListeningSessionContext;
    try {
      context = dependencies.readContext();
    } catch {
      abandonSessionWithoutSeeking(session);
      return;
    }
    const sameFrozenContext = isSameFrozenContext(session.context, context);
    const lifecycle = context.playbackContext.lifecycle;
    if (lifecycle === 'advertisement' || lifecycle === 'transitioning') {
      if (!sameFrozenContext) {
        abandonSessionWithoutSeeking(session);
        return;
      }
      if (!session.suspendedForAdvertisement) {
        session.suspendedForAdvertisement = true;
        suspendActiveClip();
      }
      return;
    }
    if (session.suspendedForAdvertisement) {
      if (!sameFrozenContext || !isSupportedPlaybackKind(context.playbackContext.routeKind)) {
        abandonSessionWithoutSeeking(session);
      }
      return;
    }
    if (!context.playbackContext.learningAvailable) {
      stopAndReleaseSessionWithoutSeeking(session, context);
      return;
    }
    if (!isSessionContextCurrent(session, context)) {
      if (canSafelyRestoreCapturedVideo(session, context)) {
        emergencyRestoreAndRelease(session);
        return;
      }
      stopAndReleaseSessionWithoutSeeking(session, context);
    }
  };

  const resumeAfterAdvertisement = async (
    params: ResumeListeningSessionParams
  ): Promise<ResumeListeningSessionAfterAdvertisementResponse> => {
    const parsed = resumeParamsSchema.safeParse(params);
    if (!parsed.success) return { status: 'error' };
    const session = activeSession;
    if (!session || session.sessionId !== parsed.data.sessionId) return { status: 'stale' };
    if (
      !session.suspendedForAdvertisement ||
      !isSameIdentity(parsed.data.expectedIdentity, session.context.identity) ||
      parsed.data.expectedSubtitleRevision !== session.context.subtitleRevision
    ) {
      return { status: 'stale' };
    }
    let context: ListeningSessionContext;
    try {
      context = dependencies.readContext();
    } catch {
      return { status: 'error' };
    }
    if (!context.video || !dependencies.isCurrentVideo(context.video)) {
      return { status: 'no-video' };
    }
    if (
      !context.playbackContext.learningAvailable ||
      !isSameFrozenContext(session.context, context)
    ) {
      abandonSessionWithoutSeeking(session);
      return { status: 'stale' };
    }
    session.context = context as ReadyListeningSessionContext;
    session.video = context.video;
    session.suspendedForAdvertisement = false;
    session.lastHeartbeatAt = now();
    scheduleLease(session);
    return {
      status: 'resumed',
      identity: cloneIdentity(context.identity),
      subtitleRevision: context.subtitleRevision,
    };
  };

  const isAdvertisementResumeRequired = () =>
    activeSession?.suspendedForAdvertisement === true;

  return {
    getCatalog,
    begin,
    heartbeat,
    play,
    save,
    end,
    handlePlaybackContextChange,
    isAdvertisementResumeRequired,
    resumeAfterAdvertisement,
    dispose,
  };
};

const cloneIdentity = (identity: ContentVideoIdentity): ContentVideoIdentity => ({
  contentEpoch: identity.contentEpoch,
  contentInstanceId: identity.contentInstanceId,
  routeChangedAt: identity.routeChangedAt,
  videoId: identity.videoId,
  videoRevision: identity.videoRevision,
});

const isSameIdentity = (left: ContentVideoIdentity, right: ContentVideoIdentity) =>
  left.contentEpoch === right.contentEpoch &&
  left.contentInstanceId === right.contentInstanceId &&
  left.routeChangedAt === right.routeChangedAt &&
  left.videoId === right.videoId &&
  left.videoRevision === right.videoRevision;

const isSameFrozenContext = (
  left: ListeningSessionContext,
  right: ListeningSessionContext
) =>
  left.identity.contentEpoch === right.identity.contentEpoch &&
  left.identity.contentInstanceId === right.identity.contentInstanceId &&
  left.identity.routeChangedAt === right.identity.routeChangedAt &&
  left.identity.videoId === right.identity.videoId &&
  left.subtitleRevision === right.subtitleRevision &&
  left.learning?.sourceKey === right.learning?.sourceKey &&
  left.playbackContext.subtitleIdentity.support ===
    right.playbackContext.subtitleIdentity.support;

const isSupportedPlaybackKind = (kind: PlaybackContextStatus['routeKind']) =>
  kind === 'movie' || kind === 'episode';

const isSameCatalogContext = (
  left: ListeningSessionContext,
  right: ListeningSessionContext
) =>
  left.video === right.video &&
  isSameIdentity(left.identity, right.identity) &&
  left.subtitleRevision === right.subtitleRevision &&
  left.learning?.sourceKey === right.learning?.sourceKey;

const selectRequestedSegments = (
  catalog: readonly ListeningPracticeSegment[],
  segmentKeys: readonly string[]
): readonly ListeningPracticeSegment[] | null => {
  if (segmentKeys.length < 1 || segmentKeys.length > 10) return null;
  if (new Set(segmentKeys).size !== segmentKeys.length) return null;
  const indices = segmentKeys.map((segmentKey) =>
    catalog.findIndex((segment) => segment.segmentKey === segmentKey)
  );
  if (indices.some((index) => index < 0)) return null;
  if (indices.some((index, position) => position > 0 && index !== indices[position - 1] + 1)) {
    return null;
  }
  return Object.freeze(indices.map((index) => catalog[index]));
};

const freezeCatalog = (
  catalog: ListeningPracticeSegment[]
): readonly ListeningPracticeSegment[] =>
  Object.freeze(
    catalog.map((segment) =>
      Object.freeze({
        ...segment,
        cleanedTextParts: Object.freeze([...segment.cleanedTextParts]),
        sourceIndices: Object.freeze([...segment.sourceIndices]),
        ...(segment.alignedSupport
          ? {
              alignedSupport: Object.freeze({
                sourceIndices: Object.freeze([...segment.alignedSupport.sourceIndices]),
                text: segment.alignedSupport.text,
              }),
            }
          : {}),
      })
    )
  ) as unknown as readonly ListeningPracticeSegment[];

const createImmutableSnapshot = (
  context: PreparedCatalog['context'],
  segments: readonly ListeningPracticeSegment[]
): ListeningSessionSnapshot => {
  const snapshot = {
    learningLanguage: context.learning.language,
    videoId: context.identity.videoId,
    sourceKey: context.learning.sourceKey,
    segmenterVersion: LISTENING_SEGMENTER_VERSION,
    segments: segments.map((segment) =>
      Object.freeze({
        segmentKey: segment.segmentKey,
        sourceKey: segment.sourceKey,
        sourceIndices: Object.freeze([...segment.sourceIndices]),
        startMs: segment.startMs,
        endMs: segment.endMs,
        answerText: segment.answerText,
        ...(segment.alignedSupport
          ? {
              alignedSupport: Object.freeze({
                sourceIndices: Object.freeze([...segment.alignedSupport.sourceIndices]),
                text: segment.alignedSupport.text,
              }),
            }
          : {}),
      })
    ),
  };
  Object.freeze(snapshot.segments);
  return Object.freeze(snapshot) as ListeningSessionSnapshot;
};

const createUniqueSessionId = (
  createSessionId: () => string,
  endedSessionIds: ReadonlySet<string>
) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const sessionId = createSessionId();
    if (sessionId.length > 0 && !endedSessionIds.has(sessionId)) return sessionId;
  }
  throw new Error('Unable to create an opaque listening session ID');
};

const getClipStopMs = (
  segment: ListeningPracticeSegment,
  nextSegment: ListeningPracticeSegment | undefined
) => {
  const postrollEnd = segment.endMs + LISTENING_CLIP_POSTROLL_MS;
  if (!nextSegment) return postrollEnd;
  return Math.max(segment.endMs, Math.min(postrollEnd, nextSegment.startMs));
};
