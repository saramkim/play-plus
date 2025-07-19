import { getLocalSubtitle } from '@storage/subtitle';
import { DEFAULT_SUBTITLE_LANGUAGES, SET_SUBTITLE_STORAGE_KEY_MAP, SetSubtitleAction } from '@utils/constants';
import { t } from '@utils/i18n';
import { MessageResponse, onMessage, sendMessage } from '@utils/message/index';
import { MessageSchema } from '@utils/message/type';

import { elementStore } from './core/store/element-store';
import { useVideoStore } from './core/store/video-store';
import { videoManager } from './core/video/video-manager';
import { loopController } from './features/loop';
import { useSubtitleStore } from './features/subtitle/subtitle-store';
import { platform } from './platform/strategy';

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
    }
  });
}

const handleResetElement = () => {
  elementStore.reset();
  videoManager.reset();
  useVideoStore.getState().setCurrentTime(0);
  loopController.resetLoop();
};

const handleFetchVideoMetadata = async ({ url, headers }: MessageSchema['fetchVideoMetadata']['params']) => {
  const subtitles = await platform.fetchSubtitles(url, headers);

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
  const video = await platform.detectVideo();
  if (!video) return { success: false, message: t('error_video_not_found') };

  videoManager.set(video);
  useVideoStore.getState().setCurrentTime(video.currentTime);

  const updateCurrentTime = () => {
    useVideoStore.getState().setCurrentTime(video.currentTime);
    video.requestVideoFrameCallback(updateCurrentTime);
  };
  video.requestVideoFrameCallback(updateCurrentTime);

  platform.afterVideoDetected?.(video);
  elementStore.setupContainer();

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
