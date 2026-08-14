import { describe, expect, it } from 'vitest';

import {
  deriveLearningAvailability,
  derivePlaybackRouteKind,
  getCoupangPlayRouteKindSignal,
  getPlaybackTitleTypeSignal,
  PLAYBACK_LIFECYCLES,
  PLAYBACK_ROUTE_KINDS,
  playbackContextStatusSchema,
} from './playback-context';

const VIDEO_ID = '123e4567-e89b-12d3-a456-426614174000';

describe('transient playback context', () => {
  it.each([
    [`https://www.coupangplay.com/play/${VIDEO_ID}/movie`, 'movie'],
    [`https://www.coupangplay.com/en/play/${VIDEO_ID}/episode`, 'episode'],
    [`https://www.coupangplay.com/ko/play/${VIDEO_ID}/trailer/`, 'trailer'],
    [`https://www.coupangplay.com/play/${VIDEO_ID}/channel?from=home`, 'channel'],
    [`https://www.coupangplay.com/en/play/${VIDEO_ID}/highlight#player`, 'highlight'],
  ] as const)('preserves supported route parsing while reading the exact suffix from %s', (url, kind) => {
    expect(getCoupangPlayRouteKindSignal(url)).toBe(kind);
  });

  it.each([
    `https://www.coupangplay.com/play/${VIDEO_ID}`,
    `https://www.coupangplay.com/play/${VIDEO_ID}/movie/extra`,
    `https://www.coupangplay.com/play/${VIDEO_ID}/MOVIES`,
    `https://example.com/play/${VIDEO_ID}/movie`,
    'not a url',
  ])('treats missing or drifted route suffix as unknown evidence without narrowing UUID support', (url) => {
    expect(getCoupangPlayRouteKindSignal(url)).toBeNull();
  });

  it.each([
    ['MOVIE', 'movie'],
    ['EPISODE', 'episode'],
    ['TRAILER', 'trailer'],
    ['CHANNEL', 'channel'],
    ['HIGHLIGHT', 'highlight'],
  ] as const)('strictly maps playback titleType %s', (titleType, kind) => {
    expect(
      getPlaybackTitleTypeSignal(
        `https://www.coupangplay.com/api/playback/play?titleId=${VIDEO_ID}&titleType=${titleType}`
      )
    ).toBe(kind);
  });

  it.each([
    `https://www.coupangplay.com/api/playback/play?titleId=${VIDEO_ID}`,
    `https://www.coupangplay.com/api/playback/play?titleType=movie`,
    `https://www.coupangplay.com/api/playback/play?titleType=SERIES`,
    `https://www.coupangplay.com/api/playback/play?titleType=MOVIE&titleType=MOVIE`,
    'not a url',
  ])('rejects missing, malformed, duplicated, or drifted titleType evidence', (url) => {
    expect(getPlaybackTitleTypeSignal(url)).toBeNull();
  });

  it('derives a kind only when both strict signals agree', () => {
    expect(derivePlaybackRouteKind('movie', 'movie')).toBe('movie');
    expect(derivePlaybackRouteKind('movie', 'episode')).toBe('unknown');
    expect(derivePlaybackRouteKind('movie', null)).toBe('unknown');
    expect(derivePlaybackRouteKind(null, 'movie')).toBe('unknown');
  });

  it.each(PLAYBACK_ROUTE_KINDS.flatMap((routeKind) =>
    PLAYBACK_LIFECYCLES.map((lifecycle) => ({ lifecycle, routeKind }))))(
    'fails closed for $routeKind in $lifecycle unless every supported-content identity is current',
    ({ lifecycle, routeKind }) => {
      const supportedContent =
        (routeKind === 'movie' || routeKind === 'episode') && lifecycle === 'content';
      expect(
        deriveLearningAvailability({
          hasCurrentContentIdentity: true,
          hasCurrentMediaAttachment: true,
          hasCurrentSubtitleIdentity: true,
          lifecycle,
          routeKind,
        })
      ).toBe(supportedContent);
      expect(
        deriveLearningAvailability({
          hasCurrentContentIdentity: false,
          hasCurrentMediaAttachment: true,
          hasCurrentSubtitleIdentity: true,
          lifecycle,
          routeKind,
        })
      ).toBe(false);
      expect(
        deriveLearningAvailability({
          hasCurrentContentIdentity: true,
          hasCurrentMediaAttachment: false,
          hasCurrentSubtitleIdentity: true,
          lifecycle,
          routeKind,
        })
      ).toBe(false);
      expect(
        deriveLearningAvailability({
          hasCurrentContentIdentity: true,
          hasCurrentMediaAttachment: true,
          hasCurrentSubtitleIdentity: false,
          lifecycle,
          routeKind,
        })
      ).toBe(false);
    }
  );

  it('requires the named attachment projection to equal the existing video revision spine', () => {
    const status = {
      contentEpoch: 3,
      contentInstanceId: 'content-instance',
      learningAvailable: true,
      lifecycle: 'content',
      mediaAttachmentRevision: 7,
      missionResumeRequired: false,
      routeChangedAt: 10,
      routeKind: 'episode',
      subtitleIdentity: {
        learning: 'native:en',
        subtitleRevision: 4,
        support: 'native:ko',
      },
      videoId: VIDEO_ID,
      videoRevision: 7,
    } as const;
    expect(playbackContextStatusSchema.safeParse(status).success).toBe(true);
    expect(
      playbackContextStatusSchema.safeParse({ ...status, mediaAttachmentRevision: 8 }).success
    ).toBe(false);
  });
});
