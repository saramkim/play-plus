import { selectVideoElement } from '../utils/dom';
import { fetchAndSyncSubtitles, fetchVideoMetadata, setupSubtitleSync } from './subtitle';
import { initializeElementStore } from './elementStore';
import { initializeSubtitleStore } from './subtitleStore';
import { setupLoopHandler } from './loop';
import { FetchVideoMetadataMessage, onMessage, PlayVideoMessage } from '../utils/message';

export function initializeMessageListener() {
  onMessage((message) => {
    const { fetchVideoMetadata, playVideo } = message;

    if (fetchVideoMetadata) handleFetchVideoMetadata(fetchVideoMetadata);
    if (playVideo) handlePlayVideo(playVideo);
  });
}

const handleFetchVideoMetadata = async ({ url, headers }: FetchVideoMetadataMessage) => {
  const [subtitleApiInfoList, video] = await Promise.all([fetchVideoMetadata(url, headers), initializeElementStore()]);

  initializeSubtitleStore(subtitleApiInfoList);
  setupLoopHandler(video);

  if (subtitleApiInfoList && video) {
    await fetchAndSyncSubtitles(subtitleApiInfoList);
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
