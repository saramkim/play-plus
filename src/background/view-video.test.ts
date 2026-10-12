import { sendMessageToTab } from '@utils/message';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createViewVideoHandler, playOriginalScene, ViewVideoDependencies, waitForOriginalScene } from './view-video';

vi.mock('@utils/message', () => ({ sendMessageToTab: vi.fn() }));

type ViewVideoTab = Awaited<ReturnType<ViewVideoDependencies['queryTabs']>>[number];

const createDependencies = (tabs: ViewVideoTab[]): ViewVideoDependencies => ({
  activateTab: vi.fn(async () => {}),
  createTab: vi.fn(async () => 9),
  waitForTab: vi.fn(async () => {}),
  getVideoId: (url) => url?.split('/').pop() ?? null,
  playVideo: vi.fn(async () => {}),
  queryTabs: vi.fn(async () => tabs),
});

describe('view video handler', () => {
  it('rejects an unavailable source or invalid position before opening a tab', async () => {
    const dependencies = createDependencies([]);
    dependencies.getVideoId = () => null;
    await expect(createViewVideoHandler(dependencies)({ url: 'javascript:alert(1)', startTime: 0 }))
      .rejects.toThrow('Original scene unavailable');
    expect(dependencies.createTab).not.toHaveBeenCalled();
    dependencies.getVideoId = () => 'one';
    for (const startTime of [-1, Number.NaN, Infinity]) {
      await expect(createViewVideoHandler(dependencies)({ url: 'https://example.com/video/one', startTime }))
        .rejects.toThrow('Original scene unavailable');
    }
    expect(dependencies.queryTabs).not.toHaveBeenCalled();
  });

  it('propagates rejected playback instead of reporting a successful scene return', async () => {
    const dependencies = createDependencies([
      { id: 3, url: 'https://example.com/video/one', active: true, status: 'complete' },
    ]);
    dependencies.playVideo = vi.fn(async () => { throw new Error('Playback unavailable'); });
    await expect(createViewVideoHandler(dependencies)({ url: 'https://example.com/video/one', startTime: 5 }))
      .rejects.toThrow('Playback unavailable');
    expect(dependencies.waitForTab).toHaveBeenCalled();
  });
  it('activates a completed matching tab and awaits playback', async () => {
    const dependencies = createDependencies([
      { id: 0, url: 'https://example.com/video/one', active: true, status: 'complete' },
    ]);
    const handleViewVideo = createViewVideoHandler(dependencies);

    await handleViewVideo({ url: 'https://example.com/video/one', startTime: 12 });

    expect(dependencies.activateTab).toHaveBeenCalledWith(0);
    expect(dependencies.playVideo).toHaveBeenCalledWith(0, 12, 'one');
    expect(dependencies.waitForTab).toHaveBeenCalled();
  });

  it('waits for a matching loading tab and awaits the actual seek', async () => {
    const dependencies = createDependencies([
      { id: 3, url: 'https://example.com/video/one', active: false, status: 'loading' },
    ]);
    const handleViewVideo = createViewVideoHandler(dependencies);

    await handleViewVideo({ url: 'https://example.com/video/one', startTime: 7 });

    expect(dependencies.activateTab).toHaveBeenCalledWith(3);
    expect(dependencies.playVideo).toHaveBeenCalledWith(3, 7, 'one');
    expect(dependencies.waitForTab).toHaveBeenCalled();
  });

  it('waits for the created tab without a completion-versus-enqueue race', async () => {
    const dependencies = createDependencies([]);
    const handleViewVideo = createViewVideoHandler(dependencies);

    await handleViewVideo({ url: 'https://example.com/video/one', startTime: 5 });

    expect(dependencies.createTab).toHaveBeenCalledWith('https://example.com/video/one');
    expect(dependencies.waitForTab).toHaveBeenCalled();
  });
});


describe('original scene identity', () => {
  it('does not accept a new video identity returned by ping after tab activation', async () => {
    vi.mocked(sendMessageToTab).mockReset().mockResolvedValueOnce({ success: true, data: {
      videoId: 'B', lifecycle: 'content', routeKind: 'movie',
    } } as never);
    await expect(playOriginalScene(1, 42, 'A')).rejects.toThrow('Playback unavailable');
    expect(sendMessageToTab).toHaveBeenCalledTimes(1);
  });

  it('keeps the requested identity across ping and propagates a stale content result', async () => {
    const identity = { videoId: 'A', contentEpoch: 2, contentInstanceId: 'instance', routeChangedAt: 10, videoRevision: 3 };
    vi.mocked(sendMessageToTab).mockReset().mockResolvedValueOnce({ success: true, data: {
      ...identity, lifecycle: 'content', routeKind: 'episode', subtitleIdentity: { subtitleRevision: 7 },
    } } as never).mockResolvedValueOnce({ success: true, data: { status: 'stale' } } as never);
    await expect(playOriginalScene(1, 42, 'A')).rejects.toThrow('Playback unavailable');
    expect(sendMessageToTab).toHaveBeenLastCalledWith(1, 'playVideo', {
      expectedIdentity: identity, expectedSubtitleRevision: 7, startTime: 42, purpose: 'original-scene',
    });
  });
});


describe('original scene readiness', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it.each(['movie', 'episode'])('waits for verified %s capability after video attachment', async (routeKind) => {
    vi.useFakeTimers();
    const id = '123e4567-e89b-12d3-a456-426614174000';
    vi.stubGlobal('chrome', { ...chrome, tabs: { ...chrome.tabs, get: vi.fn(async () => ({ status: 'complete', url: 'https://www.coupangplay.com/play/' + id })) } });
    vi.mocked(sendMessageToTab).mockReset().mockResolvedValueOnce({ success: true, data: { videoId: id, hasVideo: true, lifecycle: 'content', routeKind: 'unknown' } } as never)
      .mockResolvedValueOnce({ success: true, data: { videoId: id, hasVideo: true, lifecycle: 'content', routeKind } } as never);
    const completed = vi.fn();
    const pending = waitForOriginalScene(7, id).then(completed);
    await vi.advanceTimersByTimeAsync(0);
    expect(completed).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100); await pending;
    expect(completed).toHaveBeenCalledOnce();
    expect(sendMessageToTab).toHaveBeenCalledTimes(2);
  });
  it('rejects another pending navigation before readiness', async () => {
    vi.stubGlobal('chrome', { ...chrome, tabs: { ...chrome.tabs, get: vi.fn(async () => ({ status: 'loading', pendingUrl: 'https://www.coupangplay.com/play/123e4567-e89b-12d3-a456-426614174001' })) } });
    await expect(waitForOriginalScene(7, '123e4567-e89b-12d3-a456-426614174000')).rejects.toThrow('Original scene changed');
  });
});
