import { getCoupangPlayVideoId } from '@utils/coupang-play';
import { MessageResponse, sendMessage } from '@utils/message';
import { MessageSchema } from '@utils/message/type';
import { NativeSubtitleBatch, resolveNativeSubtitle } from '@utils/native-subtitles';

import { videoManager } from './core/video/video-manager';
import { coupangStrategy } from './coupang-play';
import { useSubtitleStore } from './features/subtitle/subtitle-store';

let nativeVideoId: string | null = null;
let generation = 0;
let lastRequestId = 0;

export const invalidateNativeSubtitles = (videoId: string | null) => {
  if (nativeVideoId === videoId) return;
  nativeVideoId = videoId;
  generation++;
  useSubtitleStore.setState(({ subtitleCache }) => {
    const { en: _en, ko: _ko, ...custom } = subtitleCache;
    return { subtitleCache: custom };
  });
};

export const handleFetchVideoMetadata = async (
  { url, headers }: MessageSchema['fetchVideoMetadata']['params']
): Promise<MessageResponse<'fetchVideoMetadata'>> => {
  const videoId = getCoupangPlayVideoId(location.href);
  invalidateNativeSubtitles(videoId);
  if (!videoId) throw new Error('No current video route');
  const request = ++generation;
  // Comparable across content-document reloads; the sequence also handles reduced timer precision.
  const requestId = lastRequestId = Math.max(lastRequestId + 1, performance.timeOrigin + performance.now());
  const video = videoManager.get();
  const source = video?.currentSrc || video?.src;
  const check = () => {
    if (request !== generation || getCoupangPlayVideoId(location.href) !== videoId ||
      (video && (!videoManager.isCurrent(video) || (video.currentSrc || video.src) !== source))) {
      throw new Error('Native subtitle target changed');
    }
  };
  const tracks = await coupangStrategy.fetchSubtitles(url, headers);
  check();
  const batch: NativeSubtitleBatch = {
    videoId, requestId,
    en: tracks.find(({ lang }) => lang === 'en')?.result ?? { status: 'absent' },
    ko: tracks.find(({ lang }) => lang === 'ko')?.result ?? { status: 'absent' },
  };
  useSubtitleStore.setState(({ subtitleCache }) => {
    const { en, ko, ...custom } = subtitleCache;
    const nextEn = resolveNativeSubtitle(batch.en, en);
    const nextKo = resolveNativeSubtitle(batch.ko, ko);
    return { subtitleCache: { ...custom, ...(nextEn ? { en: nextEn } : {}), ...(nextKo ? { ko: nextKo } : {}) } };
  });
  const response = await sendMessage('updateSubtitles', batch);
  check();
  return response;
};
