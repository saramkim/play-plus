import type { PlaybackContextStatus } from '@utils/playback-context';
import { afterEach, describe, expect, it } from 'vitest';

import {
  discardPlaybackFence,
  getCurrentPlaybackFenceEndMs,
  isPlaybackIntervalAllowed,
  replacePlaybackFence,
} from './playback-fence';

const status = (overrides: Partial<PlaybackContextStatus> = {}): PlaybackContextStatus => ({
  contentEpoch: 3,
  contentInstanceId: 'instance',
  learningAvailable: true,
  lifecycle: 'content',
  mediaAttachmentRevision: 7,
  missionResumeRequired: false,
  routeChangedAt: 100,
  routeKind: 'episode',
  subtitleIdentity: {
    learning: 'native:en',
    subtitleRevision: 11,
    support: 'native:ko',
  },
  videoId: 'video',
  videoRevision: 7,
  ...overrides,
});

const context = (
  overrides: Partial<Parameters<typeof replacePlaybackFence>[1]> = {}
) => ({
  mediaDurationSeconds: 600,
  nativeTracks: {
    en: { category: 'regular' as const, physicalIdentity: 'physical-en' },
    ko: { category: 'sdh' as const, physicalIdentity: 'physical-ko' },
  },
  playbackContext: status(),
  ...overrides,
});

describe('content-owned playback fence binding', () => {
  afterEach(discardPlaybackFence);

  it('allows only whole intervals ending at or before the current fence', () => {
    const current = context();
    replacePlaybackFence(500, current);

    expect(getCurrentPlaybackFenceEndMs(current)).toBe(500_000);
    expect(isPlaybackIntervalAllowed(499_000, 500_000, current)).toBe(true);
    expect(isPlaybackIntervalAllowed(499_000, 500_001, current)).toBe(false);
  });

  it.each([
    { playbackContext: status({ contentEpoch: 4 }) },
    { playbackContext: status({ contentInstanceId: 'replacement' }) },
    { playbackContext: status({ routeChangedAt: 101 }) },
    { playbackContext: status({ videoId: 'replacement' }) },
    { playbackContext: status({ videoRevision: 8, mediaAttachmentRevision: 8 }) },
    { playbackContext: status({ lifecycle: 'advertisement', learningAvailable: false }) },
    { playbackContext: status({ routeKind: 'movie' }) },
    {
      playbackContext: status({
        subtitleIdentity: {
          learning: 'native:en',
          subtitleRevision: 12,
          support: 'native:ko',
        },
      }),
    },
    {
      nativeTracks: {
        en: { category: 'sdh' as const, physicalIdentity: 'physical-en' },
        ko: { category: 'sdh' as const, physicalIdentity: 'physical-ko' },
      },
    },
    {
      nativeTracks: {
        en: { category: 'regular' as const, physicalIdentity: 'replacement-en' },
        ko: { category: 'sdh' as const, physicalIdentity: 'physical-ko' },
      },
    },
  ])('discards the fence on identity or physical snapshot drift: %#', (overrides) => {
    replacePlaybackFence(500, context());
    expect(getCurrentPlaybackFenceEndMs(context(overrides))).toBeNull();
  });

  it('requires fresh evidence after non-content invalidation', () => {
    replacePlaybackFence(500, context());
    expect(
      getCurrentPlaybackFenceEndMs(
        context({ playbackContext: status({ lifecycle: 'transitioning', learningAvailable: false }) })
      )
    ).toBeNull();
    expect(getCurrentPlaybackFenceEndMs(context())).toBeNull();
  });

  it('preserves marker-agnostic signed-delay intervals when no fence exists', () => {
    expect(isPlaybackIntervalAllowed(-2000, -1000, context())).toBe(true);
  });
});
