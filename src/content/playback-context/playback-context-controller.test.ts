import { describe, expect, it } from 'vitest';

import { PlaybackContextController } from './playback-context-controller';

const VIDEO_A = '123e4567-e89b-12d3-a456-426614174000';
const VIDEO_B = '123e4567-e89b-12d3-a456-426614174001';
const route = (videoId: string, kind: string) =>
  `https://www.coupangplay.com/en/play/${videoId}/${kind}`;
const playback = (videoId: string, titleType: string) =>
  `https://www.coupangplay.com/api/playback/play?titleId=${videoId}&titleType=${titleType}`;
const subtitleIdentity = {
  learning: 'native:en',
  subtitleRevision: 1,
  support: 'native:ko',
} as const;

describe('PlaybackContextController', () => {
  it('advances epoch on logical content change but not advertisement attachment changes', () => {
    let now = 10;
    const controller = new PlaybackContextController('instance', route(VIDEO_A, 'episode'), () => now);
    controller.observeLifecycle({
      lifecycle: 'content',
      url: route(VIDEO_A, 'episode'),
      videoId: VIDEO_A,
      videoRevision: 1,
    });
    const first = controller.createIdentity();

    controller.observeLifecycle({
      lifecycle: 'advertisement',
      url: route(VIDEO_A, 'episode'),
      videoId: null,
      videoRevision: 2,
    });
    const advertisement = controller.createIdentity();
    expect(advertisement.contentEpoch).toBe(first.contentEpoch);
    expect(advertisement.videoId).toBe(VIDEO_A);
    expect(advertisement.videoRevision).toBe(2);

    now = 20;
    controller.observeLifecycle({
      lifecycle: 'transitioning',
      url: route(VIDEO_B, 'episode'),
      videoId: null,
      videoRevision: 2,
    });
    const next = controller.createIdentity();
    expect(next.contentEpoch).toBe(first.contentEpoch + 1);
    expect(next.routeChangedAt).toBe(20);
  });

  it('rejects late playback evidence from an old epoch or attachment', () => {
    const controller = new PlaybackContextController('instance', route(VIDEO_A, 'movie'));
    controller.observeLifecycle({
      lifecycle: 'content',
      url: route(VIDEO_A, 'movie'),
      videoId: VIDEO_A,
      videoRevision: 1,
    });
    const old = controller.createIdentity();
    controller.observeLifecycle({
      lifecycle: 'content',
      url: route(VIDEO_A, 'movie'),
      videoId: VIDEO_A,
      videoRevision: 2,
    });
    expect(
      controller.observePlaybackEvidence({
        expectedIdentity: old,
        playbackUrl: playback(VIDEO_A, 'MOVIE'),
      })
    ).toBe(false);
    expect(
      controller.createStatus({
        hasVideo: true,
        missionResumeRequired: false,
        subtitleIdentity,
        url: route(VIDEO_A, 'movie'),
      }).routeKind
    ).toBe('unknown');
  });

  it('opens capability only after current strict evidence, attachment, and subtitle identity agree', () => {
    const url = route(VIDEO_A, 'episode');
    const controller = new PlaybackContextController('instance', url);
    controller.observeLifecycle({ lifecycle: 'content', url, videoId: VIDEO_A, videoRevision: 1 });
    expect(
      controller.createStatus({
        hasVideo: true,
        missionResumeRequired: false,
        subtitleIdentity,
        url,
      }).learningAvailable
    ).toBe(false);
    expect(
      controller.observePlaybackEvidence({
        expectedIdentity: controller.createIdentity(),
        playbackUrl: playback(VIDEO_A, 'EPISODE'),
      })
    ).toBe(true);
    expect(
      controller.createStatus({
        hasVideo: true,
        missionResumeRequired: false,
        subtitleIdentity,
        url,
      }).learningAvailable
    ).toBe(true);
    expect(
      controller.createStatus({
        hasVideo: true,
        missionResumeRequired: false,
        subtitleIdentity: { ...subtitleIdentity, learning: null },
        url,
      }).learningAvailable
    ).toBe(false);
  });
});
