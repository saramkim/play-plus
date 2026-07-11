import { COUPANG_PLAY_SELECTORS } from '@utils/constants';

export type VideoCandidateState = 'waiting' | 'placeholder' | 'advertisement' | 'content';
export type VideoClassification = { state: VideoCandidateState; video: HTMLVideoElement | null };

export const classifyCoupangPlayVideo = (root: Document): VideoClassification => {
  const player = root.querySelector(COUPANG_PLAY_SELECTORS.player);
  const video = player?.querySelector<HTMLVideoElement>(COUPANG_PLAY_SELECTORS.mainVideo) ?? null;
  if (!video) return { state: 'waiting', video: null };

  if (player?.querySelector(COUPANG_PLAY_SELECTORS.advertisement)) {
    return { state: 'advertisement', video };
  }

  if (!(video.currentSrc || video.src)) return { state: 'placeholder', video };
  return { state: 'content', video };
};
