import { getLocalSubtitle } from '@storage/subtitle';
import { DEFAULT_SUBTITLE_LANGUAGES, SET_SUBTITLE_STORAGE_KEY_MAP, SetSubtitleAction } from '@utils/constants';
import { t } from '@utils/i18n';
import { MessageResponse, onMessage, sendMessage } from '@utils/message/index';
import { MessageSchema } from '@utils/message/type';

import { loopController } from './features/loop';
import { fetchSubtitles, setupSubtitleSync, syncSubtitles } from './features/subtitle/subtitle';
import { elementStore } from './store/element-store';
import { subtitleStore } from './store/subtitle-store';

export function initializeMessageListener() {
  onMessage(({ message, params, sendResponse }) => {
    switch (message) {
      case 'resetElement': {
        elementStore.reset();
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

const handleFetchVideoMetadata = async ({ url, headers }: MessageSchema['fetchVideoMetadata']['params']) => {
  const subtitles = await fetchSubtitles(url, headers);

  for (const lang of DEFAULT_SUBTITLE_LANGUAGES) {
    const subtitleData = subtitles.find((subtitle) => subtitle.lang === lang)?.subtitleData;
    if (subtitleData) {
      subtitleStore.setSubtitleCache(lang, subtitleData);
      await sendMessage('updateSubtitles', { lang, subtitleData });
    } else {
      subtitleStore.deleteSubtitleCache(lang);
      await sendMessage('updateSubtitles', { lang, subtitleData: null });
    }
  }
};

const initializeVideo = async (): Promise<MessageResponse<'detectVideo'>> => {
  const video = await elementStore.initialize();
  loopController.setupLoopHandler(video);
  setupSubtitleSync(video);

  return { success: true };
};

const handlePlayVideo = ({ startTime }: MessageSchema['playVideo']['params']) => {
  const video = elementStore.getVideoElement();
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
  if (subtitleId && !subtitleStore.hasSubtitleCache(subtitleId)) {
    const subtitle = await getLocalSubtitle(subtitleId);
    subtitleStore.setSubtitleCache(subtitleId, subtitle);
  }
  subtitleStore.setCustomSubtitleId(SET_SUBTITLE_STORAGE_KEY_MAP[action], subtitleId);
  const video = elementStore.getVideoElement();
  if (video) {
    syncSubtitles(video, true);
    return { success: true };
  }
  return { success: false, message: t('error_video_not_found') };
};

const handleGetVideoTime = async (): Promise<MessageResponse<'getVideoTime'>> => {
  const video = elementStore.getVideoElement();
  if (video) return { success: true, data: video.currentTime };
  return { success: false, message: t('error_video_not_found') };
};
