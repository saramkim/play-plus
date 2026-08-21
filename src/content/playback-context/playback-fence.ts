import type { Language } from '@utils/constants';
import type { PlaybackContextStatus } from '@utils/playback-context';

import type { NativeSubtitleTrackIdentity } from '@/content/features/subtitle/subtitle-store';

type NativeTrackIdentitySnapshot = Partial<Record<Language, NativeSubtitleTrackIdentity>>;

interface PlaybackFenceBinding {
  contentEpoch: number;
  contentInstanceId: string;
  endMs: number;
  mediaAttachmentRevision: number;
  nativeTracks: NativeTrackIdentitySnapshot;
  routeChangedAt: number;
  subtitleIdentity: PlaybackContextStatus['subtitleIdentity'];
  videoId: string;
  videoRevision: number;
}

interface PlaybackFenceContext {
  mediaDurationSeconds: number;
  nativeTracks: NativeTrackIdentitySnapshot;
  playbackContext: PlaybackContextStatus;
}

let currentFence: PlaybackFenceBinding | null = null;

export const replacePlaybackFence = (
  endSeconds: number | null,
  context: PlaybackFenceContext
) => {
  currentFence = null;
  if (endSeconds === null || !isFenceContextEligible(context)) return;
  const endMs = Math.round(endSeconds * 1000);
  if (!Number.isSafeInteger(endMs) || endMs < 0 || endSeconds > context.mediaDurationSeconds) {
    return;
  }

  const { playbackContext } = context;
  currentFence = {
    contentEpoch: playbackContext.contentEpoch,
    contentInstanceId: playbackContext.contentInstanceId,
    endMs,
    mediaAttachmentRevision: playbackContext.mediaAttachmentRevision,
    nativeTracks: cloneNativeTracks(context.nativeTracks),
    routeChangedAt: playbackContext.routeChangedAt,
    subtitleIdentity: { ...playbackContext.subtitleIdentity },
    videoId: playbackContext.videoId!,
    videoRevision: playbackContext.videoRevision,
  };
};

export const discardPlaybackFence = () => {
  currentFence = null;
};

export const retainPlaybackFenceIfCurrent = (context: PlaybackFenceContext) => {
  if (currentFence && !isFenceCurrent(currentFence, context)) currentFence = null;
};

export const getCurrentPlaybackFenceEndMs = (context: PlaybackFenceContext) => {
  retainPlaybackFenceIfCurrent(context);
  return currentFence?.endMs ?? null;
};

export const isPlaybackIntervalAllowed = (
  startMs: number,
  endMs: number,
  context: PlaybackFenceContext
) => {
  if (
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    endMs < startMs
  ) {
    return false;
  }
  const fenceEndMs = getCurrentPlaybackFenceEndMs(context);
  return fenceEndMs === null || endMs <= fenceEndMs;
};

const isFenceContextEligible = ({ mediaDurationSeconds, playbackContext }: PlaybackFenceContext) =>
  playbackContext.routeKind === 'episode' &&
  playbackContext.lifecycle === 'content' &&
  playbackContext.learningAvailable &&
  playbackContext.videoId !== null &&
  playbackContext.mediaAttachmentRevision === playbackContext.videoRevision &&
  Number.isFinite(mediaDurationSeconds) &&
  mediaDurationSeconds >= 0;

const isFenceCurrent = (
  fence: PlaybackFenceBinding,
  context: PlaybackFenceContext
) => {
  const { playbackContext } = context;
  return (
    isFenceContextEligible(context) &&
    fence.endMs <= Math.round(context.mediaDurationSeconds * 1000) &&
    fence.contentEpoch === playbackContext.contentEpoch &&
    fence.contentInstanceId === playbackContext.contentInstanceId &&
    fence.mediaAttachmentRevision === playbackContext.mediaAttachmentRevision &&
    fence.routeChangedAt === playbackContext.routeChangedAt &&
    fence.videoId === playbackContext.videoId &&
    fence.videoRevision === playbackContext.videoRevision &&
    isSameSubtitleIdentity(fence.subtitleIdentity, playbackContext.subtitleIdentity) &&
    isSameNativeTracks(fence.nativeTracks, context.nativeTracks)
  );
};

const isSameSubtitleIdentity = (
  left: PlaybackContextStatus['subtitleIdentity'],
  right: PlaybackContextStatus['subtitleIdentity']
) =>
  left.learning === right.learning &&
  left.subtitleRevision === right.subtitleRevision &&
  left.support === right.support;

const cloneNativeTracks = (tracks: NativeTrackIdentitySnapshot): NativeTrackIdentitySnapshot =>
  Object.fromEntries(
    Object.entries(tracks).map(([language, identity]) => [
      language,
      identity ? { ...identity } : identity,
    ])
  ) as NativeTrackIdentitySnapshot;

const isSameNativeTracks = (
  left: NativeTrackIdentitySnapshot,
  right: NativeTrackIdentitySnapshot
) => {
  const leftLanguages = Object.keys(left).sort();
  const rightLanguages = Object.keys(right).sort();
  return (
    leftLanguages.length === rightLanguages.length &&
    leftLanguages.every((language, index) => {
      if (language !== rightLanguages[index]) return false;
      const leftIdentity = left[language as Language];
      const rightIdentity = right[language as Language];
      return (
        leftIdentity?.category === rightIdentity?.category &&
        leftIdentity?.physicalIdentity === rightIdentity?.physicalIdentity
      );
    })
  );
};
