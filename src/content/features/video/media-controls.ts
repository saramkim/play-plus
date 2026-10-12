import { getCoupangPlayVideoId } from '@utils/coupang-play';
import type { PlaybackContextStatus } from '@utils/playback-context';

import { videoManager } from '@/content/core/video/video-manager';
import { isListeningMissionActive } from '@/content/features/listening-session/mission-active-store';
import { useSubtitleStore } from '@/content/features/subtitle/subtitle-store';
import { usePlaybackContextStore } from '@/content/playback-context/playback-context-store';
import { isPlaybackIntervalAllowed } from '@/content/playback-context/playback-fence';

export const isMediaContextAvailable = (status: PlaybackContextStatus | null) =>
  status !== null && (status.routeKind === 'movie' || status.routeKind === 'episode') &&
  status.lifecycle === 'content' && status.videoId !== null &&
  status.mediaAttachmentRevision === status.videoRevision &&
  getCoupangPlayVideoId(window.location.href) === status.videoId;

export const getControlledMedia = () => {
  const status = usePlaybackContextStore.getState().status;
  const video = videoManager.get();
  if (!status || !video || !videoManager.isCurrent(video) || isListeningMissionActive() ||
    !isMediaContextAvailable(status)) return null;
  return { video, status, fence: {
    playbackContext: status, mediaDurationSeconds: video.duration,
    nativeTracks: useSubtitleStore.getState().nativeTrackIdentityCache,
  } };
};

export const isMediaIntervalAllowed = (start: number, end: number) => {
  const media = getControlledMedia();
  return media !== null && Number.isFinite(start) && Number.isFinite(end) && start >= 0 &&
    end > start && Number.isFinite(media.video.duration) && end <= media.video.duration &&
    isPlaybackIntervalAllowed(start * 1000, end * 1000, media.fence);
};
