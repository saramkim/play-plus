import { getLocalSubtitle } from '@storage/subtitle';
import { SET_SUBTITLE_ACTION, SET_SUBTITLE_STORAGE_KEY_MAP, SetSubtitleAction } from '@utils/constants';
import { selectVideoElement } from '@utils/dom';
import {
  FetchVideoMetadataMessage,
  MessageResponse,
  onMessage,
  PlayVideoMessage,
  SetSubtitleMessage,
} from '@utils/message';
import { setupLoopHandler } from './loop';
import { getVideoElement, initializeElementStore } from './store/elementStore';
import { deleteSubtitleCache, hasSubtitleCache, setCustomSubtitleId, setSubtitleCache } from './store/subtitleStore';
import { fetchAndCacheSubtitles, fetchVideoMetadata, setupSubtitleSync } from './subtitle';
import { t } from '@utils/i18n';

export function initializeMessageListener() {
  onMessage((message, sender, sendResponse) => {
    const { fetchVideoMetadata, playVideo } = message;

    if (fetchVideoMetadata) handleFetchVideoMetadata(fetchVideoMetadata);
    if (playVideo) handlePlayVideo(playVideo);

    for (const action of Object.values(SET_SUBTITLE_ACTION)) {
      if (message[action]) {
        handleSetSubtitle(action, message[action]).then((response) => {
          sendResponse(response);
        });
        return true;
      }
    }
  });
}

const handleFetchVideoMetadata = async ({ url, headers }: FetchVideoMetadataMessage) => {
  const [subtitleApiInfoList, video] = await Promise.all([fetchVideoMetadata(url, headers), initializeElementStore()]);

  setupLoopHandler(video);
  deleteSubtitleCache('en');
  deleteSubtitleCache('ko');

  if (subtitleApiInfoList && video) {
    await fetchAndCacheSubtitles(subtitleApiInfoList);
    setupSubtitleSync(video);
  }
};

const handlePlayVideo = async ({ startTime }: PlayVideoMessage) => {
  const video = await selectVideoElement();
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
    return { success: true };
  }
  return { success: false, message: t('error_video_not_found') };
};
