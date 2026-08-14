import { getRegisteredSubtitles } from '@storage/registered-subtitle';
import { getLocalSubtitle } from '@storage/subtitle';
import { languageSchema, subtitleCueSchema } from '@storage/v2/schema';
import type { V2SubtitleCue } from '@storage/v2/type';
import { COUPANG_PLAY_VIDEO_URL_LIST, type Language } from '@utils/constants';
import { getCoupangPlayVideoId } from '@utils/coupang-play';
import { t } from '@utils/i18n';
import { AsyncMessageResponse, onMessage, sendMessage } from '@utils/message';
import type {
  ContentBootstrap,
  ContentVideoIdentity,
  MessageSchema,
  SubtitleOverviewResponse,
  SubtitleOverviewSource,
  SubtitleRole,
  VideoTimeResponse,
} from '@utils/message/type';
import type { PlaybackContextStatus, PlaybackSubtitleIdentity } from '@utils/playback-context';

import {
  createNativeListeningSourceKey,
  createRegisteredListeningSourceKey,
} from '@/listening/domain/source-identity';

import { elementStore } from './core/store/element-store';
import { useVideoStore } from './core/store/video-store';
import { videoManager } from './core/video/video-manager';
import { coupangStrategy } from './coupang-play';
import { buildLearningCardFromResolvedCue } from './features/learning-playback/learning-card-builder';
import { saveLearningCard } from './features/learning-playback/learning-card-save-coordinator';
import { resolveCue } from './features/learning-playback/learning-playback';
import {
  createListeningSessionCoordinator,
  type ListeningSessionContext,
  type ListeningSessionCoordinator,
} from './features/listening-session/listening-session-coordinator';
import { isListeningMissionActive } from './features/listening-session/mission-active-store';
import {
  createLearningSubtitleOverviewCues,
  createSubtitleOverviewCues,
} from './features/subtitle/subtitle-overview';
import { selectSubtitleTrack, useSubtitleStore } from './features/subtitle/subtitle-store';
import { PlaybackContextController } from './playback-context/playback-context-controller';
import { usePlaybackContextStore } from './playback-context/playback-context-store';
import { VideoLifecycleEvent, VideoLifecycleMonitor } from './video-lifecycle/video-lifecycle-monitor';

export type VideoLifecycleDependencies = {
  getVideo: () => HTMLVideoElement | null;
  isCurrentVideo: (video: HTMLVideoElement) => boolean;
  setVideo: (video: HTMLVideoElement) => void;
  clearVideo: () => void;
  clearNativeCues: () => void;
  setupContainer: () => void;
  resetElements: () => void;
  setCurrentTime: (time: number) => void;
  setDetectionStatus: (status: 'idle' | 'detecting' | 'detected' | 'failed') => void;
  reportContentStatus: (
    hasVideo: boolean,
    lifecycle: VideoLifecycleEvent['state'],
    videoRevision: number,
    videoId: string | null
  ) => void;
};

export const createVideoLifecycleHandler = (dependencies: VideoLifecycleDependencies) => {
  let videoRevision = 0;

  return (event: VideoLifecycleEvent) => {
    if (event.state === 'content' && event.video) {
      if (!dependencies.isCurrentVideo(event.video)) {
        videoRevision += 1;
        if (dependencies.getVideo()) {
          dependencies.clearNativeCues();
          dependencies.resetElements();
          dependencies.setCurrentTime(0);
        }
        dependencies.setVideo(event.video);
        dependencies.setupContainer();
      }
      dependencies.setDetectionStatus('detected');
      dependencies.reportContentStatus(true, event.state, videoRevision, event.videoId);
      return;
    }

    if (dependencies.getVideo()) {
      videoRevision += 1;
      dependencies.clearVideo();
      if (event.state !== 'advertisement' && event.state !== 'transitioning') {
        dependencies.clearNativeCues();
      }
      dependencies.resetElements();
      dependencies.setCurrentTime(0);
    }
    dependencies.setDetectionStatus(event.delayed ? 'failed' : 'detecting');
    dependencies.reportContentStatus(false, event.state, videoRevision, event.videoId);
  };
};

type MessageListenerDependencies = {
  createVideoLifecycleMonitor: () => VideoLifecycleMonitor;
  listeningSessionCoordinator?: ListeningSessionCoordinator;
  registerMessageListener: typeof onMessage;
};

const defaultMessageListenerDependencies: MessageListenerDependencies = {
  createVideoLifecycleMonitor: () => new VideoLifecycleMonitor(),
  registerMessageListener: onMessage,
};

let activeVideoLifecycleMonitor: VideoLifecycleMonitor | null = null;
const contentInstanceId = crypto.randomUUID();
export const playbackContextController = new PlaybackContextController(
  contentInstanceId,
  window.location.href,
  () => Date.now()
);
let latestNativeSubtitleRequestId: string | null = null;
const listeningSessionCoordinator = createListeningSessionCoordinator({
  readContext: createListeningSessionContext,
  isIdentityCurrent: (identity) =>
    isLiveVideoIdentityCurrent(identity) &&
    isSameContentVideoIdentity(identity, createContentVideoIdentity()),
  isCurrentVideo: (video) => videoManager.isCurrent(video),
});

export function initializeMessageListener(dependencies = defaultMessageListenerDependencies) {
  const sessionCoordinator =
    dependencies.listeningSessionCoordinator ?? listeningSessionCoordinator;
  const videoLifecycleMonitor = dependencies.createVideoLifecycleMonitor();
  const registration = dependencies.registerMessageListener(({ message, params, sendResponse }) => {
    switch (message) {
      case 'resetElement':
        handleResetElement();
        break;
      case 'detectVideo':
        sendResponse(toDetectionResponse(videoLifecycleMonitor.refresh()));
        break;
      case 'fetchVideoMetadata':
        return respond(sendResponse, () => handleFetchVideoMetadata(params));
      case 'playVideo':
        sendResponse({ success: true, data: handlePlayVideo(params) });
        break;
      case 'setSubtitleRole':
        return respond(sendResponse, () => handleSetSubtitleRole(params.role, params.subtitleId));
      case 'refreshRegisteredSubtitle':
        return respond(sendResponse, () => handleRefreshRegisteredSubtitle(params.subtitleId));
      case 'getSubtitleOverview':
        sendResponse({ success: true, data: handleGetSubtitleOverview() });
        break;
      case 'saveSubtitleOverviewCue':
        return respond(sendResponse, () => handleSaveSubtitleOverviewCue(params));
      case 'getVideoTime':
        sendResponse({ success: true, data: handleGetVideoTime() });
        break;
      case 'getListeningCatalog':
        if (params !== undefined) {
          sendResponse({ success: true, data: { status: 'error' } });
          break;
        }
        return respond(sendResponse, () => sessionCoordinator.getCatalog());
      case 'beginListeningSession':
        return respond(sendResponse, () => sessionCoordinator.begin(params));
      case 'heartbeatListeningSession':
        return respond(sendResponse, () => sessionCoordinator.heartbeat(params));
      case 'resumeListeningSessionAfterAdvertisement':
        return respond(sendResponse, async () => {
          const result = await sessionCoordinator.resumeAfterAdvertisement(params);
          reportCurrentContentStatus();
          return result;
        });
      case 'playListeningSegment':
        return respond(sendResponse, () => sessionCoordinator.play(params));
      case 'saveListeningSegment':
        return respond(sendResponse, () => sessionCoordinator.save(params));
      case 'endListeningSession':
        return respond(sendResponse, () => sessionCoordinator.end(params));
      case 'pingContent':
        sendResponse({
          success: true,
          data: {
            ...createPlaybackContextStatus(),
            hasVideo: Boolean(videoManager.get()),
          },
        });
        break;
    }
  });
  const subtitleSubscription = useSubtitleStore.subscribe((state, previousState) => {
    if (state.subtitleRevision === previousState.subtitleRevision) return;
    listeningSessionCoordinator.handlePlaybackContextChange();
    reportCurrentContentStatus();
  });

  try {
    videoLifecycleMonitor.start(handleVideoLifecycle);
    activeVideoLifecycleMonitor = videoLifecycleMonitor;
  } catch (error) {
    registration.remove();
    videoLifecycleMonitor.stop();
    subtitleSubscription();
    sessionCoordinator.dispose();
    throw error;
  }

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    registration.remove();
    videoLifecycleMonitor.stop();
    sessionCoordinator.dispose();
    if (activeVideoLifecycleMonitor === videoLifecycleMonitor) activeVideoLifecycleMonitor = null;
  };
}

export const initializeSubtitleSelections = async (bootstrap: ContentBootstrap) => {
  await handleSetSubtitleRole('learning', bootstrap.learningSubtitleId);
  await handleSetSubtitleRole('support', bootstrap.supportSubtitleId);
};

export const retryVideoDetection = () => {
  const event = activeVideoLifecycleMonitor?.refresh();
  return Promise.resolve(
    event ? toDetectionResponse(event) : { success: false as const, message: t('error_video_not_found') }
  );
};

const handleResetElement = () => {
  elementStore.reset();
};

const handleFetchVideoMetadata = async ({
  expectedIdentity,
  headers,
  requestId,
  url,
  videoId,
}: MessageSchema['fetchVideoMetadata']['params']) => {
  if (!isValidContentVideoIdentity(expectedIdentity)) return;
  latestNativeSubtitleRequestId = requestId;
  const subtitles = await coupangStrategy.fetchSubtitles(url, headers);
  if (
    latestNativeSubtitleRequestId !== requestId ||
    videoId === null ||
    getCoupangPlayVideoId(window.location.href) !== videoId ||
    !playbackContextController.observePlaybackEvidence({ expectedIdentity, playbackUrl: url })
  ) {
    return;
  }
  const store = useSubtitleStore.getState();
  let tracks: { cues: V2SubtitleCue[]; language: Language }[];
  try {
    tracks = subtitles.flatMap((subtitle) => {
      const language = languageSchema.safeParse(subtitle.lang);
      if (!language.success) return [];
      return [{ language: language.data, cues: subtitleCueSchema.array().parse(subtitle.subtitleData) }];
    });
  } catch (error) {
    store.clearNativeCues();
    throw error;
  }
  if (areNativeSubtitleTracksEqual(store.nativeCueCache, tracks)) return;
  store.clearNativeCues();
  for (const { cues, language } of tracks) {
    store.setNativeCues(language, cues);
  }
  listeningSessionCoordinator.handlePlaybackContextChange();
  reportCurrentContentStatus();
};

const areNativeSubtitleTracksEqual = (
  cache: Partial<Record<Language, V2SubtitleCue[]>>,
  tracks: readonly { cues: V2SubtitleCue[]; language: Language }[]
) => {
  const next = new Map(tracks.map(({ cues, language }) => [language, cues]));
  const cachedLanguages = Object.keys(cache) as Language[];
  if (cachedLanguages.length !== next.size) return false;
  return cachedLanguages.every((language) => {
    const cachedCues = cache[language];
    const nextCues = next.get(language);
    return (
      cachedCues !== undefined &&
      nextCues !== undefined &&
      cachedCues.length === nextCues.length &&
      cachedCues.every((cue, index) => areSubtitleCuesEqual(cue, nextCues[index]))
    );
  });
};

const areSubtitleCuesEqual = (left: V2SubtitleCue, right: V2SubtitleCue) =>
  left.start === right.start &&
  left.end === right.end &&
  left.text === right.text &&
  (left.settings?.length ?? 0) === (right.settings?.length ?? 0) &&
  (left.settings ?? []).every((setting, index) => setting === right.settings?.[index]);

const handlePlayVideo = ({
  expectedIdentity,
  expectedSubtitleRevision,
  startTime,
}: MessageSchema['playVideo']['params']): MessageSchema['playVideo']['response'] => {
  if (isListeningMissionActive()) return { status: 'stale' };
  if (!isValidContentVideoIdentity(expectedIdentity)) return { status: 'stale' };
  if (!createPlaybackContextStatus().learningAvailable) return { status: 'stale' };
  if (isGuardedRequestStale(expectedIdentity, expectedSubtitleRevision)) return { status: 'stale' };

  const video = videoManager.get();
  if (!video) return { status: 'no-video' };
  if (video.readyState >= 3) video.currentTime = startTime;
  else {
    video.addEventListener(
      'canplay',
      () => {
        const guarded = expectedIdentity !== undefined || expectedSubtitleRevision !== undefined;
        if (
          isListeningMissionActive() ||
          (guarded &&
            (videoManager.get() !== video ||
              isGuardedRequestStale(expectedIdentity, expectedSubtitleRevision)))
        ) {
          return;
        }
        video.currentTime = startTime;
      },
      { once: true }
    );
  }
  return { status: 'played' };
};

const handleSetSubtitleRole = async (role: SubtitleRole, subtitleId: string | null) => {
  const store = useSubtitleStore.getState();
  if (subtitleId === null) {
    store.clearRegisteredSelection(role);
    return;
  }

  const metadata = (await getRegisteredSubtitles()).find((subtitle) => subtitle.id === subtitleId);
  if (!metadata) throw new Error('Registered subtitle is unavailable');
  const expectedLanguage =
    role === 'learning' ? store.learningProfile.learningLanguage : store.learningProfile.supportLanguage;
  if (expectedLanguage === null || metadata.language !== expectedLanguage) {
    throw new Error('Registered subtitle language does not match this role');
  }
  const cues = await getLocalSubtitle(metadata.id);
  store.setRegisteredSelection(role, {
    subtitleId: metadata.id,
    cues,
    delay: metadata.delay ?? 0,
  });
};

const handleRefreshRegisteredSubtitle = async (subtitleId: string) => {
  const state = useSubtitleStore.getState();
  for (const role of ['learning', 'support'] as const) {
    if (state.registeredSelections[role]?.subtitleId === subtitleId) {
      await handleSetSubtitleRole(role, subtitleId);
    }
  }
};

const handleGetSubtitleOverview = (): SubtitleOverviewResponse => {
  const identity = createContentVideoIdentity();
  if (
    !isLiveVideoIdentityCurrent(identity) ||
    !createPlaybackContextStatus().learningAvailable
  ) {
    return { status: 'no-video', identity };
  }
  const video = videoManager.get();
  if (!video) return { status: 'no-video', identity };

  const state = useSubtitleStore.getState();
  const learningLanguage = state.learningProfile.learningLanguage;
  const learningTrack = selectSubtitleTrack(state, 'learning');
  const supportLanguage = state.learningProfile.supportLanguage;
  const supportTrack = supportLanguage === null ? null : selectSubtitleTrack(state, 'support');

  return {
    status: 'ready',
    identity,
    subtitleRevision: state.subtitleRevision,
    currentTime: video.currentTime,
    tracks: {
      learning: {
        role: 'learning',
        language: learningLanguage,
        source: createSubtitleOverviewSource(
          learningLanguage,
          learningTrack.delay,
          state.registeredSelections.learning?.subtitleId
        ),
        cues: createLearningSubtitleOverviewCues(
          learningTrack.cues,
          learningTrack.delay,
          supportTrack?.cues,
          supportTrack?.delay
        ),
      },
      support:
        supportLanguage === null || supportTrack === null
          ? null
          : {
              role: 'support',
              language: supportLanguage,
              source: createSubtitleOverviewSource(
                supportLanguage,
                supportTrack.delay,
                state.registeredSelections.support?.subtitleId
              ),
              cues: createSubtitleOverviewCues(supportTrack.cues, supportTrack.delay),
            },
    },
  };
};

const createSubtitleOverviewSource = (
  language: SubtitleOverviewSource['language'],
  delaySeconds: number,
  subtitleId: string | undefined
): SubtitleOverviewSource =>
  subtitleId
    ? { kind: 'registered', language, subtitleId, delaySeconds }
    : { kind: 'native', language };

const handleGetVideoTime = (): VideoTimeResponse => {
  const identity = createContentVideoIdentity();
  if (
    !isLiveVideoIdentityCurrent(identity) ||
    !createPlaybackContextStatus().learningAvailable
  ) {
    return { status: 'no-video', identity };
  }
  const video = videoManager.get();
  if (!video) return { status: 'no-video', identity };
  return {
    status: 'ready',
    identity,
    subtitleRevision: useSubtitleStore.getState().subtitleRevision,
    currentTime: video.currentTime,
  };
};

const handleSaveSubtitleOverviewCue = async ({
  expectedIdentity,
  expectedSubtitleRevision,
  learningSourceIndex,
}: MessageSchema['saveSubtitleOverviewCue']['params']): Promise<
  MessageSchema['saveSubtitleOverviewCue']['response']
> => {
  if (
    !isValidContentVideoIdentity(expectedIdentity) ||
    !isValidSubtitleRevision(expectedSubtitleRevision)
  ) {
    return { status: 'stale' };
  }

  let unavailableStatus: 'stale' | 'no-video' | 'cue-unavailable' = 'cue-unavailable';
  let supportIncluded = false;

  const result = await saveLearningCard(() => {
    if (isGuardedRequestStale(expectedIdentity, expectedSubtitleRevision)) {
      unavailableStatus = 'stale';
      return null;
    }
    if (!videoManager.get()) {
      unavailableStatus = 'no-video';
      return null;
    }
    if (!Number.isInteger(learningSourceIndex) || learningSourceIndex < 0) return null;

    const state = useSubtitleStore.getState();
    const learningTrack = selectSubtitleTrack(state, 'learning');
    const learningCue = learningTrack.cues[learningSourceIndex];
    if (!learningCue) return null;

    const supportTrack =
      state.learningProfile.supportLanguage === null
        ? null
        : selectSubtitleTrack(state, 'support');
    const built = buildLearningCardFromResolvedCue({
      learningCue: resolveCue(learningCue, learningSourceIndex, learningTrack.delay),
      supportCues: supportTrack?.cues,
      supportDelaySeconds: supportTrack?.delay,
      learningLanguage: state.learningProfile.learningLanguage,
      supportLanguage: state.learningProfile.supportLanguage,
      url: window.location.href,
    });
    if (built.status !== 'created') return null;
    supportIncluded = 'support' in built.card.content && built.card.content.support !== undefined;
    return built.card;
  });

  if (result.status === 'busy') return { status: 'busy' };
  if (result.status === 'error') return { status: 'error' };
  if (result.status === 'card-unavailable') return { status: unavailableStatus };
  return { status: supportIncluded ? 'saved-with-support' : 'saved-learning-only' };
};

function createListeningSessionContext(): ListeningSessionContext {
  const state = useSubtitleStore.getState();
  const learningLanguage = state.learningProfile.learningLanguage;
  const learningTrack = selectSubtitleTrack(state, 'learning');
  const supportLanguage = state.learningProfile.supportLanguage;
  const supportTrack = selectSubtitleTrack(state, 'support');
  const learningSelection = state.registeredSelections.learning;

  return {
    identity: createContentVideoIdentity(),
    playbackContext: createPlaybackContextStatus(false),
    learning:
      learningLanguage === null || learningTrack.cues.length === 0
        ? null
        : {
            cues: learningTrack.cues,
            delaySeconds: learningTrack.delay,
            language: learningLanguage,
            sourceKey: learningSelection
              ? createRegisteredListeningSourceKey(learningSelection.subtitleId)
              : createNativeListeningSourceKey(learningLanguage),
          },
    subtitleRevision: state.subtitleRevision,
    support:
      supportLanguage === null || supportTrack.cues.length === 0
        ? null
        : {
            cues: supportTrack.cues,
            delaySeconds: supportTrack.delay,
            language: supportLanguage,
          },
    video: videoManager.get(),
    watchedUrl: window.location.href,
  };
}

const createContentVideoIdentity = (): ContentVideoIdentity =>
  playbackContextController.createIdentity();

const isValidContentVideoIdentity = (value: unknown): value is ContentVideoIdentity => {
  if (typeof value !== 'object' || value === null) return false;
  const identity = value as Partial<ContentVideoIdentity>;
  return (
    typeof identity.contentEpoch === 'number' &&
    Number.isSafeInteger(identity.contentEpoch) &&
    identity.contentEpoch >= 0 &&
    typeof identity.contentInstanceId === 'string' &&
    identity.contentInstanceId.length > 0 &&
    typeof identity.routeChangedAt === 'number' &&
    Number.isFinite(identity.routeChangedAt) &&
    identity.routeChangedAt >= 0 &&
    (identity.videoId === null ||
      (typeof identity.videoId === 'string' && identity.videoId.length > 0)) &&
    typeof identity.videoRevision === 'number' &&
    Number.isInteger(identity.videoRevision) &&
    identity.videoRevision >= 0
  );
};

const isValidSubtitleRevision = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

const isSameContentVideoIdentity = (
  left: ContentVideoIdentity,
  right: ContentVideoIdentity
) =>
  left.contentEpoch === right.contentEpoch &&
  left.contentInstanceId === right.contentInstanceId &&
  left.routeChangedAt === right.routeChangedAt &&
  left.videoId === right.videoId &&
  left.videoRevision === right.videoRevision;

const isGuardedRequestStale = (
  expectedIdentity: ContentVideoIdentity | undefined,
  expectedSubtitleRevision: number | undefined
) => {
  const guarded = expectedIdentity !== undefined || expectedSubtitleRevision !== undefined;
  if (!guarded) return false;

  const identity = createContentVideoIdentity();
  return (
    !isLiveVideoIdentityCurrent(identity) ||
    !createPlaybackContextStatus().learningAvailable ||
    (expectedIdentity !== undefined &&
      !isSameContentVideoIdentity(expectedIdentity, identity)) ||
    (expectedSubtitleRevision !== undefined &&
      expectedSubtitleRevision !== useSubtitleStore.getState().subtitleRevision)
  );
};

const isLiveVideoIdentityCurrent = (identity: ContentVideoIdentity) => {
  return (
    getCoupangPlayVideoId(window.location.href) === identity.videoId &&
    playbackContextController.isIdentityCurrent(identity)
  );
};

const reportContentStatus = (
  hasVideo: boolean,
  lifecycle: VideoLifecycleEvent['state'],
  videoRevision: number,
  videoId: string | null
) => {
  const { contentChanged } = playbackContextController.observeLifecycle({
    lifecycle,
    url: window.location.href,
    videoId,
    videoRevision,
  });
  if (contentChanged) latestNativeSubtitleRequestId = null;
  listeningSessionCoordinator.handlePlaybackContextChange();
  reportCurrentContentStatus();
};

const reportCurrentContentStatus = () => {
  const status = createPlaybackContextStatus();
  usePlaybackContextStore.getState().setStatus(status);
  const isVideoUrl = COUPANG_PLAY_VIDEO_URL_LIST.some((url) => window.location.href.startsWith(url));
  void sendMessage('contentStatus', {
    ...status,
    hasVideo: Boolean(videoManager.get()),
    isVideoUrl,
  });
};

const createPlaybackContextStatus = (
  missionResumeRequired = listeningSessionCoordinator.isAdvertisementResumeRequired()
): PlaybackContextStatus =>
  playbackContextController.createStatus({
    hasVideo: Boolean(videoManager.get()),
    missionResumeRequired,
    subtitleIdentity: createPlaybackSubtitleIdentity(),
    url: window.location.href,
  });

const createPlaybackSubtitleIdentity = (): PlaybackSubtitleIdentity => {
  const state = useSubtitleStore.getState();
  const learningLanguage = state.learningProfile.learningLanguage;
  const learningTrack = selectSubtitleTrack(state, 'learning');
  const supportLanguage = state.learningProfile.supportLanguage;
  const supportTrack = selectSubtitleTrack(state, 'support');
  return {
    learning:
      learningLanguage === null || learningTrack.cues.length === 0
        ? null
        : state.registeredSelections.learning
          ? `registered:${state.registeredSelections.learning.subtitleId}`
          : `native:${learningLanguage}`,
    subtitleRevision: state.subtitleRevision,
    support:
      supportLanguage === null || supportTrack.cues.length === 0
        ? null
        : state.registeredSelections.support
          ? `registered:${state.registeredSelections.support.subtitleId}`
          : `native:${supportLanguage}`,
  };
};

const handleVideoLifecycle = createVideoLifecycleHandler({
  getVideo: () => videoManager.get(),
  isCurrentVideo: (video) => videoManager.isCurrent(video),
  setVideo: (video) => videoManager.set(video),
  clearVideo: () => videoManager.clear(),
  clearNativeCues: () => useSubtitleStore.getState().clearNativeCues(),
  setupContainer: () => elementStore.setupContainer(),
  resetElements: () => elementStore.reset(),
  setCurrentTime: (time) => useVideoStore.getState().setCurrentTime(time),
  setDetectionStatus: (status) => useVideoStore.getState().setDetectionStatus(status),
  reportContentStatus,
});

const toDetectionResponse = (event: VideoLifecycleEvent) => {
  if (event.state === 'content') return { success: true as const };
  return { success: false as const, message: t('error_video_not_found') };
};

const respond = <T>(
  sendResponse: (response: AsyncMessageResponse<T>) => void,
  task: () => Promise<T>
) => {
  void task().then(
    (data) => sendResponse((data === undefined ? { success: true } : { success: true, data }) as AsyncMessageResponse<T>),
    () => sendResponse({ success: false, message: t('v2_content_action_failed') } as AsyncMessageResponse<T>)
  );
  return true as const;
};
