import { getLocalSubtitle, SubtitleId } from '@storage/subtitle';
import {
  COUPANG_PLAY_VIDEO_URL_LIST,
  SET_SUBTITLE_STORAGE_KEY_MAP,
  SetSubtitleAction,
} from '@utils/constants';
import { getCoupangPlayVideoId } from '@utils/coupang-play';
import { t } from '@utils/i18n';
import { MessageResponse, onMessage, sendMessage } from '@utils/message/index';
import { MessageSchema } from '@utils/message/type';

import { elementStore } from './core/store/element-store';
import { useVideoStore } from './core/store/video-store';
import { videoManager } from './core/video/video-manager';
import { loopController } from './features/loop';
import { useSubtitleStore } from './features/subtitle/subtitle-store';
import { handleFetchVideoMetadata, invalidateNativeSubtitles } from './native-subtitles';
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

const videoLifecycleMonitor = new VideoLifecycleMonitor();

export function initializeMessageListener() {
  onMessage(({ message, params, sendResponse }) => {
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
        handleFetchVideoMetadata(params).then(sendResponse, () => sendResponse({ success: false, message: t('error_try_later') }));
        return true;
      }
      case 'playVideo': {
        handlePlayVideo(params);
        break;
      }
      case 'setPrimarySubtitle':
      case 'setSecondarySubtitle': {
        handleSetSubtitle(message, params).then(sendResponse, () => sendResponse({ success: false, message: t('error_try_later') }));
        return true;
      }
      case 'updateSubtitleDelay': {
        handleUpdateSubtitleDelay(params).then(sendResponse, () => sendResponse({ success: false, message: t('error_try_later') }));
        return true;
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
  videoLifecycleMonitor.start((event) => {
    invalidateNativeSubtitles(event.videoId);
    handleVideoLifecycle(event);
  });
}

export const retryVideoDetection = () => Promise.resolve(toDetectionResponse(videoLifecycleMonitor.refresh()));

const handleResetElement = () => {
  elementStore.reset();
  loopController.resetLoop();
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

const selectionRequests = { setPrimarySubtitle: 0, setSecondarySubtitle: 0 };
const cacheRequests = new Map<SubtitleId, { delay: number; generation: number }>();
let cacheGeneration = 0;

const captureVideo = () => {
  const video = videoManager.get();
  if (!video) throw new Error('Video not found');
  const videoId = getCoupangPlayVideoId(location.href);
  const source = video.currentSrc || video.src;
  const check = () => {
    if (!videoManager.isCurrent(video) || getCoupangPlayVideoId(location.href) !== videoId ||
      (video.currentSrc || video.src) !== source) throw new Error('Video changed');
  };
  check();
  return { video, videoId, check };
};

const refreshCustomSubtitle = async (subtitleId: SubtitleId, delay: number, check: () => void) => {
  if (!Number.isFinite(delay)) throw new Error('Invalid subtitle delay');
  // Two roles requesting the same offset may complete independently. A newer offset supersedes old reads.
  const previous = cacheRequests.get(subtitleId);
  const generation = previous?.delay === delay ? previous.generation : ++cacheGeneration;
  cacheRequests.set(subtitleId, { delay, generation });
  const subtitle = await getLocalSubtitle(subtitleId);
  check();
  if (cacheRequests.get(subtitleId)?.generation !== generation) throw new Error('Subtitle delay changed');
  useSubtitleStore.getState().setSubtitleCache(subtitleId, subtitle.map((data) => ({
    ...data,
    start: data.start + delay,
    end: data.end + delay,
  })));
};

export const handleSetSubtitle = async (
  action: SetSubtitleAction,
  { subtitleId, delay }: MessageSchema['setPrimarySubtitle']['params'] | MessageSchema['setSecondarySubtitle']['params']
): Promise<MessageResponse<'setPrimarySubtitle' | 'setSecondarySubtitle'>> => {
  if (!videoManager.get()) return { success: false, message: t('error_video_not_found') };
  const target = captureVideo();
  const request = ++selectionRequests[action];
  const check = () => {
    target.check();
    if (selectionRequests[action] !== request) throw new Error('Subtitle selection changed');
  };
  if (subtitleId) await refreshCustomSubtitle(subtitleId, delay, check);
  check();

  useSubtitleStore.getState().setCustomSubtitleId(SET_SUBTITLE_STORAGE_KEY_MAP[action], subtitleId);
  useVideoStore.getState().setCurrentTime(target.video.currentTime);

  return { success: true };
};

export const handleUpdateSubtitleDelay = async ({ subtitleId, delay, expectedVideoId }: MessageSchema['updateSubtitleDelay']['params']): Promise<MessageResponse<'updateSubtitleDelay'>> => {
  const target = captureVideo();
  const selected = useSubtitleStore.getState().customSubtitleId;
  const primary = selected.primarySubtitle === subtitleId;
  const secondary = selected.secondarySubtitle === subtitleId;
  const primaryRequest = selectionRequests.setPrimarySubtitle;
  const secondaryRequest = selectionRequests.setSecondarySubtitle;
  const check = () => {
    target.check();
    const current = useSubtitleStore.getState().customSubtitleId;
    if (!expectedVideoId || target.videoId !== expectedVideoId || (!primary && !secondary) ||
      (current.primarySubtitle === subtitleId) !== primary || (current.secondarySubtitle === subtitleId) !== secondary ||
      (primary && selectionRequests.setPrimarySubtitle !== primaryRequest) ||
      (secondary && selectionRequests.setSecondarySubtitle !== secondaryRequest)) throw new Error('Subtitle target changed');
  };
  check();
  await refreshCustomSubtitle(subtitleId, delay, check);
  useVideoStore.getState().setCurrentTime(target.video.currentTime);
  return { success: true };
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
