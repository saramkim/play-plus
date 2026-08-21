import type { LearningCard, V2SubtitleCue } from '@storage/v2/type';
import type {
  ContentVideoIdentity,
  ListeningCatalogResponse,
} from '@utils/message/type';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createListeningSessionCoordinator,
  type ListeningSessionContext,
  type ListeningSessionCoordinator,
} from '@/content/features/listening-session/listening-session-coordinator';

const NATIVE_SOURCE_KEY = 'native:en' as const;
const REGISTERED_SOURCE_KEY =
  'registered:subtitle-00000000-0000-4000-8000-000000000001' as const;

describe('listening session coordinator', () => {
  const coordinators: ListeningSessionCoordinator[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    for (const coordinator of coordinators) coordinator.dispose();
    document.body.replaceChildren();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const create = (options: HarnessOptions = {}) => {
    const harness = createHarness(options);
    coordinators.push(harness.coordinator);
    return harness;
  };

  it('reports every catalog boundary truthfully and exposes only ordered summaries', async () => {
    const harness = create({ support: true });
    const ready = await getReadyCatalog(harness.coordinator);

    expect(ready).toMatchObject({
      status: 'ready',
      identity: IDENTITY,
      videoId: 'video-1',
      sourceKey: NATIVE_SOURCE_KEY,
      segmenterVersion: 1,
      supportAvailable: true,
      segments: [
        { startMs: 1000, endMs: 2000 },
        { startMs: 3000, endMs: 4000 },
        { startMs: 5000, endMs: 6000 },
      ],
    });
    expect(JSON.stringify(ready)).not.toContain('First line');
    expect(JSON.stringify(ready)).not.toContain('도움');

    harness.updateContext((context) => ({ ...context, video: null }));
    expect(await harness.coordinator.getCatalog()).toEqual({ status: 'no-video' });

    harness.updateContext((context) => ({
      ...context,
      video: harness.media.video,
      identity: { ...context.identity, videoId: null },
    }));
    expect(await harness.coordinator.getCatalog()).toEqual({
      status: 'video-identity-unavailable',
    });

    harness.updateContext((context) => ({
      ...context,
      identity: { ...context.identity, videoId: 'video-1' },
      learning: null,
    }));
    expect(await harness.coordinator.getCatalog()).toEqual({ status: 'no-learning-track' });

    harness.updateContext((context) => ({
      ...context,
      learning: {
        sourceKey: NATIVE_SOURCE_KEY,
        language: 'en',
        cues: [{ start: 1, end: 1.2, text: 'x' }],
        delaySeconds: 0,
      },
    }));
    expect(await harness.coordinator.getCatalog()).toEqual({ status: 'no-segments' });

    const staleIdentityHarness = create();
    staleIdentityHarness.setIdentityCurrent(false);
    expect(await staleIdentityHarness.coordinator.getCatalog()).toEqual({
      status: 'video-identity-unavailable',
    });
  });

  it('begins only an exact 1-10 consecutive immutable snapshot and captures media once', async () => {
    const harness = create({ paused: false, playbackRate: 1.5, currentTime: 8, support: true });
    const catalog = await getReadyCatalog(harness.coordinator);
    const keys = catalog.segments.map(({ segmentKey }) => segmentKey);

    expect(
      await harness.coordinator.begin({
        expectedIdentity: catalog.identity,
        expectedSubtitleRevision: catalog.subtitleRevision,
        segmentKeys: [keys[1], keys[0]],
      })
    ).toEqual({ status: 'segment-unavailable' });
    expect(
      await harness.coordinator.begin({
        expectedIdentity: catalog.identity,
        expectedSubtitleRevision: catalog.subtitleRevision,
        segmentKeys: [keys[0], keys[0]],
      })
    ).toEqual({ status: 'segment-unavailable' });
    expect(
      await harness.coordinator.begin({
        expectedIdentity: catalog.identity,
        expectedSubtitleRevision: catalog.subtitleRevision,
        segmentKeys: Array.from({ length: 11 }, () => keys[0]),
      })
    ).toEqual({ status: 'segment-unavailable' });

    const begun = await harness.coordinator.begin({
      expectedIdentity: catalog.identity,
      expectedSubtitleRevision: catalog.subtitleRevision,
      segmentKeys: keys.slice(0, 2),
    });
    expect(begun.status).toBe('ready');
    if (begun.status !== 'ready') throw new Error('Expected a ready session');
    expect(begun.sessionId).toBe('opaque-session-1');
    expect(begun.snapshot).toMatchObject({
      videoId: 'video-1',
      sourceKey: NATIVE_SOURCE_KEY,
      learningLanguage: 'en',
      segments: [
        {
          answerText: 'First line.',
          startMs: 1000,
          endMs: 2000,
          alignedSupport: { text: '첫 도움' },
        },
        { answerText: 'Second line.', startMs: 3000, endMs: 4000 },
      ],
    });
    expect(Object.isFrozen(begun.snapshot)).toBe(true);
    expect(Object.isFrozen(begun.snapshot.segments)).toBe(true);
    expect(Object.isFrozen(begun.snapshot.segments[0].sourceIndices)).toBe(true);
    expect(harness.media.pause).toHaveBeenCalledOnce();
    expect(harness.media.getPaused()).toBe(true);
    expect(harness.getMissionActive()).toBe(true);
    expect(harness.resyncSubtitles).toHaveBeenCalled();

    expect(
      await harness.coordinator.begin({
        expectedIdentity: catalog.identity,
        expectedSubtitleRevision: catalog.subtitleRevision,
        segmentKeys: [keys[2]],
      })
    ).toEqual({ status: 'busy' });
  });

  it('accepts exactly ten consecutive segments and rejects eleven', async () => {
    const harness = create({
      cues: Array.from({ length: 11 }, (_, index) => ({
        start: index * 2 + 1,
        end: index * 2 + 2,
        text: `Line ${index + 1}.`,
      })),
    });
    const catalog = await getReadyCatalog(harness.coordinator);
    const ten = await beginRawFirst(harness.coordinator, catalog, 10);
    expect(ten.status).toBe('ready');
    if (ten.status !== 'ready') throw new Error('Expected ten segments');
    expect(ten.snapshot.segments).toHaveLength(10);
    await harness.coordinator.end({
      sessionId: ten.sessionId,
      mode: 'complete-stay',
    });

    expect(await beginRawFirst(harness.coordinator, catalog, 11)).toEqual({
      status: 'segment-unavailable',
    });
  });

  it('serializes concurrent begin requests so exactly one session owns media', async () => {
    const harness = create();
    const catalog = await getReadyCatalog(harness.coordinator);
    const [first, second] = await Promise.all([
      beginRawFirst(harness.coordinator, catalog),
      beginRawFirst(harness.coordinator, catalog),
    ]);

    expect([first.status, second.status].sort()).toEqual(['busy', 'ready']);
    expect(harness.media.pause).toHaveBeenCalledOnce();
  });

  it('fails malformed and extra parameter envelopes closed without touching media', async () => {
    const harness = create();
    const catalog = await getReadyCatalog(harness.coordinator);
    const key = catalog.segments[0].segmentKey;

    expect(
      await harness.coordinator.begin({
        expectedIdentity: catalog.identity,
        expectedSubtitleRevision: catalog.subtitleRevision,
        segmentKeys: [key],
        extra: true,
      } as never)
    ).toEqual({ status: 'error' });
    expect(harness.media.pause).not.toHaveBeenCalled();

    const begun = await beginFirst(harness.coordinator, catalog);
    expect(
      await harness.coordinator.heartbeat({
        sessionId: begun.sessionId,
        expectedIdentity: catalog.identity,
        expectedSubtitleRevision: catalog.subtitleRevision,
        extra: true,
      } as never)
    ).toEqual({ status: 'error' });
    expect(
      await harness.coordinator.play({
        sessionId: begun.sessionId,
        segmentKey: key,
        rate: 0.5,
      } as never)
    ).toEqual({ status: 'error' });
    expect(
      await harness.coordinator.save({ sessionId: '', segmentKey: key })
    ).toEqual({ status: 'error' });
    expect(
      await harness.coordinator.end({
        sessionId: begun.sessionId,
        mode: 'invalid',
      } as never)
    ).toEqual({ status: 'error' });
  });

  it('rolls back captured playback and suppression when begin fails after pausing', async () => {
    const harness = create({
      paused: false,
      playbackRate: 1.25,
      currentTime: 9,
      setMissionActive: (active) => {
        if (active) throw new Error('presentation failed');
      },
    });
    const catalog = await getReadyCatalog(harness.coordinator);

    expect(await beginRawFirst(harness.coordinator, catalog)).toEqual({ status: 'error' });
    await flushPromises();
    expect(harness.media.getCurrentTime()).toBe(9);
    expect(harness.media.getPlaybackRate()).toBe(1.25);
    expect(harness.media.getPaused()).toBe(false);
    expect(harness.resyncSubtitles).toHaveBeenCalled();

    const second = await beginRawFirst(harness.coordinator, catalog);
    expect(second).toEqual({ status: 'error' });
    expect(second.status).not.toBe('busy');
  });

  it('plays exact pre/post-roll clips, caps before the next spoken line, and resolves after pause', async () => {
    const harness = create({
      cues: [
        { start: 0.1, end: 1, text: 'First.' },
        { start: 1.2, end: 2.2, text: 'Second.' },
      ],
    });
    const catalog = await getReadyCatalog(harness.coordinator);
    const begun = await beginFirst(harness.coordinator, catalog, 2);

    const clip = harness.coordinator.play({
      sessionId: begun.sessionId,
      segmentKey: begun.snapshot.segments[0].segmentKey,
      rate: 0.75,
    });
    await flushPromises();
    expect(harness.media.getCurrentTime()).toBe(0);
    expect(harness.media.getPlaybackRate()).toBe(0.75);
    expect(harness.media.getPaused()).toBe(false);

    harness.media.setCurrentTime(1.199);
    harness.media.video.dispatchEvent(new Event('timeupdate'));
    let resolved = false;
    void clip.then(() => {
      resolved = true;
    });
    await flushPromises();
    expect(resolved).toBe(false);

    harness.media.setCurrentTime(1.2);
    harness.media.video.dispatchEvent(new Event('timeupdate'));
    await expect(clip).resolves.toEqual({ status: 'played' });
    expect(harness.media.getPaused()).toBe(true);
    expect(harness.media.getCurrentTime()).toBe(1.2);
  });

  it('clamps only the physical stop target when signed delay moves a clip before zero', async () => {
    const harness = create({
      cues: [{ start: 1, end: 2, text: 'Early.' }],
      learningDelaySeconds: -3,
    });
    const catalog = await getReadyCatalog(harness.coordinator);
    expect(catalog.segments[0]).toMatchObject({ startMs: -2000, endMs: -1000 });
    const begun = await beginFirst(harness.coordinator, catalog);
    expect(begun.snapshot.segments[0]).toMatchObject({ startMs: -2000, endMs: -1000 });

    await expect(
      harness.coordinator.play({
        sessionId: begun.sessionId,
        segmentKey: begun.snapshot.segments[0].segmentKey,
        rate: 0.75,
      })
    ).resolves.toEqual({ status: 'played' });
    expect(harness.media.getCurrentTime()).toBe(0);
    expect(harness.media.getPaused()).toBe(true);
  });

  it.each([
    ['overlapping', 1.8],
    ['equal-boundary', 2],
  ])('never spills past the current end for an %s next spoken line', async (_, nextStart) => {
    const harness = create({
      cues: [
        { start: 1, end: 2, text: 'First.' },
        { start: nextStart, end: 3, text: 'Second.' },
      ],
    });
    const catalog = await getReadyCatalog(harness.coordinator);
    const begun = await beginFirst(harness.coordinator, catalog, 2);
    const clip = harness.coordinator.play({
      sessionId: begun.sessionId,
      segmentKey: begun.snapshot.segments[0].segmentKey,
      rate: 1,
    });
    await flushPromises();

    harness.media.setCurrentTime(1.999);
    harness.media.video.dispatchEvent(new Event('timeupdate'));
    let resolved = false;
    void clip.then(() => {
      resolved = true;
    });
    await flushPromises();
    expect(resolved).toBe(false);

    harness.media.setCurrentTime(2);
    harness.media.video.dispatchEvent(new Event('timeupdate'));
    await expect(clip).resolves.toEqual({ status: 'played' });
    expect(harness.media.getCurrentTime()).toBe(2);
  });

  it('keeps the session alive when a pending 1.0 clip is superseded by a 0.75 clip', async () => {
    const harness = create({ readyState: 0 });
    const catalog = await getReadyCatalog(harness.coordinator);
    const begun = await beginFirst(harness.coordinator, catalog, 3);
    const firstKey = begun.snapshot.segments[0].segmentKey;
    const secondKey = begun.snapshot.segments[1].segmentKey;

    const waiting = harness.coordinator.play({
      sessionId: begun.sessionId,
      segmentKey: firstKey,
      rate: 1,
    });
    expect(harness.media.play).not.toHaveBeenCalled();

    const replacement = harness.coordinator.play({
      sessionId: begun.sessionId,
      segmentKey: secondKey,
      rate: 0.75,
    });
    await expect(waiting).resolves.toEqual({ status: 'error' });
    expect(harness.getMissionActive()).toBe(true);
    expect(
      await harness.coordinator.heartbeat({
        sessionId: begun.sessionId,
        expectedIdentity: catalog.identity,
        expectedSubtitleRevision: catalog.subtitleRevision,
      })
    ).toEqual({ status: 'alive' });
    harness.media.setReadyState(1);
    harness.media.video.dispatchEvent(new Event('loadedmetadata'));
    await flushPromises();
    expect(harness.media.getCurrentTime()).toBe(2.75);
    expect(harness.media.getPlaybackRate()).toBe(0.75);
    harness.media.setCurrentTime(4.35);
    harness.media.video.dispatchEvent(new Event('timeupdate'));
    await expect(replacement).resolves.toEqual({ status: 'played' });

    harness.media.rejectNextPlay();
    await expect(
      harness.coordinator.play({
        sessionId: begun.sessionId,
        segmentKey: firstKey,
        rate: 1,
      })
    ).resolves.toEqual({ status: 'error' });
    expect(harness.getMissionActive()).toBe(true);

    await vi.advanceTimersByTimeAsync(15_000);
    await flushPromises();
    expect(harness.getMissionActive()).toBe(false);
    expect(
      await harness.coordinator.end({
        sessionId: begun.sessionId,
        mode: 'restore-start',
      })
    ).toEqual({ status: 'already-ended' });
  });

  it('waits for the generation-guarded seek and ignores a late superseded seek event', async () => {
    const harness = create({ seekingOnSet: true });
    const catalog = await getReadyCatalog(harness.coordinator);
    const begun = await beginFirst(harness.coordinator, catalog, 2);
    const first = harness.coordinator.play({
      sessionId: begun.sessionId,
      segmentKey: begun.snapshot.segments[0].segmentKey,
      rate: 1,
    });
    expect(harness.media.play).not.toHaveBeenCalled();

    const second = harness.coordinator.play({
      sessionId: begun.sessionId,
      segmentKey: begun.snapshot.segments[1].segmentKey,
      rate: 0.75,
    });
    await expect(first).resolves.toEqual({ status: 'error' });
    harness.media.dispatchSeekedWhileSeeking();
    await flushPromises();
    expect(harness.media.play).not.toHaveBeenCalled();

    harness.media.finishSeek();
    await flushPromises();
    expect(harness.media.play).toHaveBeenCalledOnce();
    expect(harness.media.getPlaybackRate()).toBe(0.75);
    harness.media.setCurrentTime(4.35);
    harness.media.video.dispatchEvent(new Event('timeupdate'));
    await expect(second).resolves.toEqual({ status: 'played' });
  });

  it('keeps an explicit end terminal when it invalidates a pending clip', async () => {
    const harness = create({ readyState: 0 });
    const catalog = await getReadyCatalog(harness.coordinator);
    const begun = await beginFirst(harness.coordinator, catalog);
    const pending = harness.coordinator.play({
      sessionId: begun.sessionId,
      segmentKey: begun.snapshot.segments[0].segmentKey,
      rate: 1,
    });

    expect(
      await harness.coordinator.end({
        sessionId: begun.sessionId,
        mode: 'restore-start',
      })
    ).toEqual({ status: 'ended' });
    await expect(pending).resolves.toEqual({ status: 'stale' });
    expect(harness.getMissionActive()).toBe(false);
  });

  it('abandons clip ownership immediately when a live route guard turns stale', async () => {
    const harness = create();
    const catalog = await getReadyCatalog(harness.coordinator);
    const begun = await beginFirst(harness.coordinator, catalog);
    const clip = harness.coordinator.play({
      sessionId: begun.sessionId,
      segmentKey: begun.snapshot.segments[0].segmentKey,
      rate: 0.75,
    });
    await flushPromises();
    harness.setIdentityCurrent(false);
    harness.media.video.dispatchEvent(new Event('timeupdate'));

    await expect(clip).resolves.toEqual({ status: 'stale' });
    expect(harness.getMissionActive()).toBe(false);
    expect(
      await harness.coordinator.end({
        sessionId: begun.sessionId,
        mode: 'restore-start',
      })
    ).toEqual({ status: 'already-ended' });
  });

  it('stops a same-element mission clip non-positionally after route identity changes', async () => {
    const harness = create({ paused: false, currentTime: 8, playbackRate: 1.5 });
    const catalog = await getReadyCatalog(harness.coordinator);
    const begun = await beginFirst(harness.coordinator, catalog);
    const clip = harness.coordinator.play({
      sessionId: begun.sessionId,
      segmentKey: begun.snapshot.segments[0].segmentKey,
      rate: 0.75,
    });
    await flushPromises();
    expect(harness.media.getPlaybackRate()).toBe(0.75);
    expect(harness.media.getPaused()).toBe(false);

    harness.media.setCurrentTime(1.4);
    harness.updateContext((context) => ({
      ...context,
      identity: {
        ...context.identity,
        routeChangedAt: 2,
        videoId: 'video-2',
        videoRevision: 3,
      },
      watchedUrl: 'https://www.coupangplay.com/play/video-2',
    }));
    harness.media.video.dispatchEvent(new Event('timeupdate'));

    await expect(clip).resolves.toEqual({ status: 'stale' });
    expect(harness.media.getCurrentTime()).toBe(1.4);
    expect(harness.media.getPlaybackRate()).toBe(1.5);
    expect(harness.media.getPaused()).toBe(true);
    expect(harness.getMissionActive()).toBe(false);
  });

  it('renews the 15-second lease and emergency-restores exact captured playback at expiry', async () => {
    const harness = create({ paused: false, currentTime: 7, playbackRate: 1.5 });
    const catalog = await getReadyCatalog(harness.coordinator);
    const begun = await beginFirst(harness.coordinator, catalog);

    await vi.advanceTimersByTimeAsync(14_999);
    expect(harness.getMissionActive()).toBe(true);
    expect(
      await harness.coordinator.heartbeat({
        sessionId: begun.sessionId,
        expectedIdentity: catalog.identity,
        expectedSubtitleRevision: catalog.subtitleRevision,
      })
    ).toEqual({ status: 'alive' });

    await vi.advanceTimersByTimeAsync(14_999);
    expect(harness.getMissionActive()).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    await flushPromises();
    expect(harness.getMissionActive()).toBe(false);
    expect(harness.media.getCurrentTime()).toBe(7);
    expect(harness.media.getPlaybackRate()).toBe(1.5);
    expect(harness.media.getPaused()).toBe(false);
  });

  it.each(['source', 'revision'] as const)(
    'restores start immediately when the %s changes during an active slow clip',
    async (change) => {
      const harness = create({ paused: false, currentTime: 7, playbackRate: 1.5 });
      const catalog = await getReadyCatalog(harness.coordinator);
      const begun = await beginFirst(harness.coordinator, catalog);
      const clip = harness.coordinator.play({
        sessionId: begun.sessionId,
        segmentKey: begun.snapshot.segments[0].segmentKey,
        rate: 0.75,
      });
      await flushPromises();
      expect(harness.media.getPlaybackRate()).toBe(0.75);
      harness.updateContext((context) => ({
        ...context,
        ...(change === 'revision'
          ? { subtitleRevision: context.subtitleRevision + 1 }
          : {
              learning: context.learning
                ? { ...context.learning, sourceKey: REGISTERED_SOURCE_KEY }
                : null,
            }),
      }));
      harness.media.video.dispatchEvent(new Event('timeupdate'));

      await expect(clip).resolves.toEqual({ status: 'stale' });
      await flushPromises();
      expect(harness.media.getCurrentTime()).toBe(7);
      expect(harness.media.getPlaybackRate()).toBe(1.5);
      expect(harness.media.getPaused()).toBe(false);
      expect(harness.getMissionActive()).toBe(false);
    }
  );

  it.each(['source', 'revision'] as const)(
    'invalidates immediately when the %s changes during the content lifecycle',
    async (change) => {
      const harness = create({ paused: false, currentTime: 7, playbackRate: 1.5 });
      const catalog = await getReadyCatalog(harness.coordinator);
      const begun = await beginFirst(harness.coordinator, catalog);
      harness.media.setCurrentTime(2);
      harness.updateContext((context) => ({
        ...context,
        ...(change === 'revision'
          ? {
              playbackContext: {
                ...context.playbackContext,
                subtitleIdentity: {
                  ...context.playbackContext.subtitleIdentity,
                  subtitleRevision: context.subtitleRevision + 1,
                },
              },
              subtitleRevision: context.subtitleRevision + 1,
            }
          : {
              learning: context.learning
                ? { ...context.learning, sourceKey: REGISTERED_SOURCE_KEY }
                : null,
              playbackContext: {
                ...context.playbackContext,
                subtitleIdentity: {
                  ...context.playbackContext.subtitleIdentity,
                  learning: REGISTERED_SOURCE_KEY,
                },
              },
            }),
      }));

      harness.coordinator.handlePlaybackContextChange();
      await flushPromises();

      expect(harness.media.getCurrentTime()).toBe(7);
      expect(harness.media.getPlaybackRate()).toBe(1.5);
      expect(harness.media.getPaused()).toBe(false);
      expect(harness.getMissionActive()).toBe(false);
      expect(
        await harness.coordinator.heartbeat({
          expectedIdentity: begun.identity,
          expectedSubtitleRevision: begun.subtitleRevision,
          sessionId: begun.sessionId,
        })
      ).toEqual({ status: 'stale' });
    }
  );

  it('releases a stale session without waiting for restore playback to settle', async () => {
    const restorePlayback = deferred<void>();
    const harness = create({ paused: false, currentTime: 7, playbackRate: 1.5 });
    const catalog = await getReadyCatalog(harness.coordinator);
    const begun = await beginFirst(harness.coordinator, catalog);
    harness.media.setCurrentTime(2);
    const play = vi.fn(() => restorePlayback.promise);
    Object.defineProperty(harness.media.video, 'play', { configurable: true, value: play });
    harness.updateContext((context) => ({
      ...context,
      playbackContext: {
        ...context.playbackContext,
        subtitleIdentity: {
          ...context.playbackContext.subtitleIdentity,
          subtitleRevision: context.subtitleRevision + 1,
        },
      },
      subtitleRevision: context.subtitleRevision + 1,
    }));

    harness.coordinator.handlePlaybackContextChange();

    expect(play).toHaveBeenCalledOnce();
    expect(harness.media.getCurrentTime()).toBe(7);
    expect(harness.media.getPlaybackRate()).toBe(1.5);
    expect(harness.getMissionActive()).toBe(false);
    await expect(
      harness.coordinator.heartbeat({
        expectedIdentity: begun.identity,
        expectedSubtitleRevision: begun.subtitleRevision,
        sessionId: begun.sessionId,
      })
    ).resolves.toEqual({ status: 'stale' });

    restorePlayback.resolve();
    await flushPromises();
  });

  it('omits post-fence lines and caps automatic and replay post-roll at the fence', async () => {
    const harness = create({ learningFenceEndMs: 2100 });
    const catalog = await getReadyCatalog(harness.coordinator);
    expect(catalog.segments).toHaveLength(1);
    expect(catalog.segments[0]).toMatchObject({ startMs: 1000, endMs: 2000 });
    const begun = await beginFirst(harness.coordinator, catalog);

    for (const rate of [1, 0.75] as const) {
      const clip = harness.coordinator.play({
        sessionId: begun.sessionId,
        segmentKey: begun.snapshot.segments[0].segmentKey,
        rate,
      });
      await flushPromises();
      harness.media.setCurrentTime(2.099);
      harness.media.video.dispatchEvent(new Event('timeupdate'));
      let resolved = false;
      void clip.then(() => {
        resolved = true;
      });
      await flushPromises();
      expect(resolved).toBe(false);
      harness.media.setCurrentTime(2.1);
      harness.media.video.dispatchEvent(new Event('timeupdate'));
      await expect(clip).resolves.toEqual({ status: 'played' });
      expect(harness.media.getCurrentTime()).toBe(2.1);
    }
  });

  it('invalidates an active session when its bound fence is discarded', async () => {
    const harness = create({ learningFenceEndMs: 2100 });
    const catalog = await getReadyCatalog(harness.coordinator);
    const begun = await beginFirst(harness.coordinator, catalog);
    harness.updateContext((context) => ({ ...context, learningFenceEndMs: null }));

    harness.coordinator.handlePlaybackContextChange();

    expect(harness.getMissionActive()).toBe(false);
    expect(
      await harness.coordinator.heartbeat({
        sessionId: begun.sessionId,
        expectedIdentity: catalog.identity,
        expectedSubtitleRevision: catalog.subtitleRevision,
      })
    ).toEqual({ status: 'stale' });
  });

  it('invalidates a changed media identity without seeking the current media', async () => {
    const harness = create({ paused: false, currentTime: 7, playbackRate: 1.5 });
    const catalog = await getReadyCatalog(harness.coordinator);
    const begun = await beginFirst(harness.coordinator, catalog);
    harness.media.setCurrentTime(2);
    harness.updateContext((context) => {
      const identity = {
        ...context.identity,
        contentEpoch: context.identity.contentEpoch + 1,
        contentInstanceId: 'content-2',
        routeChangedAt: context.identity.routeChangedAt + 1,
        videoId: 'video-2',
        videoRevision: context.identity.videoRevision + 1,
      };
      return {
        ...context,
        identity,
        playbackContext: {
          ...context.playbackContext,
          ...identity,
          learningAvailable: true,
          lifecycle: 'content',
          mediaAttachmentRevision: identity.videoRevision,
        },
        watchedUrl: 'https://www.coupangplay.com/play/video-2',
      };
    });

    harness.coordinator.handlePlaybackContextChange();

    expect(harness.media.getCurrentTime()).toBe(2);
    expect(harness.media.getPlaybackRate()).toBe(1.5);
    expect(harness.media.getPaused()).toBe(true);
    expect(harness.getMissionActive()).toBe(false);
    expect(
      await harness.coordinator.heartbeat({
        expectedIdentity: begun.identity,
        expectedSubtitleRevision: begun.subtitleRevision,
        sessionId: begun.sessionId,
      })
    ).toEqual({ status: 'stale' });
  });

  it.each(['source', 'revision'] as const)(
    'restores start at exact lease expiry after the %s changes during a slow clip',
    async (change) => {
      const harness = create({ paused: false, currentTime: 7, playbackRate: 1.5 });
      const catalog = await getReadyCatalog(harness.coordinator);
      const begun = await beginFirst(harness.coordinator, catalog);
      const clip = harness.coordinator.play({
        sessionId: begun.sessionId,
        segmentKey: begun.snapshot.segments[0].segmentKey,
        rate: 0.75,
      });
      await flushPromises();
      harness.updateContext((context) => ({
        ...context,
        ...(change === 'revision'
          ? { subtitleRevision: context.subtitleRevision + 1 }
          : {
              learning: context.learning
                ? { ...context.learning, sourceKey: REGISTERED_SOURCE_KEY }
                : null,
            }),
      }));

      await vi.advanceTimersByTimeAsync(14_999);
      expect(harness.media.getPlaybackRate()).toBe(0.75);
      await vi.advanceTimersByTimeAsync(1);
      await expect(clip).resolves.toEqual({ status: 'stale' });
      await flushPromises();
      expect(harness.media.getCurrentTime()).toBe(7);
      expect(harness.media.getPlaybackRate()).toBe(1.5);
      expect(harness.media.getPaused()).toBe(false);
      expect(harness.getMissionActive()).toBe(false);
    }
  );

  it('does not seek a replacement video on stale end or lease cleanup', async () => {
    const harness = create({ currentTime: 6 });
    const catalog = await getReadyCatalog(harness.coordinator);
    const begun = await beginFirst(harness.coordinator, catalog);
    const replacement = createControllableVideo({ currentTime: 44 });
    harness.updateContext((context) => ({
      ...context,
      video: replacement.video,
      identity: { ...context.identity, routeChangedAt: 2, videoId: 'video-2' },
    }));

    expect(
      await harness.coordinator.end({
        sessionId: begun.sessionId,
        mode: 'restore-start',
      })
    ).toEqual({ status: 'stale' });
    expect(replacement.getCurrentTime()).toBe(44);
    expect(harness.getMissionActive()).toBe(false);
  });

  it('distinguishes a missing current video and an unknown conflicting session', async () => {
    const harness = create();
    const catalog = await getReadyCatalog(harness.coordinator);
    const begun = await beginFirst(harness.coordinator, catalog);

    expect(
      await harness.coordinator.end({
        sessionId: 'unknown-session',
        mode: 'restore-start',
      })
    ).toEqual({ status: 'stale' });
    expect(harness.getMissionActive()).toBe(true);

    harness.updateContext((context) => ({ ...context, video: null }));
    expect(
      await harness.coordinator.end({
        sessionId: begun.sessionId,
        mode: 'restore-start',
      })
    ).toEqual({ status: 'no-video' });
    expect(harness.getMissionActive()).toBe(false);
  });

  it('implements all end modes, retryable play errors, and exact idempotency', async () => {
    const modes = [
      ['restore-start', false, 8],
      ['complete-stay', true, 2.35],
      ['continue-watching', false, 2.35],
    ] as const;

    for (const [mode, expectedPaused, expectedTime] of modes) {
      const harness = create({ paused: false, currentTime: 8, playbackRate: 1.25 });
      const catalog = await getReadyCatalog(harness.coordinator);
      const begun = await beginFirst(harness.coordinator, catalog);
      const clip = harness.coordinator.play({
        sessionId: begun.sessionId,
        segmentKey: begun.snapshot.segments[0].segmentKey,
        rate: 0.75,
      });
      await flushPromises();
      harness.media.setCurrentTime(2.35);
      harness.media.video.dispatchEvent(new Event('timeupdate'));
      await clip;

      expect(
        await harness.coordinator.end({ sessionId: begun.sessionId, mode })
      ).toEqual({ status: 'ended' });
      expect(harness.media.getCurrentTime()).toBe(expectedTime);
      expect(harness.media.getPlaybackRate()).toBe(1.25);
      expect(harness.media.getPaused()).toBe(expectedPaused);
      expect(
        await harness.coordinator.end({ sessionId: begun.sessionId, mode })
      ).toEqual({ status: 'already-ended' });
    }

    const retryHarness = create({ paused: false });
    const retryCatalog = await getReadyCatalog(retryHarness.coordinator);
    const retrySession = await beginFirst(retryHarness.coordinator, retryCatalog);
    retryHarness.media.rejectNextPlay();
    expect(
      await retryHarness.coordinator.end({
        sessionId: retrySession.sessionId,
        mode: 'continue-watching',
      })
    ).toEqual({ status: 'error' });
    expect(retryHarness.getMissionActive()).toBe(true);
    expect(
      await retryHarness.coordinator.play({
        sessionId: retrySession.sessionId,
        segmentKey: retrySession.snapshot.segments[0].segmentKey,
        rate: 1,
      })
    ).toEqual({ status: 'error' });
    expect(
      await retryHarness.coordinator.end({
        sessionId: retrySession.sessionId,
        mode: 'continue-watching',
      })
    ).toEqual({ status: 'ended' });
    expect(retryHarness.getMissionActive()).toBe(false);
  });

  it('restores an originally paused non-1.0 video without starting playback', async () => {
    const harness = create({ paused: true, currentTime: 6, playbackRate: 1.4 });
    const catalog = await getReadyCatalog(harness.coordinator);
    const begun = await beginFirst(harness.coordinator, catalog);
    harness.media.play.mockClear();

    expect(
      await harness.coordinator.end({
        sessionId: begun.sessionId,
        mode: 'restore-start',
      })
    ).toEqual({ status: 'ended' });
    expect(harness.media.getCurrentTime()).toBe(6);
    expect(harness.media.getPlaybackRate()).toBe(1.4);
    expect(harness.media.getPaused()).toBe(true);
    expect(harness.media.play).not.toHaveBeenCalled();
  });

  it('allows restore-start cleanup after failed continue-watching while suppression stays active', async () => {
    const harness = create({ paused: false, currentTime: 8, playbackRate: 1.25 });
    const catalog = await getReadyCatalog(harness.coordinator);
    const begun = await beginFirst(harness.coordinator, catalog);
    const clip = harness.coordinator.play({
      sessionId: begun.sessionId,
      segmentKey: begun.snapshot.segments[0].segmentKey,
      rate: 0.75,
    });
    await flushPromises();
    harness.media.setCurrentTime(2.35);
    harness.media.video.dispatchEvent(new Event('timeupdate'));
    await clip;

    harness.media.rejectNextPlay();
    expect(
      await harness.coordinator.end({
        sessionId: begun.sessionId,
        mode: 'continue-watching',
      })
    ).toEqual({ status: 'error' });
    expect(harness.getMissionActive()).toBe(true);
    expect(harness.media.getCurrentTime()).toBe(2.35);

    expect(
      await harness.coordinator.end({
        sessionId: begun.sessionId,
        mode: 'restore-start',
      })
    ).toEqual({ status: 'ended' });
    expect(harness.media.getCurrentTime()).toBe(8);
    expect(harness.media.getPlaybackRate()).toBe(1.25);
    expect(harness.media.getPaused()).toBe(false);
    expect(harness.getMissionActive()).toBe(false);
  });

  it('revalidates every heartbeat/action guard and clears stale suppression', async () => {
    const harness = create();
    const catalog = await getReadyCatalog(harness.coordinator);
    const begun = await beginFirst(harness.coordinator, catalog);
    harness.setIdentityCurrent(false);

    expect(
      await harness.coordinator.heartbeat({
        sessionId: begun.sessionId,
        expectedIdentity: catalog.identity,
        expectedSubtitleRevision: catalog.subtitleRevision,
      })
    ).toEqual({ status: 'stale' });
    expect(harness.getMissionActive()).toBe(false);
    expect(harness.isIdentityCurrent).toHaveBeenCalled();
  });

  it('saves only the selected immutable segment as a canonical distinct card', async () => {
    const cards: LearningCard[] = [];
    const harness = create({
      support: true,
      saveCard: async (createCard) => {
        const card = createCard();
        if (!card) return { status: 'card-unavailable' };
        cards.push(card);
        return { status: 'saved', card };
      },
    });
    const catalog = await getReadyCatalog(harness.coordinator);
    const begun = await beginFirst(harness.coordinator, catalog);
    const key = begun.snapshot.segments[0].segmentKey;

    expect(
      await harness.coordinator.save({ sessionId: begun.sessionId, segmentKey: key })
    ).toEqual({ status: 'saved-with-support' });
    expect(
      await harness.coordinator.save({ sessionId: begun.sessionId, segmentKey: key })
    ).toEqual({ status: 'saved-with-support' });
    expect(cards).toHaveLength(2);
    expect(cards[0].id).not.toBe(cards[1].id);
    expect(cards[0]).toMatchObject({
      content: {
        learning: { text: 'First line.', language: 'en' },
        support: { text: '첫 도움', language: 'ko' },
      },
      source: {
        url: 'https://www.coupangplay.com/play/video-1?episode=1',
        startTime: 1,
        endTime: 2,
      },
      studyState: 'active',
    });
    expect(Object.keys(cards[0]).sort()).toEqual([
      'content',
      'createdAt',
      'id',
      'source',
      'studyState',
    ]);
  });

  it('returns learning-only and transport error without leaking or terminating the session', async () => {
    const learningOnly = create({
      saveCard: async (createCard) => {
        const card = createCard();
        return card ? { status: 'saved', card } : { status: 'card-unavailable' };
      },
    });
    const catalog = await getReadyCatalog(learningOnly.coordinator);
    const begun = await beginFirst(learningOnly.coordinator, catalog);
    expect(
      await learningOnly.coordinator.save({
        sessionId: begun.sessionId,
        segmentKey: begun.snapshot.segments[0].segmentKey,
      })
    ).toEqual({ status: 'saved-learning-only' });

    const rejecting = create({
      saveCard: async () => {
        throw new Error('private transport failure');
      },
    });
    const rejectingCatalog = await getReadyCatalog(rejecting.coordinator);
    const rejectingSession = await beginFirst(rejecting.coordinator, rejectingCatalog);
    expect(
      await rejecting.coordinator.save({
        sessionId: rejectingSession.sessionId,
        segmentKey: rejectingSession.snapshot.segments[0].segmentKey,
      })
    ).toEqual({ status: 'error' });
    expect(rejecting.getMissionActive()).toBe(true);
  });

  it('does not let a late explicit save rewind or write after the session has ended', async () => {
    const saveCard = vi.fn(async (createCard: () => LearningCard | null | undefined) => {
      const card = createCard();
      return card ? { status: 'saved' as const, card } : { status: 'card-unavailable' as const };
    });
    const harness = create({ saveCard, paused: false, currentTime: 9 });
    const catalog = await getReadyCatalog(harness.coordinator);
    const begun = await beginFirst(harness.coordinator, catalog);

    const lateSave = harness.coordinator.save({
      sessionId: begun.sessionId,
      segmentKey: begun.snapshot.segments[0].segmentKey,
    });
    expect(
      await harness.coordinator.end({
        sessionId: begun.sessionId,
        mode: 'continue-watching',
      })
    ).toEqual({ status: 'ended' });
    await expect(lateSave).resolves.toEqual({ status: 'stale' });
    expect(saveCard).not.toHaveBeenCalled();
    expect(harness.media.getCurrentTime()).toBe(9);
    expect(harness.media.getPaused()).toBe(false);
  });

  it('supports registered catalogs and reports busy/terminal difficult-save statuses exactly', async () => {
    const harness = create({
      sourceKey: REGISTERED_SOURCE_KEY,
      saveCard: async () => ({ status: 'busy' }),
    });
    const catalog = await getReadyCatalog(harness.coordinator);
    expect(catalog.sourceKey).toBe(REGISTERED_SOURCE_KEY);
    const begun = await beginFirst(harness.coordinator, catalog, 2);

    expect(
      await harness.coordinator.save({
        sessionId: begun.sessionId,
        segmentKey: begun.snapshot.segments[0].segmentKey,
      })
    ).toEqual({ status: 'busy' });
    expect(
      await harness.coordinator.save({
        sessionId: begun.sessionId,
        segmentKey: catalog.segments[2].segmentKey,
      })
    ).toEqual({ status: 'segment-unavailable' });
    expect(harness.getMissionActive()).toBe(false);
  });

  it('restores and terminates when source identity turns stale inside the card-save lock', async () => {
    let mutateContext = () => undefined;
    const harness = create({
      paused: false,
      currentTime: 7,
      playbackRate: 1.5,
      saveCard: async (createCard) => {
        mutateContext();
        const card = createCard();
        return card ? { status: 'saved', card } : { status: 'card-unavailable' };
      },
    });
    mutateContext = () => {
      harness.updateContext((context) => ({
        ...context,
        subtitleRevision: context.subtitleRevision + 1,
      }));
    };
    const catalog = await getReadyCatalog(harness.coordinator);
    const begun = await beginFirst(harness.coordinator, catalog);

    expect(
      await harness.coordinator.save({
        sessionId: begun.sessionId,
        segmentKey: begun.snapshot.segments[0].segmentKey,
      })
    ).toEqual({ status: 'stale' });
    expect(harness.media.getCurrentTime()).toBe(7);
    expect(harness.media.getPlaybackRate()).toBe(1.5);
    expect(harness.media.getPaused()).toBe(false);
    expect(harness.getMissionActive()).toBe(false);
  });

  it('returns stale when the subtitle revision changes while a card save is pending', async () => {
    const persistence = deferred<{ status: 'saved'; card: LearningCard }>();
    const saveStarted = deferred<void>();
    let pendingCard: LearningCard | null = null;
    const saveCard = vi.fn((createCard: () => LearningCard | null | undefined) => {
      pendingCard = createCard() ?? null;
      saveStarted.resolve();
      return pendingCard
        ? persistence.promise
        : Promise.resolve({ status: 'card-unavailable' as const });
    });
    const harness = create({ saveCard, paused: false, currentTime: 7 });
    const catalog = await getReadyCatalog(harness.coordinator);
    const begun = await beginFirst(harness.coordinator, catalog);
    const pendingSave = harness.coordinator.save({
      sessionId: begun.sessionId,
      segmentKey: begun.snapshot.segments[0].segmentKey,
    });
    await saveStarted.promise;
    expect(saveCard).toHaveBeenCalledOnce();
    harness.updateContext((context) => ({
      ...context,
      playbackContext: {
        ...context.playbackContext,
        subtitleIdentity: {
          ...context.playbackContext.subtitleIdentity,
          subtitleRevision: context.subtitleRevision + 1,
        },
      },
      subtitleRevision: context.subtitleRevision + 1,
    }));

    harness.coordinator.handlePlaybackContextChange();
    expect(harness.getMissionActive()).toBe(false);

    if (!pendingCard) throw new Error('Expected a pending learning card');
    persistence.resolve({ status: 'saved', card: pendingCard });
    await expect(pendingSave).resolves.toEqual({ status: 'stale' });
  });

  it('freezes one mission across repeated ad observations and resumes only by explicit consent', async () => {
    const harness = create({ learningFenceEndMs: 2100 });
    const catalog = await getReadyCatalog(harness.coordinator);
    const begun = await beginFirst(harness.coordinator, catalog);
    harness.updateContext((context) => {
      const identity = { ...context.identity, videoRevision: context.identity.videoRevision + 1 };
      return {
        ...context,
        identity,
        playbackContext: {
          ...context.playbackContext,
          ...identity,
          learningAvailable: false,
          lifecycle: 'advertisement',
          mediaAttachmentRevision: identity.videoRevision,
          missionResumeRequired: true,
        },
        learningFenceEndMs: null,
        video: null,
      };
    });

    harness.coordinator.handlePlaybackContextChange();
    harness.coordinator.handlePlaybackContextChange();

    expect(harness.coordinator.isAdvertisementResumeRequired()).toBe(true);
    expect(harness.getMissionActive()).toBe(true);
    expect(
      await harness.coordinator.play({
        rate: 1,
        segmentKey: begun.snapshot.segments[0].segmentKey,
        sessionId: begun.sessionId,
      })
    ).toEqual({ status: 'suspended' });
    expect(
      await harness.coordinator.heartbeat({
        expectedIdentity: begun.identity,
        expectedSubtitleRevision: begun.subtitleRevision,
        sessionId: begun.sessionId,
      })
    ).toEqual({ status: 'alive' });

    harness.updateContext((context) => {
      const identity = { ...context.identity, videoRevision: context.identity.videoRevision + 1 };
      return {
        ...context,
        identity,
        playbackContext: {
          ...context.playbackContext,
          ...identity,
          learningAvailable: false,
          lifecycle: 'content',
          mediaAttachmentRevision: identity.videoRevision,
          missionResumeRequired: true,
        },
        video: harness.media.video,
      };
    });
    harness.coordinator.handlePlaybackContextChange();
    expect(harness.coordinator.isAdvertisementResumeRequired()).toBe(true);

    harness.updateContext((context) => ({
      ...context,
      learningFenceEndMs: 2100,
      playbackContext: {
        ...context.playbackContext,
        learningAvailable: true,
      },
    }));
    harness.coordinator.handlePlaybackContextChange();
    expect(harness.coordinator.isAdvertisementResumeRequired()).toBe(true);

    const resumed = await harness.coordinator.resumeAfterAdvertisement({
      expectedIdentity: begun.identity,
      expectedSubtitleRevision: begun.subtitleRevision,
      sessionId: begun.sessionId,
    });
    expect(resumed).toMatchObject({
      status: 'resumed',
      identity: { contentEpoch: begun.identity.contentEpoch, videoRevision: 4 },
      subtitleRevision: begun.subtitleRevision,
    });
    expect(harness.coordinator.isAdvertisementResumeRequired()).toBe(false);
    expect(harness.getMissionActive()).toBe(true);
  });

  it('discards a fenced mission when fresh main-content evidence omits the bound fence', async () => {
    const harness = create({ learningFenceEndMs: 2100 });
    const catalog = await getReadyCatalog(harness.coordinator);
    const begun = await beginFirst(harness.coordinator, catalog);
    harness.updateContext((context) => {
      const identity = { ...context.identity, videoRevision: context.identity.videoRevision + 1 };
      return {
        ...context,
        identity,
        learningFenceEndMs: null,
        playbackContext: {
          ...context.playbackContext,
          ...identity,
          learningAvailable: false,
          lifecycle: 'advertisement',
          mediaAttachmentRevision: identity.videoRevision,
          missionResumeRequired: true,
        },
        video: null,
      };
    });
    harness.coordinator.handlePlaybackContextChange();
    expect(harness.coordinator.isAdvertisementResumeRequired()).toBe(true);

    harness.updateContext((context) => {
      const identity = { ...context.identity, videoRevision: context.identity.videoRevision + 1 };
      return {
        ...context,
        identity,
        playbackContext: {
          ...context.playbackContext,
          ...identity,
          learningAvailable: true,
          lifecycle: 'content',
          mediaAttachmentRevision: identity.videoRevision,
          missionResumeRequired: true,
        },
        video: harness.media.video,
      };
    });
    harness.coordinator.handlePlaybackContextChange();

    expect(harness.getMissionActive()).toBe(false);
    expect(harness.coordinator.isAdvertisementResumeRequired()).toBe(false);
    await expect(
      harness.coordinator.resumeAfterAdvertisement({
        expectedIdentity: begun.identity,
        expectedSubtitleRevision: begun.subtitleRevision,
        sessionId: begun.sessionId,
      })
    ).resolves.toEqual({ status: 'stale' });
  });

  it('discards a frozen mission when the logical content changes during transition', async () => {
    const harness = create();
    const catalog = await getReadyCatalog(harness.coordinator);
    const begun = await beginFirst(harness.coordinator, catalog);
    harness.updateContext((context) => {
      const identity = {
        ...context.identity,
        contentEpoch: context.identity.contentEpoch + 1,
        routeChangedAt: context.identity.routeChangedAt + 1,
        videoId: 'video-2',
        videoRevision: context.identity.videoRevision + 1,
      };
      return {
        ...context,
        identity,
        playbackContext: {
          ...context.playbackContext,
          ...identity,
          learningAvailable: false,
          lifecycle: 'transitioning',
          mediaAttachmentRevision: identity.videoRevision,
          missionResumeRequired: false,
        },
        video: null,
      };
    });

    harness.coordinator.handlePlaybackContextChange();

    expect(harness.getMissionActive()).toBe(false);
    expect(harness.coordinator.isAdvertisementResumeRequired()).toBe(false);
    expect(
      await harness.coordinator.resumeAfterAdvertisement({
        expectedIdentity: begun.identity,
        expectedSubtitleRevision: begun.subtitleRevision,
        sessionId: begun.sessionId,
      })
    ).toEqual({ status: 'stale' });
  });
});

interface HarnessOptions {
  cues?: V2SubtitleCue[];
  currentTime?: number;
  learningDelaySeconds?: number;
  learningFenceEndMs?: number | null;
  paused?: boolean;
  playbackRate?: number;
  readyState?: number;
  seekingOnSet?: boolean;
  saveCard?: NonNullable<
    Parameters<typeof createListeningSessionCoordinator>[0]['saveCard']
  >;
  setMissionActive?: (active: boolean) => void;
  sourceKey?: typeof NATIVE_SOURCE_KEY | typeof REGISTERED_SOURCE_KEY;
  support?: boolean;
}

const createHarness = (options: HarnessOptions = {}) => {
  const media = createControllableVideo(options);
  let missionActive = false;
  let identityCurrent = true;
  let nextSessionId = 1;
  let context: ListeningSessionContext = {
    video: media.video,
    identity: structuredClone(IDENTITY),
    learningFenceEndMs: options.learningFenceEndMs ?? null,
    playbackContext: {
      ...structuredClone(IDENTITY),
      learningAvailable: true,
      lifecycle: 'content',
      mediaAttachmentRevision: IDENTITY.videoRevision,
      missionResumeRequired: false,
      routeKind: 'episode',
      subtitleIdentity: {
        learning: options.sourceKey ?? NATIVE_SOURCE_KEY,
        subtitleRevision: 4,
        support: options.support ? 'native:ko' : null,
      },
    },
    subtitleRevision: 4,
    watchedUrl: 'https://www.coupangplay.com/play/video-1?episode=1',
    learning: {
      sourceKey: options.sourceKey ?? NATIVE_SOURCE_KEY,
      language: 'en',
      cues: options.cues ?? createDefaultCues(),
      delaySeconds: options.learningDelaySeconds ?? 0,
    },
    support: options.support
      ? {
          language: 'ko',
          cues: [{ start: 1, end: 2, text: '첫 도움' }],
          delaySeconds: 0,
        }
      : null,
  };
  const resyncSubtitles = vi.fn();
  const isIdentityCurrent = vi.fn(() => identityCurrent);
  const coordinator = createListeningSessionCoordinator({
    readContext: () => context,
    isIdentityCurrent,
    isCurrentVideo: (video) => video === context.video && video.isConnected,
    createSessionId: () => `opaque-session-${nextSessionId++}`,
    resyncSubtitles,
    saveCard: options.saveCard,
    setMissionActive:
      options.setMissionActive ??
      ((active) => {
        missionActive = active;
      }),
  });

  return {
    coordinator,
    isIdentityCurrent,
    media,
    resyncSubtitles,
    getMissionActive: () => missionActive,
    setIdentityCurrent: (value: boolean) => {
      identityCurrent = value;
    },
    updateContext: (update: (current: ListeningSessionContext) => ListeningSessionContext) => {
      context = update(context);
    },
  };
};

const createDefaultCues = (): V2SubtitleCue[] => [
  { start: 1, end: 2, text: 'First line.' },
  { start: 3, end: 4, text: 'Second line.' },
  { start: 5, end: 6, text: 'Third line.' },
];

const createControllableVideo = (options: HarnessOptions = {}) => {
  const video = document.createElement('video');
  document.body.append(video);
  let currentTime = options.currentTime ?? 5;
  let paused = options.paused ?? true;
  let playbackRate = options.playbackRate ?? 1;
  let readyState = options.readyState ?? 1;
  let seeking = false;
  let nextPlayError: Error | null = null;

  Object.defineProperties(video, {
    currentTime: {
      configurable: true,
      get: () => currentTime,
      set: (value: number) => {
        currentTime = value;
        if (options.seekingOnSet) seeking = true;
      },
    },
    paused: { configurable: true, get: () => paused },
    playbackRate: {
      configurable: true,
      get: () => playbackRate,
      set: (value: number) => {
        playbackRate = value;
      },
    },
    readyState: { configurable: true, get: () => readyState },
    seeking: { configurable: true, get: () => seeking },
  });

  const play = vi.fn(async () => {
    if (nextPlayError) {
      const error = nextPlayError;
      nextPlayError = null;
      throw error;
    }
    paused = false;
  });
  const pause = vi.fn(() => {
    const changed = !paused;
    paused = true;
    if (changed) video.dispatchEvent(new Event('pause'));
  });
  Object.defineProperties(video, {
    play: { configurable: true, value: play },
    pause: { configurable: true, value: pause },
  });

  return {
    video,
    pause,
    play,
    getCurrentTime: () => currentTime,
    getPaused: () => paused,
    getPlaybackRate: () => playbackRate,
    dispatchSeekedWhileSeeking: () => {
      video.dispatchEvent(new Event('seeked'));
    },
    finishSeek: () => {
      seeking = false;
      video.dispatchEvent(new Event('seeked'));
    },
    rejectNextPlay: () => {
      nextPlayError = new Error('play rejected');
    },
    setCurrentTime: (value: number) => {
      currentTime = value;
    },
    setReadyState: (value: number) => {
      readyState = value;
    },
  };
};

const getReadyCatalog = async (
  coordinator: ListeningSessionCoordinator
): Promise<Extract<ListeningCatalogResponse, { status: 'ready' }>> => {
  const response = await coordinator.getCatalog();
  if (response.status !== 'ready') throw new Error(`Expected ready, got ${response.status}`);
  return response;
};

const beginRawFirst = (
  coordinator: ListeningSessionCoordinator,
  catalog: Extract<ListeningCatalogResponse, { status: 'ready' }>,
  count = 1
) =>
  coordinator.begin({
    expectedIdentity: catalog.identity,
    expectedSubtitleRevision: catalog.subtitleRevision,
    segmentKeys: catalog.segments.slice(0, count).map(({ segmentKey }) => segmentKey),
  });

const beginFirst = async (
  coordinator: ListeningSessionCoordinator,
  catalog: Extract<ListeningCatalogResponse, { status: 'ready' }>,
  count = 1
) => {
  const response = await beginRawFirst(coordinator, catalog, count);
  if (response.status !== 'ready') throw new Error(`Expected ready, got ${response.status}`);
  return response;
};

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const IDENTITY: ContentVideoIdentity = {
  contentEpoch: 1,
  contentInstanceId: 'content-1',
  routeChangedAt: 1,
  videoId: 'video-1',
  videoRevision: 2,
};
