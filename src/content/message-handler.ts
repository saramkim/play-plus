import { getLocalSubtitle } from '@storage/subtitle';
import {
  COUPANG_PLAY_VIDEO_URL_LIST,
  DEFAULT_SUBTITLE_LANGUAGES,
  SET_SUBTITLE_STORAGE_KEY_MAP,
  SetSubtitleAction,
} from '@utils/constants';
import { t } from '@utils/i18n';
import { MessageResponse, onMessage, sendMessage } from '@utils/message/index';
import { MessageSchema } from '@utils/message/type';

import { elementStore } from './core/store/element-store';
import { useVideoStore } from './core/store/video-store';
import { videoManager } from './core/video/video-manager';
import { coupangStrategy } from './coupang-play';
import { loopController } from './features/loop';
import { useSubtitleStore } from './features/subtitle/subtitle-store';
import { VideoLifecycleEvent, VideoLifecycleMonitor } from './video-lifecycle/video-lifecycle-monitor';

export type VideoLifecycleDependencies = {
  getVideo: () => HTMLVideoElement | null;
  isCurrentVideo: (video: HTMLVideoElement) => boolean;
  setVideo: (video: HTMLVideoElement) => void;
  clearVideo: () => void;
  setupContainer: () => void;
  resetElements: () => void;
  resetLoop: () => void;
  setCurrentTime: (time: number) => void;
  setDetectionStatus: (status: 'idle' | 'detecting' | 'detected' | 'failed') => void;
  reportContentStatus: (hasVideo: boolean) => void;
};

export const createVideoLifecycleHandler = (dependencies: VideoLifecycleDependencies) => {
  return (event: VideoLifecycleEvent) => {
    if (event.state === 'content' && event.video) {
      if (!dependencies.isCurrentVideo(event.video)) {
        dependencies.setVideo(event.video);
        dependencies.setupContainer();
      }
      dependencies.setDetectionStatus('detected');
      dependencies.reportContentStatus(true);
      return;
    }

    if (dependencies.getVideo()) {
      dependencies.clearVideo();
      dependencies.resetElements();
      dependencies.resetLoop();
      dependencies.setCurrentTime(0);
    }
    dependencies.setDetectionStatus(event.delayed ? 'failed' : 'detecting');
    dependencies.reportContentStatus(false);
  };
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

export function initializeMessageListener(
  dependencies = defaultMessageListenerDependencies
) {
  const videoLifecycleMonitor = dependencies.createVideoLifecycleMonitor();
  const registration = dependencies.registerMessageListener(({ message, params, sendResponse }) => {
    switch (message) {
      case 'resetElement': {
        handleResetElement();
        break;
      }
      case 'detectVideo': {
        sendResponse(toDetectionResponse(videoLifecycleMonitor.refresh()));
        break;
      }
      case 'fetchVideoMetadata': {
        handleFetchVideoMetadata(params);
        break;
      }
      case 'playVideo': {
        handlePlayVideo(params);
        break;
      }
      case 'setPrimarySubtitle':
      case 'setSecondarySubtitle': {
        handleSetSubtitle(message, params).then(sendResponse);
        return true;
      }
      case 'updateSubtitleDelay': {
        handleUpdateSubtitleDelay(params);
        break;
      }
      case 'getVideoTime': {
        handleGetVideoTime().then(sendResponse);
        return true;
      }
      case 'pingContent': {
        sendResponse({ success: true, data: { hasVideo: Boolean(videoManager.get()) } });
        break;
      }
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

export const retryVideoDetection = () => {
  const event = activeVideoLifecycleMonitor?.refresh();
  return Promise.resolve(
    event ? toDetectionResponse(event) : { success: false as const, message: t('error_video_not_found') }
  );
};

const handleResetElement = () => {
  elementStore.reset();
  loopController.resetLoop();
};

const handleFetchVideoMetadata = async ({ url, headers }: MessageSchema['fetchVideoMetadata']['params']) => {
  const subtitles = await coupangStrategy.fetchSubtitles(url, headers);

  for (const lang of DEFAULT_SUBTITLE_LANGUAGES) {
    const subtitleData = subtitles?.find((subtitle) => subtitle.lang === lang)?.subtitleData;
    if (subtitleData) {
      useSubtitleStore.getState().setSubtitleCache(lang, subtitleData);
      await sendMessage('updateSubtitles', { lang, subtitleData });
    } else {
      useSubtitleStore.getState().deleteSubtitleCache(lang);
      await sendMessage('updateSubtitles', { lang, subtitleData: null });
    }
  }
};

const handlePlayVideo = ({ startTime }: MessageSchema['playVideo']['params']) => {
  const video = videoManager.get();
  if (!video) return;

  if (video.readyState >= 3) {
    video.currentTime = startTime;
  } else {
    video.addEventListener('canplay', () => (video.currentTime = startTime), { once: true });
  }
};

const handleSetSubtitle = async (
  action: SetSubtitleAction,
  { subtitleId, delay }: MessageSchema['setPrimarySubtitle']['params'] | MessageSchema['setSecondarySubtitle']['params']
): Promise<MessageResponse<'setPrimarySubtitle' | 'setSecondarySubtitle'>> => {
  const video = videoManager.get();
  if (!video) return { success: false, message: t('error_video_not_found') };

  if (subtitleId && !useSubtitleStore.getState().hasSubtitleCache(subtitleId)) {
    const subtitle = await getLocalSubtitle(subtitleId);
    const updatedSubtitle = subtitle.map((data) => ({
      ...data,
      start: data.start + delay,
      end: data.end + delay,
    }));
    useSubtitleStore.getState().setSubtitleCache(subtitleId, updatedSubtitle);
  }

  useSubtitleStore.getState().setCustomSubtitleId(SET_SUBTITLE_STORAGE_KEY_MAP[action], subtitleId);
  useVideoStore.getState().setCurrentTime(video.currentTime);

  return { success: true };
};

const handleUpdateSubtitleDelay = async ({ subtitleId, delay }: MessageSchema['updateSubtitleDelay']['params']) => {
  const video = videoManager.get();
  if (!video) return;

  const subtitle = await getLocalSubtitle(subtitleId);
  const updatedSubtitle = subtitle.map((data) => ({
    ...data,
    start: data.start + delay,
    end: data.end + delay,
  }));

  useSubtitleStore.getState().setSubtitleCache(subtitleId, updatedSubtitle);
  useVideoStore.getState().setCurrentTime(video.currentTime);
};

const handleGetVideoTime = async (): Promise<MessageResponse<'getVideoTime'>> => {
  const video = videoManager.get();
  if (video) return { success: true, data: video.currentTime };
  return { success: false, message: t('error_video_not_found') };
};

const reportContentStatus = (hasVideo: boolean) => {
  const isVideoUrl = COUPANG_PLAY_VIDEO_URL_LIST.some((url) => window.location.href.startsWith(url));
  sendMessage('contentStatus', { hasVideo, isVideoUrl });
};

const handleVideoLifecycle = createVideoLifecycleHandler({
  getVideo: () => videoManager.get(),
  isCurrentVideo: (video) => videoManager.isCurrent(video),
  setVideo: (video) => videoManager.set(video),
  clearVideo: () => videoManager.clear(),
  setupContainer: () => elementStore.setupContainer(),
  resetElements: () => elementStore.reset(),
  resetLoop: () => loopController.resetLoop(),
  setCurrentTime: (time) => useVideoStore.getState().setCurrentTime(time),
  setDetectionStatus: (status) => useVideoStore.getState().setDetectionStatus(status),
  reportContentStatus,
});

const toDetectionResponse = (event: VideoLifecycleEvent): MessageResponse<'detectVideo'> => {
  if (event.state === 'content') return { success: true };
  return { success: false, message: t('error_video_not_found') };
};
