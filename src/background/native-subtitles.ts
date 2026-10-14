import { updateTabInfo } from '@storage/tab';
import { getCoupangPlayVideoId } from '@utils/coupang-play';
import { hasNativeSubtitleFailure, NativeSubtitleBatch, resolveNativeSubtitle } from '@utils/native-subtitles';

const currentVideoId = async (tabId: number) => getCoupangPlayVideoId((await chrome.tabs.get(tabId)).url);

export const invalidateNativeSubtitles = (tabId: number) => updateTabInfo(tabId, async (current) => {
  const videoId = await currentVideoId(tabId);
  if (current.nativeVideoId === videoId || (!videoId && current.nativeVideoId == null)) return;
  return { nativeVideoId: videoId, en: null, ko: null };
});

export const persistNativeSubtitles = async (tabId: number, batch: NativeSubtitleBatch) => {
  await updateTabInfo(tabId, async (current) => {
    if (!batch.videoId || !Number.isFinite(batch.requestId) ||
      batch.videoId !== await currentVideoId(tabId) || batch.requestId <= (current.nativeRequestId ?? -1)) {
      throw new Error('Stale native subtitle request');
    }
    const sameVideo = current.nativeVideoId === batch.videoId;
    return {
      nativeVideoId: batch.videoId,
      nativeRequestId: batch.requestId,
      en: resolveNativeSubtitle(batch.en, sameVideo ? current.en : null),
      ko: resolveNativeSubtitle(batch.ko, sameVideo ? current.ko : null),
    };
  });
  // A URL event can arrive after set has started. Re-read the live tab, not activeTab's cached URL.
  if (await currentVideoId(tabId) !== batch.videoId) {
    await invalidateNativeSubtitles(tabId);
    throw new Error('Video changed during native subtitle write');
  }
  if (hasNativeSubtitleFailure(batch)) throw new Error('Native subtitle acquisition failed');
};
