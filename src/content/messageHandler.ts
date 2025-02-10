import { selectVideoElement } from '../utils/dom';
import { fetchAndCacheSubtitles, fetchVideoMetadata, setupSubtitleSync } from './subtitle';
import { initializeElementStore } from './elementStore';
import { setupLoopHandler } from './loop';
import { FetchVideoMetadataMessage, onMessage, PlayVideoMessage, SetSubtitleMessage } from '../utils/message';
import { getLocalSubtitle } from '../storage/subtitle';
import { deleteSubtitleCache, hasSubtitleCache, setCustomSubtitleId, setSubtitleCache } from './subtitleStore';
import { SET_SUBTITLE_ACTION, SetSubtitleAction, SETTINGS } from '../utils/constants';

export function initializeMessageListener() {
  onMessage((message) => {
    const { fetchVideoMetadata, playVideo } = message;

    if (fetchVideoMetadata) handleFetchVideoMetadata(fetchVideoMetadata);
    if (playVideo) handlePlayVideo(playVideo);

    Object.values(SET_SUBTITLE_ACTION).forEach((action) => {
      if (message[action]) handleSetSubtitle(action, message[action]);
    });
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

const storageKeyMap = {
  [SET_SUBTITLE_ACTION.SET_PRIMARY]: SETTINGS.SUBTITLES.PRIMARY.STORAGE_KEY,
  [SET_SUBTITLE_ACTION.SET_SECONDARY]: SETTINGS.SUBTITLES.SECONDARY.STORAGE_KEY,
} as const;

const handleSetSubtitle = async (action: SetSubtitleAction, { id }: SetSubtitleMessage) => {
  if (id && !hasSubtitleCache(id)) {
    const subtitle = await getLocalSubtitle(id);
    setSubtitleCache(id, subtitle);
  }
  setCustomSubtitleId(storageKeyMap[action], id);
};
