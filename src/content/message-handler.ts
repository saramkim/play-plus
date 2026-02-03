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

export function initializeMessageListener() {
  onMessage(({ message, params, sendResponse }) => {
    switch (message) {
      case 'resetElement': {
        handleResetElement();
        break;
      }
      case 'detectVideo': {
        initializeVideo().then(sendResponse);
        return true;
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

  reportContentStatus(Boolean(videoManager.get()));
}

export const retryVideoDetection = () => initializeVideo();

const handleResetElement = () => {
  elementStore.reset();
  videoManager.reset();
  useVideoStore.getState().setCurrentTime(0);
  useVideoStore.getState().setDetectionStatus('idle');
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

const initializeVideo = async (): Promise<MessageResponse<'detectVideo'>> => {
  useVideoStore.getState().setDetectionStatus('detecting');
  const video = await coupangStrategy.detectVideo();
  if (!video) {
    reportContentStatus(false);
    useVideoStore.getState().setDetectionStatus('failed');
    return { success: false, message: t('error_video_not_found') };
  }

  const currentVideo = videoManager.get();
  if (video === currentVideo) {
    console.debug('Same video already initialized, skipping');
    return { success: true };
  }

  videoManager.set(video);
  elementStore.setupContainer();
  useVideoStore.getState().setDetectionStatus('detected');
  reportContentStatus(true);

  return { success: true };
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
