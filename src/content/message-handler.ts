import { getLocalSubtitle } from '@storage/subtitle';
import {
  DEFAULT_SUBTITLE_LANGUAGES,
  SET_SUBTITLE_ACTION,
  SET_SUBTITLE_STORAGE_KEY_MAP,
  SetSubtitleAction,
} from '@utils/constants';
import { t } from '@utils/i18n';
import {
  FetchVideoMetadataMessage,
  MessageResponse,
  onMessage,
  PlayVideoMessage,
  sendMessage,
  SetSubtitleMessage,
} from '@utils/message';

import { setupLoopHandler } from './features/loop/loop';
import { fetchSubtitles, setupSubtitleSync, syncSubtitles } from './features/subtitle/subtitle';
import { elementStore } from './store/element-store';
import { subtitleStore } from './store/subtitle-store';

export function initializeMessageListener() {
  onMessage((message, sender, sendResponse) => {
    const { resetElement, detectVideo, fetchVideoMetadata, playVideo } = message;

    if (resetElement) elementStore.reset();
    if (detectVideo) {
      initializeVideo().then(sendResponse);
      return true;
    }
    if (fetchVideoMetadata) handleFetchVideoMetadata(fetchVideoMetadata);
    if (playVideo) handlePlayVideo(playVideo);

    for (const action of Object.values(SET_SUBTITLE_ACTION)) {
      if (message[action]) {
        handleSetSubtitle(action, message[action]).then(sendResponse);
        return true;
      }
    }
  });
}

const handleFetchVideoMetadata = async ({ url, headers }: FetchVideoMetadataMessage) => {
  resetSubtitleCache();

  const subtitleDataList = await fetchSubtitles(url, headers);
  subtitleDataList.forEach(({ lang, subtitleData }) => {
    subtitleStore.setSubtitleCache(lang, subtitleData);
    sendMessage('updateSubtitles', { lang, subtitleData });
  });
};

const initializeVideo = async (): Promise<MessageResponse> => {
  const video = await elementStore.initialize();
  setupLoopHandler(video);
  setupSubtitleSync(video);

  return { success: true };
};

const handlePlayVideo = ({ startTime }: PlayVideoMessage) => {
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
  { subtitleId }: SetSubtitleMessage
): Promise<MessageResponse> => {
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

function resetSubtitleCache() {
  DEFAULT_SUBTITLE_LANGUAGES.forEach((lang) => {
    subtitleStore.deleteSubtitleCache(lang);
    sendMessage('updateSubtitles', { lang, subtitleData: null });
  });
}
