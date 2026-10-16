import { getCoupangPlayVideoId } from '@utils/coupang-play';
import { MessageResponse, sendMessage } from '@utils/message';
import { MessageSchema } from '@utils/message/type';
import { NativeSubtitleBatch, resolveNativeSubtitle } from '@utils/native-subtitles';

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
  // Tracks belong to the title, not the media element/blob used to play it.
  // A same-title player replacement must not discard an otherwise current response.
  const check = () => {
    if (request !== generation || getCoupangPlayVideoId(location.href) !== videoId) {
      throw new Error('Native subtitle target changed');
    }
  };
  const tracks = await coupangStrategy.fetchSubtitles(url, headers);
  check();
  // A failed regular candidate still takes precedence; SDH fills only an absent regular track.
  const selectLanguage = (language: 'en' | 'ko') =>
    (tracks.find(({ lang }) => lang === language) ?? tracks.find(({ lang }) => lang === `${language} sdh`))?.result
      ?? { status: 'absent' as const };
  const batch: NativeSubtitleBatch = {
    videoId, requestId,
    en: selectLanguage('en'),
    ko: selectLanguage('ko'),
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
