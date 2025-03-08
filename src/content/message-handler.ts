import { getLocalSubtitle } from '@storage/subtitle';
import { SET_SUBTITLE_ACTION, SET_SUBTITLE_STORAGE_KEY_MAP, SetSubtitleAction } from '@utils/constants';
import { t } from '@utils/i18n';
import {
  FetchVideoMetadataMessage,
  MessageResponse,
  onMessage,
  PlayVideoMessage,
  SetSubtitleMessage,
} from '@utils/message';

import { setupLoopHandler } from './loop';
import { getVideoElement, initializeElementStore, resetElementStore } from './store/element-store';
import { deleteSubtitleCache, hasSubtitleCache, setCustomSubtitleId, setSubtitleCache } from './store/subtitle-store';
import { fetchAndCacheSubtitles, setupSubtitleSync, syncSubtitles } from './subtitle';

export function initializeMessageListener() {
  onMessage((message, sender, sendResponse) => {
    const { resetElement, detectVideo, fetchVideoMetadata, playVideo } = message;

    if (resetElement) resetElementStore();
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
  deleteSubtitleCache('en');
  deleteSubtitleCache('ko');

  return fetchAndCacheSubtitles(url, headers);
};

const initializeVideo = async (): Promise<MessageResponse> => {
  const video = await initializeElementStore();
  setupLoopHandler(video);
  setupSubtitleSync(video);

  return { success: true };
};

const handlePlayVideo = ({ startTime }: PlayVideoMessage) => {
  const video = getVideoElement();
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
  if (subtitleId && !hasSubtitleCache(subtitleId)) {
    const subtitle = await getLocalSubtitle(subtitleId);
    setSubtitleCache(subtitleId, subtitle);
  }
  setCustomSubtitleId(SET_SUBTITLE_STORAGE_KEY_MAP[action], subtitleId);
  const video = getVideoElement();
  if (video) {
    syncSubtitles(video, true);
    return { success: true };
  }
  return { success: false, message: t('error_video_not_found') };
};
