import { getLocalSubtitle } from '@storage/subtitle';
import { DEFAULT_SUBTITLE_LANGUAGES, SET_SUBTITLE_STORAGE_KEY_MAP, SetSubtitleAction } from '@utils/constants';
import { t } from '@utils/i18n';
import { MessageResponse, onMessage, sendMessage } from '@utils/message/index';
import { MessageSchema } from '@utils/message/type';

import { elementStore } from './core/store/element-store';
import { useVideoStore } from './core/store/video-store';
import { videoManager } from './core/video/video-manager';
import { loopController } from './features/loop';
import { syncSubtitles } from './features/subtitle/subtitle';
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
  { subtitleId }: MessageSchema['setPrimarySubtitle']['params'] | MessageSchema['setSecondarySubtitle']['params']
): Promise<MessageResponse<'setPrimarySubtitle' | 'setSecondarySubtitle'>> => {
  if (subtitleId && !useSubtitleStore.getState().hasSubtitleCache(subtitleId)) {
    const subtitle = await getLocalSubtitle(subtitleId);
    useSubtitleStore.getState().setSubtitleCache(subtitleId, subtitle);
  }
  useSubtitleStore.getState().setCustomSubtitleId(SET_SUBTITLE_STORAGE_KEY_MAP[action], subtitleId);
  const video = videoManager.get();
  if (video) {
    syncSubtitles(video.currentTime, true);
    return { success: true };
  }
  return { success: false, message: t('error_video_not_found') };
};

const handleGetVideoTime = async (): Promise<MessageResponse<'getVideoTime'>> => {
  const video = videoManager.get();
  if (video) return { success: true, data: video.currentTime };
  return { success: false, message: t('error_video_not_found') };
};
