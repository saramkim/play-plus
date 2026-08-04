import { getRegisteredSubtitles } from '@storage/registered-subtitle';
import { getLocalSubtitle } from '@storage/subtitle';
import { languageSchema, subtitleCueSchema } from '@storage/v2/schema';
import { COUPANG_PLAY_VIDEO_URL_LIST } from '@utils/constants';
import { t } from '@utils/i18n';
import { AsyncMessageResponse, onMessage, sendMessage } from '@utils/message';
import type { ContentBootstrap, MessageSchema, SubtitleRole } from '@utils/message/type';

import { elementStore } from './core/store/element-store';
import { useVideoStore } from './core/store/video-store';
import { videoManager } from './core/video/video-manager';
import { coupangStrategy } from './coupang-play';
import { useSubtitleStore } from './features/subtitle/subtitle-store';
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
  reportContentStatus: (hasVideo: boolean) => void;
};

export const createVideoLifecycleHandler = (dependencies: VideoLifecycleDependencies) =>
  (event: VideoLifecycleEvent) => {
    if (event.state === 'content' && event.video) {
      if (!dependencies.isCurrentVideo(event.video)) {
        if (dependencies.getVideo()) {
          dependencies.clearNativeCues();
          dependencies.resetElements();
          dependencies.setCurrentTime(0);
        }
        dependencies.setVideo(event.video);
        dependencies.setupContainer();
      }
      dependencies.setDetectionStatus('detected');
      dependencies.reportContentStatus(true);
      return;
    }

    if (dependencies.getVideo()) {
      dependencies.clearVideo();
      dependencies.clearNativeCues();
      dependencies.resetElements();
      dependencies.setCurrentTime(0);
    }
    dependencies.setDetectionStatus(event.delayed ? 'failed' : 'detecting');
    dependencies.reportContentStatus(false);
  };

type MessageListenerDependencies = {
  createVideoLifecycleMonitor: () => VideoLifecycleMonitor;
  registerMessageListener: typeof onMessage;
};

const defaultMessageListenerDependencies: MessageListenerDependencies = {
  createVideoLifecycleMonitor: () => new VideoLifecycleMonitor(),
  registerMessageListener: onMessage,
};

let activeVideoLifecycleMonitor: VideoLifecycleMonitor | null = null;

export function initializeMessageListener(dependencies = defaultMessageListenerDependencies) {
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
        handlePlayVideo(params);
        break;
      case 'setSubtitleRole':
        return respond(sendResponse, () => handleSetSubtitleRole(params.role, params.subtitleId));
      case 'refreshRegisteredSubtitle':
        return respond(sendResponse, () => handleRefreshRegisteredSubtitle(params.subtitleId));
      case 'pingContent':
        sendResponse({ success: true, data: { hasVideo: Boolean(videoManager.get()) } });
        break;
    }
  });

  try {
    videoLifecycleMonitor.start(handleVideoLifecycle);
    activeVideoLifecycleMonitor = videoLifecycleMonitor;
  } catch (error) {
    registration.remove();
    videoLifecycleMonitor.stop();
    throw error;
  }

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    registration.remove();
    videoLifecycleMonitor.stop();
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
  useSubtitleStore.getState().clearNativeCues();
};

const handleFetchVideoMetadata = async ({ url, headers }: MessageSchema['fetchVideoMetadata']['params']) => {
  const subtitles = await coupangStrategy.fetchSubtitles(url, headers);
  const store = useSubtitleStore.getState();
  store.clearNativeCues();
  const tracks = (subtitles ?? []).flatMap((subtitle) => {
    const language = languageSchema.safeParse(subtitle.lang);
    if (!language.success) return [];
    return [{ language: language.data, cues: subtitleCueSchema.array().parse(subtitle.subtitleData) }];
  });
  for (const { cues, language } of tracks) {
    store.setNativeCues(language, cues);
  }
};

const handlePlayVideo = ({ startTime }: MessageSchema['playVideo']['params']) => {
  const video = videoManager.get();
  if (!video) return;
  if (video.readyState >= 3) video.currentTime = startTime;
  else video.addEventListener('canplay', () => (video.currentTime = startTime), { once: true });
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

const reportContentStatus = (hasVideo: boolean) => {
  const isVideoUrl = COUPANG_PLAY_VIDEO_URL_LIST.some((url) => window.location.href.startsWith(url));
  void sendMessage('contentStatus', { hasVideo, isVideoUrl });
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
