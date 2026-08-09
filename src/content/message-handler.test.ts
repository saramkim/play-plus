import { getRegisteredSubtitles } from '@storage/registered-subtitle';
import { getLocalSubtitle } from '@storage/subtitle';
import { DEFAULT_V2_SYNC_STORAGE } from '@storage/v2/default';
import { LANGUAGES, Language } from '@utils/constants';
import { getCoupangPlayVideoId } from '@utils/coupang-play';
import { sendMessage } from '@utils/message';
import type { MessageSchema } from '@utils/message/type';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { videoManager } from '@/content/core/video/video-manager';
import type { ListeningSessionCoordinator } from '@/content/features/listening-session/listening-session-coordinator';
import { useListeningMissionActiveStore } from '@/content/features/listening-session/mission-active-store';
import { useSubtitleStore } from '@/content/features/subtitle/subtitle-store';

import { coupangStrategy } from './coupang-play';
import { createVideoLifecycleHandler, initializeMessageListener } from './message-handler';
import { VideoLifecycleEvent } from './video-lifecycle/video-lifecycle-monitor';

vi.mock('@storage/registered-subtitle', () => ({ getRegisteredSubtitles: vi.fn() }));
vi.mock('@storage/subtitle', () => ({ getLocalSubtitle: vi.fn() }));
vi.mock('@utils/coupang-play', () => ({ getCoupangPlayVideoId: vi.fn() }));
vi.mock('@utils/message', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@utils/message')>();
  return { ...actual, sendMessage: vi.fn() };
});
vi.mock('./coupang-play', () => ({ coupangStrategy: { fetchSubtitles: vi.fn() } }));

const VIDEO_ID = '123e4567-e89b-12d3-a456-426614174000';
const OTHER_VIDEO_ID = '123e4567-e89b-12d3-a456-426614174001';
const SUBTITLE_ID = 'subtitle-00000000-0000-4000-8000-000000000001';
const SECOND_SUBTITLE_ID = 'subtitle-00000000-0000-4000-8000-000000000002';

const createNativeRequest = (requestId = 'request-1', videoId: string | null = VIDEO_ID) => ({
  requestId,
  videoId,
  url: 'https://synthetic.test/playback',
  headers: [] as chrome.webRequest.HttpHeader[],
});

const contentEvent = (video: HTMLVideoElement): VideoLifecycleEvent => ({
  state: 'content',
  video,
  videoId: VIDEO_ID,
  delayed: false,
});

const createLifecycleDependencies = () => {
  let currentVideo: HTMLVideoElement | null = null;
  return {
    dependencies: {
      getVideo: () => currentVideo,
      isCurrentVideo: (video: HTMLVideoElement) => currentVideo === video && video.isConnected,
      setVideo: vi.fn((video: HTMLVideoElement) => {
        currentVideo = video;
      }),
      clearVideo: vi.fn(() => {
        currentVideo = null;
      }),
      clearNativeCues: vi.fn(),
      setupContainer: vi.fn(),
      resetElements: vi.fn(),
      setCurrentTime: vi.fn(),
      setDetectionStatus: vi.fn(),
      reportContentStatus: vi.fn(),
    },
    getCurrentVideo: () => currentVideo,
  };
};

describe('canonical video lifecycle handler', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('attaches a new content video once and reports detection', () => {
    const { dependencies, getCurrentVideo } = createLifecycleDependencies();
    const handle = createVideoLifecycleHandler(dependencies);
    const video = document.createElement('video');
    document.body.appendChild(video);

    handle(contentEvent(video));
    handle(contentEvent(video));

    expect(getCurrentVideo()).toBe(video);
    expect(dependencies.setVideo).toHaveBeenCalledOnce();
    expect(dependencies.setupContainer).toHaveBeenCalledOnce();
    expect(dependencies.setDetectionStatus).toHaveBeenLastCalledWith('detected');
    expect(dependencies.reportContentStatus).toHaveBeenLastCalledWith(true, 1, VIDEO_ID);
  });

  it.each(['advertisement', 'placeholder', 'waiting', 'transitioning'] as const)(
    'clears content state and time for %s',
    (state) => {
      const { dependencies, getCurrentVideo } = createLifecycleDependencies();
      const handle = createVideoLifecycleHandler(dependencies);
      const video = document.createElement('video');
      document.body.appendChild(video);
      handle(contentEvent(video));

      handle({ state, video: state === 'advertisement' ? video : null, videoId: null, delayed: false });

      expect(getCurrentVideo()).toBeNull();
      expect(dependencies.clearVideo).toHaveBeenCalledOnce();
      expect(dependencies.clearNativeCues).toHaveBeenCalledOnce();
      expect(dependencies.resetElements).toHaveBeenCalledOnce();
      expect(dependencies.setCurrentTime).toHaveBeenCalledWith(0);
      expect(dependencies.setDetectionStatus).toHaveBeenLastCalledWith('detecting');
      expect(dependencies.reportContentStatus).toHaveBeenLastCalledWith(false, 1, null);
    }
  );

  it('reports delayed failure without clearing absent content', () => {
    const { dependencies } = createLifecycleDependencies();
    const handle = createVideoLifecycleHandler(dependencies);

    handle({ state: 'waiting', video: null, videoId: null, delayed: true });

    expect(dependencies.clearVideo).not.toHaveBeenCalled();
    expect(dependencies.resetElements).not.toHaveBeenCalled();
    expect(dependencies.setDetectionStatus).toHaveBeenLastCalledWith('failed');
    expect(dependencies.reportContentStatus).toHaveBeenLastCalledWith(false, 0, null);
  });

  it('clears native cues when Coupang replaces one content video directly', () => {
    const { dependencies, getCurrentVideo } = createLifecycleDependencies();
    const handle = createVideoLifecycleHandler(dependencies);
    const first = document.createElement('video');
    const second = document.createElement('video');
    document.body.append(first, second);
    handle(contentEvent(first));

    handle(contentEvent(second));

    expect(getCurrentVideo()).toBe(second);
    expect(dependencies.clearNativeCues).toHaveBeenCalledOnce();
    expect(dependencies.resetElements).toHaveBeenCalledOnce();
    expect(dependencies.setCurrentTime).toHaveBeenCalledWith(0);
    expect(dependencies.setVideo).toHaveBeenCalledTimes(2);
    expect(dependencies.reportContentStatus).toHaveBeenLastCalledWith(true, 2, VIDEO_ID);
  });
});

describe('canonical content messages', () => {
  beforeEach(() => {
    videoManager.clear();
    useListeningMissionActiveStore.getState().setActive(false);
    document.body.replaceChildren();
    vi.mocked(getRegisteredSubtitles).mockReset().mockResolvedValue([]);
    vi.mocked(getLocalSubtitle).mockReset();
    vi.mocked(getCoupangPlayVideoId).mockReset().mockReturnValue(VIDEO_ID);
    vi.mocked(coupangStrategy.fetchSubtitles).mockReset().mockResolvedValue([]);
    vi.mocked(sendMessage).mockReset().mockResolvedValue({ success: true, data: {} } as never);
    const store = useSubtitleStore.getState();
    store.clearCaches();
    store.setSettings(structuredClone(DEFAULT_V2_SYNC_STORAGE));
  });

  it('returns page-owned video identity with the synchronous content ping', () => {
    const { dispatch } = createMessageHarness();

    const request = dispatch('pingContent', undefined);

    expect(request.sendResponse).toHaveBeenCalledWith({
      success: true,
      data: {
        contentInstanceId: expect.any(String),
        hasVideo: false,
        routeChangedAt: expect.any(Number),
        videoId: VIDEO_ID,
        videoRevision: 0,
      },
    });
  });

  it('returns atomic native learning and support tracks with the same identity as ping', () => {
    const video = attachVideo(12.345);
    useSubtitleStore.getState().setNativeCues('en', [
      { start: 1, end: 2, text: 'Native learning' },
    ]);
    useSubtitleStore.getState().setNativeCues('ko', [
      { start: 1, end: 2, text: 'Native support' },
    ]);
    const subtitleRevision = useSubtitleStore.getState().subtitleRevision;
    const { dispatch } = createMessageHarness();

    const ping = dispatch('pingContent', undefined);
    const overview = dispatch('getSubtitleOverview', undefined);
    const time = dispatch('getVideoTime', undefined);
    const pingData = ping.sendResponse.mock.calls[0][0].data;
    const { hasVideo, ...identity } = pingData;

    expect(video.currentTime).toBe(12.345);
    expect(hasVideo).toBe(true);
    expect(overview.sendResponse).toHaveBeenCalledWith({
      success: true,
      data: {
        status: 'ready',
        identity,
        subtitleRevision,
        currentTime: 12.345,
        tracks: {
          learning: {
            role: 'learning',
            language: 'en',
            source: { kind: 'native', language: 'en' },
            cues: [
              {
                sourceIndex: 0,
                startTime: 1,
                endTime: 2,
                text: 'Native learning',
                alignedSupport: { sourceIndices: [0], text: 'Native support' },
              },
            ],
          },
          support: {
            role: 'support',
            language: 'ko',
            source: { kind: 'native', language: 'ko' },
            cues: [
              { sourceIndex: 0, startTime: 1, endTime: 2, text: 'Native support' },
            ],
          },
        },
      },
    });
    expect(time.sendResponse).toHaveBeenCalledWith({
      success: true,
      data: { status: 'ready', identity, subtitleRevision, currentTime: 12.345 },
    });

    useSubtitleStore.getState().setNativeCues('en', [{ start: 3, end: 4, text: 'Late cue' }]);
    const lateTime = dispatch('getVideoTime', undefined);
    expect(lateTime.sendResponse).toHaveBeenCalledWith({
      success: true,
      data: {
        status: 'ready',
        identity,
        subtitleRevision: subtitleRevision + 1,
        currentTime: 12.345,
      },
    });
  });

  it('returns registered source metadata and applies each role delay exactly once', () => {
    attachVideo(4);
    useSubtitleStore.getState().setRegisteredSelection('learning', {
      subtitleId: SUBTITLE_ID,
      cues: [{ start: 1.2344, end: 2.3456, text: '<i>Registered</i>' }],
      delay: 0.1112,
    });
    useSubtitleStore.getState().setRegisteredSelection('support', {
      subtitleId: SECOND_SUBTITLE_ID,
      cues: [{ start: 1.3456, end: 2.4567, text: '<b>Registered support</b>' }],
      delay: 0,
    });
    const subtitleRevision = useSubtitleStore.getState().subtitleRevision;
    const { dispatch } = createMessageHarness();

    const request = dispatch('getSubtitleOverview', undefined);

    expect(request.sendResponse).toHaveBeenCalledWith({
      success: true,
      data: {
        status: 'ready',
        identity: expect.objectContaining({ videoId: VIDEO_ID }),
        subtitleRevision,
        currentTime: 4,
        tracks: {
          learning: {
            role: 'learning',
            language: 'en',
            source: {
              kind: 'registered',
              language: 'en',
              subtitleId: SUBTITLE_ID,
              delaySeconds: 0.1112,
            },
            cues: [
              {
                sourceIndex: 0,
                startTime: 1.346,
                endTime: 2.457,
                text: 'Registered',
                alignedSupport: {
                  sourceIndices: [0],
                  text: 'Registered support',
                },
              },
            ],
          },
          support: {
            role: 'support',
            language: 'ko',
            source: {
              kind: 'registered',
              language: 'ko',
              subtitleId: SECOND_SUBTITLE_ID,
              delaySeconds: 0,
            },
            cues: [
              {
                sourceIndex: 0,
                startTime: 1.346,
                endTime: 2.457,
                text: 'Registered support',
              },
            ],
          },
        },
      },
    });
  });

  it('returns exact no-video and support-null states without invented role data', () => {
    const { dispatch: dispatchWithoutVideo } = createMessageHarness();
    const overviewWithoutVideo = dispatchWithoutVideo('getSubtitleOverview', undefined);
    const timeWithoutVideo = dispatchWithoutVideo('getVideoTime', undefined);
    const playWithoutVideo = dispatchWithoutVideo('playVideo', { startTime: 10 });
    const noVideoIdentity = overviewWithoutVideo.sendResponse.mock.calls[0][0].data.identity;

    expect(overviewWithoutVideo.sendResponse).toHaveBeenCalledWith({
      success: true,
      data: { status: 'no-video', identity: noVideoIdentity },
    });
    expect(timeWithoutVideo.sendResponse).toHaveBeenCalledWith({
      success: true,
      data: { status: 'no-video', identity: noVideoIdentity },
    });
    expect(playWithoutVideo.sendResponse).toHaveBeenCalledWith({
      success: true,
      data: { status: 'no-video' },
    });

    attachVideo(1);
    const state = useSubtitleStore.getState();
    state.setSettings({
      learningProfile: { learningLanguage: 'en', supportLanguage: null },
      subtitleDisplay: state.subtitleDisplay,
    });
    const { dispatch: dispatchWithVideo } = createMessageHarness();
    const overview = dispatchWithVideo('getSubtitleOverview', undefined);

    expect(overview.sendResponse).toHaveBeenCalledWith({
      success: true,
      data: {
        status: 'ready',
        identity: expect.objectContaining({ videoId: VIDEO_ID }),
        subtitleRevision: useSubtitleStore.getState().subtitleRevision,
        currentTime: 1,
        tracks: {
          learning: {
            role: 'learning',
            language: 'en',
            source: { kind: 'native', language: 'en' },
            cues: [],
          },
          support: null,
        },
      },
    });
  });

  it('fails closed during the SPA route gap before lifecycle catches up', async () => {
    const video = attachVideo(12);
    useSubtitleStore.getState().setNativeCues('en', [
      { start: 10, end: 11, text: 'Video A learning cue' },
    ]);
    const subtitleRevision = useSubtitleStore.getState().subtitleRevision;
    const { dispatch } = createMessageHarness();
    const ping = dispatch('pingContent', undefined);
    const { hasVideo, ...videoAIdentity } = ping.sendResponse.mock.calls[0][0].data;

    expect(hasVideo).toBe(true);
    expect(videoAIdentity.videoId).toBe(VIDEO_ID);

    vi.mocked(getCoupangPlayVideoId).mockReturnValue(OTHER_VIDEO_ID);

    const overview = dispatch('getSubtitleOverview', undefined);
    const time = dispatch('getVideoTime', undefined);
    expect(overview.sendResponse).toHaveBeenCalledWith({
      success: true,
      data: { status: 'no-video', identity: videoAIdentity },
    });
    expect(time.sendResponse).toHaveBeenCalledWith({
      success: true,
      data: { status: 'no-video', identity: videoAIdentity },
    });

    const seek = dispatch('playVideo', {
      startTime: 30,
      expectedIdentity: videoAIdentity,
      expectedSubtitleRevision: subtitleRevision,
    });
    expect(seek.sendResponse).toHaveBeenCalledWith({
      success: true,
      data: { status: 'stale' },
    });
    expect(video.currentTime).toBe(12);

    const save = dispatch('saveSubtitleOverviewCue', {
      expectedIdentity: videoAIdentity,
      expectedSubtitleRevision: subtitleRevision,
      learningSourceIndex: 0,
    });
    await expectResponse(save.sendResponse, {
      success: true,
      data: { status: 'stale' },
    });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('saves the exact learning source index without seeking and reports aligned support', async () => {
    const video = attachVideo(99);
    useSubtitleStore.getState().setNativeCues('en', [
      { start: 0, end: 1, text: 'Earlier cue' },
      { start: 10, end: 11, text: '<i>Chosen &amp; learning cue</i>' },
    ]);
    useSubtitleStore.getState().setNativeCues('ko', [
      { start: 10, end: 11, text: '<b>Aligned &amp; support cue</b>' },
    ]);
    const subtitleRevision = useSubtitleStore.getState().subtitleRevision;
    const { dispatch } = createMessageHarness();
    const ping = dispatch('pingContent', undefined);
    const { hasVideo, ...identity } = ping.sendResponse.mock.calls[0][0].data;
    const overview = dispatch('getSubtitleOverview', undefined);

    const request = dispatch('saveSubtitleOverviewCue', {
      expectedIdentity: identity,
      expectedSubtitleRevision: subtitleRevision,
      learningSourceIndex: 1,
    });

    expect(hasVideo).toBe(true);
    expect(overview.sendResponse.mock.calls[0][0].data.tracks.learning.cues[1]).toMatchObject({
      text: 'Chosen & learning cue',
      alignedSupport: { text: 'Aligned & support cue' },
    });
    expect(request.result).toBe(true);
    await expectResponse(request.sendResponse, {
      success: true,
      data: { status: 'saved-with-support' },
    });
    expect(video.currentTime).toBe(99);
    expect(sendMessage).toHaveBeenCalledWith('addLearningCard', {
      card: {
        id: expect.stringMatching(/^card-/),
        content: {
          learning: { text: 'Chosen & learning cue', language: 'en' },
          support: { text: 'Aligned & support cue', language: 'ko' },
        },
        source: { url: window.location.href, startTime: 10, endTime: 11 },
        studyState: 'active',
        createdAt: expect.any(String),
      },
    });
  });

  it('saves a learning-only card when no support cue aligns', async () => {
    attachVideo(50);
    useSubtitleStore.getState().setNativeCues('en', [
      { start: 3, end: 4, text: 'Learning only' },
    ]);
    useSubtitleStore.getState().setNativeCues('ko', [
      { start: 30, end: 31, text: 'Unrelated support' },
    ]);
    const subtitleRevision = useSubtitleStore.getState().subtitleRevision;
    const { dispatch } = createMessageHarness();
    const ping = dispatch('pingContent', undefined);
    const { hasVideo: _, ...identity } = ping.sendResponse.mock.calls[0][0].data;

    const request = dispatch('saveSubtitleOverviewCue', {
      expectedIdentity: identity,
      expectedSubtitleRevision: subtitleRevision,
      learningSourceIndex: 0,
    });

    expect(request.result).toBe(true);
    await expectResponse(request.sendResponse, {
      success: true,
      data: { status: 'saved-learning-only' },
    });
    expect(sendMessage).toHaveBeenCalledWith(
      'addLearningCard',
      expect.objectContaining({
        card: expect.objectContaining({
          content: { learning: { text: 'Learning only', language: 'en' } },
          source: { url: window.location.href, startTime: 3, endTime: 4 },
        }),
      })
    );
  });

  it('omits formatting-only aligned support exactly as the overview does', async () => {
    attachVideo(1);
    useSubtitleStore.getState().setNativeCues('en', [
      { start: 0, end: 1, text: '<i>Visible learning</i>' },
    ]);
    useSubtitleStore.getState().setNativeCues('ko', [
      { start: 0, end: 1, text: '<i></i>' },
    ]);
    const subtitleRevision = useSubtitleStore.getState().subtitleRevision;
    const { dispatch } = createMessageHarness();
    const ping = dispatch('pingContent', undefined);
    const { hasVideo, ...identity } = ping.sendResponse.mock.calls[0][0].data;

    const overview = dispatch('getSubtitleOverview', undefined);
    const request = dispatch('saveSubtitleOverviewCue', {
      expectedIdentity: identity,
      expectedSubtitleRevision: subtitleRevision,
      learningSourceIndex: 0,
    });

    expect(hasVideo).toBe(true);
    expect(overview.sendResponse.mock.calls[0][0].data.tracks.learning.cues[0]).not.toHaveProperty(
      'alignedSupport'
    );
    await expectResponse(request.sendResponse, {
      success: true,
      data: { status: 'saved-learning-only' },
    });
    expect(sendMessage).toHaveBeenCalledWith(
      'addLearningCard',
      expect.objectContaining({
        card: expect.objectContaining({
          content: { learning: { text: 'Visible learning', language: 'en' } },
        }),
      })
    );
  });

  it('fails closed for stale overview identities and subtitle revisions', async () => {
    attachVideo(1);
    useSubtitleStore.getState().setNativeCues('en', [{ start: 0, end: 1, text: 'Cue' }]);
    const subtitleRevision = useSubtitleStore.getState().subtitleRevision;
    const { dispatch } = createMessageHarness();
    const ping = dispatch('pingContent', undefined);
    const { hasVideo: _, ...identity } = ping.sendResponse.mock.calls[0][0].data;

    const staleIdentity = dispatch('saveSubtitleOverviewCue', {
      expectedIdentity: { ...identity, videoRevision: identity.videoRevision + 1 },
      expectedSubtitleRevision: subtitleRevision,
      learningSourceIndex: 0,
    });
    await expectResponse(staleIdentity.sendResponse, {
      success: true,
      data: { status: 'stale' },
    });

    const staleRevision = dispatch('saveSubtitleOverviewCue', {
      expectedIdentity: identity,
      expectedSubtitleRevision: subtitleRevision + 1,
      learningSourceIndex: 0,
    });
    await expectResponse(staleRevision.sendResponse, {
      success: true,
      data: { status: 'stale' },
    });

    for (const params of [
      { learningSourceIndex: 0 },
      {
        expectedIdentity: identity,
        learningSourceIndex: 0,
      },
      {
        expectedSubtitleRevision: subtitleRevision,
        learningSourceIndex: 0,
      },
      {
        expectedIdentity: { ...identity, contentInstanceId: '' },
        expectedSubtitleRevision: subtitleRevision,
        learningSourceIndex: 0,
      },
      {
        expectedIdentity: identity,
        expectedSubtitleRevision: Number.NaN,
        learningSourceIndex: 0,
      },
    ]) {
      const invalidGuard = dispatch('saveSubtitleOverviewCue', params);
      await expectResponse(invalidGuard.sendResponse, {
        success: true,
        data: { status: 'stale' },
      });
    }
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('rejects invalid, missing, and empty learning source indices', async () => {
    attachVideo(1);
    useSubtitleStore.getState().setNativeCues('en', [
      { start: 0, end: 1, text: '   ' },
      { start: 1, end: 2, text: '<i></i>' },
    ]);
    const subtitleRevision = useSubtitleStore.getState().subtitleRevision;
    const { dispatch } = createMessageHarness();
    const ping = dispatch('pingContent', undefined);
    const { hasVideo: _, ...identity } = ping.sendResponse.mock.calls[0][0].data;

    for (const learningSourceIndex of [-1, 1.5, 4, 0, 1]) {
      const request = dispatch('saveSubtitleOverviewCue', {
        expectedIdentity: identity,
        expectedSubtitleRevision: subtitleRevision,
        learningSourceIndex,
      });
      await expectResponse(request.sendResponse, {
        success: true,
        data: { status: 'cue-unavailable' },
      });
    }
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('returns no-video before building or storing a card', async () => {
    const { dispatch } = createMessageHarness();
    const ping = dispatch('pingContent', undefined);
    const { hasVideo, ...identity } = ping.sendResponse.mock.calls[0][0].data;

    const request = dispatch('saveSubtitleOverviewCue', {
      expectedIdentity: identity,
      expectedSubtitleRevision: useSubtitleStore.getState().subtitleRevision,
      learningSourceIndex: 0,
    });

    expect(hasVideo).toBe(false);
    await expectResponse(request.sendResponse, {
      success: true,
      data: { status: 'no-video' },
    });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('reports storage failures without leaving the save coordinator locked', async () => {
    attachVideo(1);
    useSubtitleStore.getState().setNativeCues('en', [{ start: 0, end: 1, text: 'Cue' }]);
    vi.mocked(sendMessage)
      .mockResolvedValueOnce({ success: false, message: 'storage failed' } as never)
      .mockResolvedValueOnce({ success: true, data: {} } as never);
    const subtitleRevision = useSubtitleStore.getState().subtitleRevision;
    const { dispatch } = createMessageHarness();
    const ping = dispatch('pingContent', undefined);
    const { hasVideo: _, ...identity } = ping.sendResponse.mock.calls[0][0].data;
    const params = {
      expectedIdentity: identity,
      expectedSubtitleRevision: subtitleRevision,
      learningSourceIndex: 0,
    };

    const failed = dispatch('saveSubtitleOverviewCue', params);
    await expectResponse(failed.sendResponse, {
      success: true,
      data: { status: 'error' },
    });

    const retry = dispatch('saveSubtitleOverviewCue', params);
    await expectResponse(retry.sendResponse, {
      success: true,
      data: { status: 'saved-learning-only' },
    });
  });

  it('returns busy while another overview card save is pending', async () => {
    attachVideo(1);
    useSubtitleStore.getState().setNativeCues('en', [{ start: 0, end: 1, text: 'Cue' }]);
    const deferred = createDeferred<never>();
    vi.mocked(sendMessage).mockReturnValueOnce(deferred.promise);
    const subtitleRevision = useSubtitleStore.getState().subtitleRevision;
    const { dispatch } = createMessageHarness();
    const ping = dispatch('pingContent', undefined);
    const { hasVideo: _, ...identity } = ping.sendResponse.mock.calls[0][0].data;
    const params = {
      expectedIdentity: identity,
      expectedSubtitleRevision: subtitleRevision,
      learningSourceIndex: 0,
    };

    const first = dispatch('saveSubtitleOverviewCue', params);
    const second = dispatch('saveSubtitleOverviewCue', params);

    await expectResponse(second.sendResponse, {
      success: true,
      data: { status: 'busy' },
    });
    deferred.resolve({ success: true, data: {} } as never);
    await expectResponse(first.sendResponse, {
      success: true,
      data: { status: 'saved-learning-only' },
    });
    expect(sendMessage).toHaveBeenCalledOnce();
  });

  it('rejects stale guarded seeks and keeps legacy callers working', () => {
    const video = attachVideo(10);
    const { dispatch } = createMessageHarness();
    const ping = dispatch('pingContent', undefined);
    const { hasVideo, ...identity } = ping.sendResponse.mock.calls[0][0].data;
    const subtitleRevision = useSubtitleStore.getState().subtitleRevision;

    expect(hasVideo).toBe(true);

    const staleIdentity = dispatch('playVideo', {
      startTime: 20,
      expectedIdentity: { ...identity, videoRevision: identity.videoRevision + 1 },
      expectedSubtitleRevision: subtitleRevision,
    });
    expect(staleIdentity.sendResponse).toHaveBeenCalledWith({
      success: true,
      data: { status: 'stale' },
    });
    expect(video.currentTime).toBe(10);

    useSubtitleStore.getState().setNativeCues('en', [{ start: 1, end: 2, text: 'New cue' }]);
    const staleRevision = dispatch('playVideo', {
      startTime: 30,
      expectedIdentity: identity,
      expectedSubtitleRevision: subtitleRevision,
    });
    expect(staleRevision.sendResponse).toHaveBeenCalledWith({
      success: true,
      data: { status: 'stale' },
    });
    expect(video.currentTime).toBe(10);

    const guarded = dispatch('playVideo', {
      startTime: 35,
      expectedIdentity: identity,
      expectedSubtitleRevision: useSubtitleStore.getState().subtitleRevision,
    });
    expect(guarded.sendResponse).toHaveBeenCalledWith({
      success: true,
      data: { status: 'played' },
    });
    expect(video.currentTime).toBe(35);

    const legacy = dispatch('playVideo', { startTime: 40 });
    expect(legacy.sendResponse).toHaveBeenCalledWith({
      success: true,
      data: { status: 'played' },
    });
    expect(video.currentTime).toBe(40);
  });

  it('rechecks guarded deferred seeks before canplay changes the captured video time', () => {
    const capturedVideo = attachVideo(10, 0);
    const { dispatch } = createMessageHarness();
    const ping = dispatch('pingContent', undefined);
    const { hasVideo, ...identity } = ping.sendResponse.mock.calls[0][0].data;
    const subtitleRevision = useSubtitleStore.getState().subtitleRevision;

    expect(hasVideo).toBe(true);

    const pendingSwap = dispatch('playVideo', {
      startTime: 20,
      expectedIdentity: identity,
      expectedSubtitleRevision: subtitleRevision,
    });
    expect(pendingSwap.sendResponse).toHaveBeenCalledWith({
      success: true,
      data: { status: 'played' },
    });

    const replacementVideo = attachVideo(50);
    capturedVideo.dispatchEvent(new Event('canplay'));
    expect(capturedVideo.currentTime).toBe(10);
    expect(replacementVideo.currentTime).toBe(50);

    videoManager.clear();
    const revisionVideo = attachVideo(11, 0);
    const currentRevision = useSubtitleStore.getState().subtitleRevision;
    const pendingRevision = dispatch('playVideo', {
      startTime: 30,
      expectedIdentity: identity,
      expectedSubtitleRevision: currentRevision,
    });
    expect(pendingRevision.sendResponse).toHaveBeenCalledWith({
      success: true,
      data: { status: 'played' },
    });

    useSubtitleStore.getState().setNativeCues('en', [{ start: 2, end: 3, text: 'Changed' }]);
    revisionVideo.dispatchEvent(new Event('canplay'));
    expect(revisionVideo.currentTime).toBe(11);
  });

  it('keeps legacy and deferred seeks inert while a Listening Mission owns media', () => {
    const video = attachVideo(10, 0);
    const { dispatch } = createMessageHarness();
    const deferred = dispatch('playVideo', { startTime: 20 });
    expect(deferred.sendResponse).toHaveBeenCalledWith({
      success: true,
      data: { status: 'played' },
    });

    useListeningMissionActiveStore.getState().setActive(true);
    const blocked = dispatch('playVideo', { startTime: 30 });
    expect(blocked.sendResponse).toHaveBeenCalledWith({
      success: true,
      data: { status: 'stale' },
    });

    video.dispatchEvent(new Event('canplay'));
    expect(video.currentTime).toBe(10);
  });

  it('acquires raw native cues for every supported language and ignores unsupported tracks', async () => {
    const languages = Object.keys(LANGUAGES) as Language[];
    const tracks = languages.map((language, index) => ({
      lang: language,
      subtitleData: [{ start: index, end: index + 1, text: language }],
    }));
    const expectedCache = Object.fromEntries(
      tracks.map(({ lang, subtitleData }) => [lang, subtitleData])
    );
    useSubtitleStore.getState().setNativeCues('ko', [{ start: 0, end: 1, text: 'Stale' }]);
    vi.mocked(coupangStrategy.fetchSubtitles).mockResolvedValue([
      ...tracks,
      { lang: 'unsupported', subtitleData: [{ start: 1, end: 2, text: 'Ignored' }] },
    ]);
    const { dispatch } = createMessageHarness();

    const request = dispatch('fetchVideoMetadata', createNativeRequest());
    expect(request.result).toBe(true);
    await expectResponse(request.sendResponse, { success: true });

    expect(useSubtitleStore.getState().nativeCueCache).toEqual(expectedCache);
  });

  it('fails native acquisition without retaining a partial cache when a supported body is invalid', async () => {
    useSubtitleStore.getState().setNativeCues('ko', [{ start: 0, end: 1, text: 'Stale' }]);
    vi.mocked(coupangStrategy.fetchSubtitles).mockResolvedValue([
      { lang: 'en', subtitleData: [{ start: 1, end: 2, text: 'Valid' }] },
      { lang: 'ja', subtitleData: [{ start: 3, end: 2, text: 'Invalid' }] },
    ]);
    const { dispatch } = createMessageHarness();

    const request = dispatch('fetchVideoMetadata', createNativeRequest());
    expect(request.result).toBe(true);
    await expectFailure(request.sendResponse);

    expect(useSubtitleStore.getState().nativeCueCache).toEqual({});
  });

  it('keeps native cues when a generic element reset is requested', () => {
    const cues = [{ start: 0, end: 1, text: 'Synthetic cue' }];
    useSubtitleStore.getState().setNativeCues('en', cues);
    const { dispatch } = createMessageHarness();

    dispatch('resetElement', undefined);

    expect(useSubtitleStore.getState().nativeCueCache).toEqual({ en: cues });
  });

  it('ignores a superseded native response that finishes after the latest request', async () => {
    const firstFetch = createDeferred<FetchedSubtitles>();
    const secondFetch = createDeferred<FetchedSubtitles>();
    vi.mocked(coupangStrategy.fetchSubtitles)
      .mockImplementationOnce(() => firstFetch.promise)
      .mockImplementationOnce(() => secondFetch.promise);
    const { dispatch } = createMessageHarness();

    const first = dispatch('fetchVideoMetadata', createNativeRequest('request-1'));
    const second = dispatch('fetchVideoMetadata', createNativeRequest('request-2'));
    secondFetch.resolve([
      { lang: 'en', subtitleData: [{ start: 2, end: 3, text: 'Latest synthetic cue' }] },
    ]);
    await expectResponse(second.sendResponse, { success: true });
    firstFetch.resolve([
      { lang: 'en', subtitleData: [{ start: 0, end: 1, text: 'Older synthetic cue' }] },
    ]);
    await expectResponse(first.sendResponse, { success: true });

    expect(useSubtitleStore.getState().nativeCueCache.en).toEqual([
      { start: 2, end: 3, text: 'Latest synthetic cue' },
    ]);
  });

  it('does not apply native cues after navigation to a different video', async () => {
    const existing = [{ start: 0, end: 1, text: 'Existing synthetic cue' }];
    useSubtitleStore.getState().setNativeCues('ko', existing);
    vi.mocked(getCoupangPlayVideoId).mockReturnValue(OTHER_VIDEO_ID);
    vi.mocked(coupangStrategy.fetchSubtitles).mockResolvedValue([
      { lang: 'en', subtitleData: [{ start: 2, end: 3, text: 'Stale synthetic cue' }] },
    ]);
    const { dispatch } = createMessageHarness();

    const request = dispatch('fetchVideoMetadata', createNativeRequest('request-1', VIDEO_ID));
    await expectResponse(request.sendResponse, { success: true });

    expect(useSubtitleStore.getState().nativeCueCache).toEqual({ ko: existing });
  });

  it('sets a registered role with raw cues and a separately validated delay, then refreshes it', async () => {
    const initialCues = [{ start: 10, end: 11, text: 'Initial' }];
    vi.mocked(getRegisteredSubtitles).mockResolvedValue([
      { id: SUBTITLE_ID, title: 'English', language: 'en', savedAt: '2026-08-04T00:00:00.000Z', delay: 2 },
    ]);
    vi.mocked(getLocalSubtitle).mockResolvedValue(initialCues);
    const { dispatch } = createMessageHarness();

    const select = dispatch('setSubtitleRole', { role: 'learning', subtitleId: SUBTITLE_ID });
    expect(select.result).toBe(true);
    await expectResponse(select.sendResponse, { success: true });
    expect(useSubtitleStore.getState().registeredSelections.learning).toEqual({
      subtitleId: SUBTITLE_ID,
      cues: initialCues,
      delay: 2,
    });

    const refreshedCues = [{ start: 20, end: 21, text: 'Refreshed' }];
    vi.mocked(getRegisteredSubtitles).mockResolvedValue([
      { id: SUBTITLE_ID, title: 'English', language: 'en', savedAt: '2026-08-04T00:00:00.000Z', delay: -1 },
    ]);
    vi.mocked(getLocalSubtitle).mockResolvedValue(refreshedCues);
    const refresh = dispatch('refreshRegisteredSubtitle', { subtitleId: SUBTITLE_ID });
    expect(refresh.result).toBe(true);
    await expectResponse(refresh.sendResponse, { success: true });
    expect(useSubtitleStore.getState().registeredSelections.learning).toEqual({
      subtitleId: SUBTITLE_ID,
      cues: refreshedCues,
      delay: -1,
    });
  });

  it('fails closed for mismatched languages, invalid delays, and invalid raw bodies', async () => {
    const { dispatch } = createMessageHarness();

    vi.mocked(getRegisteredSubtitles).mockResolvedValue([
      { id: SUBTITLE_ID, title: 'Korean', language: 'ko', savedAt: '2026-08-04T00:00:00.000Z' },
    ]);
    const languageFailure = dispatch('setSubtitleRole', { role: 'learning', subtitleId: SUBTITLE_ID });
    expect(languageFailure.result).toBe(true);
    await expectFailure(languageFailure.sendResponse);

    vi.mocked(getRegisteredSubtitles).mockResolvedValue([
      {
        id: SUBTITLE_ID,
        title: 'English',
        language: 'en',
        savedAt: '2026-08-04T00:00:00.000Z',
        delay: Number.NaN,
      },
    ]);
    vi.mocked(getLocalSubtitle).mockResolvedValue([{ start: 1, end: 2, text: 'Cue' }]);
    const delayFailure = dispatch('setSubtitleRole', { role: 'learning', subtitleId: SUBTITLE_ID });
    expect(delayFailure.result).toBe(true);
    await expectFailure(delayFailure.sendResponse);

    vi.mocked(getRegisteredSubtitles).mockResolvedValue([
      { id: SECOND_SUBTITLE_ID, title: 'English', language: 'en', savedAt: '2026-08-04T00:00:00.000Z' },
    ]);
    vi.mocked(getLocalSubtitle).mockResolvedValue([{ start: 2, end: 1, text: 'Invalid' }]);
    const bodyFailure = dispatch('setSubtitleRole', { role: 'learning', subtitleId: SECOND_SUBTITLE_ID });
    expect(bodyFailure.result).toBe(true);
    await expectFailure(bodyFailure.sendResponse);

    expect(useSubtitleStore.getState().registeredSelections.learning).toBeNull();
  });

  it('returns true and responds exactly once for every asynchronous failure', async () => {
    vi.mocked(coupangStrategy.fetchSubtitles).mockRejectedValue(new Error('network'));
    useSubtitleStore.getState().setRegisteredSelection('learning', {
      subtitleId: SUBTITLE_ID,
      cues: [{ start: 1, end: 2, text: 'Selected' }],
      delay: 0,
    });
    const { dispatch } = createMessageHarness();

    for (const [message, params] of [
      ['fetchVideoMetadata', createNativeRequest()],
      ['setSubtitleRole', { role: 'learning', subtitleId: SUBTITLE_ID }],
      ['refreshRegisteredSubtitle', { subtitleId: SUBTITLE_ID }],
    ] as const) {
      const request = dispatch(message, params);
      expect(request.result).toBe(true);
      await expectFailure(request.sendResponse);
      expect(request.sendResponse).toHaveBeenCalledOnce();
    }
  });

  it('routes every Listening Mission request directly to the owning content coordinator', async () => {
    const coordinator = createListeningSessionCoordinatorMock();
    const { dispatch, dispose } = createMessageHarness(coordinator);
    const identity = {
      contentInstanceId: 'content-listening',
      routeChangedAt: 1,
      videoId: VIDEO_ID,
      videoRevision: 2,
    };
    const segmentKey = `segment-v1-${'a'.repeat(64)}` as MessageSchema['beginListeningSession']['params']['segmentKeys'][number];
    const beginParams: MessageSchema['beginListeningSession']['params'] = {
      expectedIdentity: identity,
      expectedSubtitleRevision: 3,
      segmentKeys: [segmentKey],
    };
    const heartbeatParams: MessageSchema['heartbeatListeningSession']['params'] = {
      expectedIdentity: identity,
      expectedSubtitleRevision: 3,
      sessionId: 'session-listening',
    };
    const playParams: MessageSchema['playListeningSegment']['params'] = {
      rate: 0.75,
      segmentKey,
      sessionId: 'session-listening',
    };
    const saveParams: MessageSchema['saveListeningSegment']['params'] = {
      segmentKey,
      sessionId: 'session-listening',
    };
    const endParams: MessageSchema['endListeningSession']['params'] = {
      mode: 'restore-start',
      sessionId: 'session-listening',
    };

    const requests = [
      dispatch('getListeningCatalog', undefined),
      dispatch('beginListeningSession', beginParams),
      dispatch('heartbeatListeningSession', heartbeatParams),
      dispatch('playListeningSegment', playParams),
      dispatch('saveListeningSegment', saveParams),
      dispatch('endListeningSession', endParams),
    ];

    await Promise.all([
      expectResponse(requests[0].sendResponse, { success: true, data: { status: 'no-video' } }),
      expectResponse(requests[1].sendResponse, { success: true, data: { status: 'busy' } }),
      expectResponse(requests[2].sendResponse, { success: true, data: { status: 'alive' } }),
      expectResponse(requests[3].sendResponse, { success: true, data: { status: 'played' } }),
      expectResponse(requests[4].sendResponse, { success: true, data: { status: 'busy' } }),
      expectResponse(requests[5].sendResponse, { success: true, data: { status: 'already-ended' } }),
    ]);
    for (const request of requests) expect(request.result).toBe(true);
    expect(coordinator.getCatalog).toHaveBeenCalledOnce();
    expect(coordinator.begin).toHaveBeenCalledWith(beginParams);
    expect(coordinator.heartbeat).toHaveBeenCalledWith(heartbeatParams);
    expect(coordinator.play).toHaveBeenCalledWith(playParams);
    expect(coordinator.save).toHaveBeenCalledWith(saveParams);
    expect(coordinator.end).toHaveBeenCalledWith(endParams);

    dispose();
    expect(coordinator.dispose).toHaveBeenCalledOnce();
  });

  it('rejects extra catalog params without exposing content state', () => {
    const coordinator = createListeningSessionCoordinatorMock();
    const { dispatch } = createMessageHarness(coordinator);

    const request = dispatch('getListeningCatalog', { unexpected: true });

    expect(request.result).toBeUndefined();
    expect(request.sendResponse).toHaveBeenCalledWith({
      success: true,
      data: { status: 'error' },
    });
    expect(coordinator.getCatalog).not.toHaveBeenCalled();
  });

  it('removes its listener and monitor exactly once', () => {
    const { dispose, monitor, remove } = createMessageHarness();

    dispose();
    dispose();

    expect(remove).toHaveBeenCalledOnce();
    expect(monitor.stop).toHaveBeenCalledOnce();
  });
});

type CapturedRequest = {
  message: keyof MessageSchema;
  params: unknown;
  sender: chrome.runtime.MessageSender;
  sendResponse: (response: unknown) => void;
};

type FetchedSubtitles = Awaited<ReturnType<typeof coupangStrategy.fetchSubtitles>>;

type CapturedListener = (request: CapturedRequest) => true | void;

const createMessageHarness = (
  listeningSessionCoordinator = createListeningSessionCoordinatorMock()
) => {
  let listener: CapturedListener | undefined;
  const remove = vi.fn();
  const monitor = { refresh: vi.fn(), start: vi.fn(), stop: vi.fn() };
  const registerMessageListener = vi.fn((callback: unknown) => {
    listener = callback as CapturedListener;
    return { remove };
  });
  const dispose = initializeMessageListener({
    createVideoLifecycleMonitor: () => monitor as never,
    listeningSessionCoordinator,
    registerMessageListener: registerMessageListener as never,
  });

  return {
    dispose,
    monitor,
    remove,
    dispatch: (message: keyof MessageSchema, params: unknown) => {
      const sendResponse = vi.fn();
      const result = listener?.({ message, params, sender: {}, sendResponse });
      return { result, sendResponse };
    },
  };
};

const createListeningSessionCoordinatorMock = (): ListeningSessionCoordinator => ({
  begin: vi.fn(async () => ({ status: 'busy' as const })),
  dispose: vi.fn(),
  end: vi.fn(async () => ({ status: 'already-ended' as const })),
  getCatalog: vi.fn(async () => ({ status: 'no-video' as const })),
  heartbeat: vi.fn(async () => ({ status: 'alive' as const })),
  play: vi.fn(async () => ({ status: 'played' as const })),
  save: vi.fn(async () => ({ status: 'busy' as const })),
});

const expectResponse = async (sendResponse: ReturnType<typeof vi.fn>, response: unknown) => {
  await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith(response));
};

const expectFailure = async (sendResponse: ReturnType<typeof vi.fn>) => {
  await vi.waitFor(() =>
    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      message: 'v2_content_action_failed',
    })
  );
};

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const attachVideo = (currentTime: number, readyState = 4) => {
  const video = document.createElement('video');
  Object.defineProperty(video, 'readyState', { configurable: true, value: readyState });
  video.currentTime = currentTime;
  video.requestVideoFrameCallback = vi.fn(() => 1);
  video.cancelVideoFrameCallback = vi.fn();
  document.body.append(video);
  videoManager.set(video);
  return video;
};
