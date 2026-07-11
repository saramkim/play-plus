import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VideoLifecycleEvent, VideoLifecycleMonitor } from './video-lifecycle-monitor';

const NEXT_ID = '223e4567-e89b-12d3-a456-426614174000';

const addPlayer = () => {
  const player = document.createElement('div');
  player.id = 'playerWrapper';
  document.body.append(player);
  return player;
};

const addMainVideo = (player: Element) => {
  const video = document.createElement('video');
  video.dataset.cy = 'main-video';
  player.append(video);
  return video;
};

const flushLifecycleSignals = async () => {
  await Promise.resolve();
  await vi.runAllTicks();
  await Promise.resolve();
};

const createRouteObserver = () => {
  let callback: ((videoId: string | null) => void) | undefined;
  const remove = vi.fn();
  return {
    observe: (onChange: (videoId: string | null) => void) => {
      callback = onChange;
      return { check: vi.fn(), remove };
    },
    change: (videoId: string | null) => callback?.(videoId),
    remove,
  };
};

describe('VideoLifecycleMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    history.replaceState({}, '', '/');
  });

  it('tracks placeholder, advertisement, and content on the same video element', async () => {
    const route = createRouteObserver();
    const monitor = new VideoLifecycleMonitor(document, route.observe);
    const events: VideoLifecycleEvent[] = [];
    monitor.start((event) => events.push(event));
    const player = addPlayer();
    const video = addMainVideo(player);
    await flushLifecycleSignals();

    video.src = 'https://ads.example.com/ad.mp4';
    const overlay = document.createElement('div');
    overlay.className = 'AdOverlay_adOverlay__hash';
    player.append(overlay);
    await flushLifecycleSignals();

    overlay.remove();
    video.src = 'blob:https://www.coupangplay.com/content';
    video.dispatchEvent(new Event('loadedmetadata'));
    await flushLifecycleSignals();

    expect(events.map(({ state }) => state)).toEqual(['waiting', 'placeholder', 'advertisement', 'content']);
    expect(events.slice(1).every((event) => event.video === video)).toBe(true);
    monitor.stop();
  });

  it('keeps observing through a long next-episode transition', async () => {
    const route = createRouteObserver();
    const player = addPlayer();
    const oldVideo = addMainVideo(player);
    oldVideo.src = 'blob:https://www.coupangplay.com/old';
    const monitor = new VideoLifecycleMonitor(document, route.observe);
    const events: VideoLifecycleEvent[] = [];
    monitor.start((event) => events.push(event));

    route.change(NEXT_ID);
    player.remove();
    await flushLifecycleSignals();
    await vi.advanceTimersByTimeAsync(45_000);
    const newVideo = addMainVideo(addPlayer());
    newVideo.src = 'blob:https://www.coupangplay.com/new';
    await flushLifecycleSignals();

    expect(events.some((event) => event.state === 'transitioning' && event.videoId === NEXT_ID)).toBe(true);
    expect(events.some((event) => event.delayed)).toBe(true);
    expect(events.at(-1)).toMatchObject({ state: 'content', video: newVideo, videoId: NEXT_ID, delayed: false });
    monitor.stop();
  });

  it('does not accept the old video immediately after a route change', async () => {
    const route = createRouteObserver();
    const video = addMainVideo(addPlayer());
    video.src = 'blob:https://www.coupangplay.com/old';
    const monitor = new VideoLifecycleMonitor(document, route.observe);
    const events: VideoLifecycleEvent[] = [];
    monitor.start((event) => events.push(event));

    route.change(NEXT_ID);
    await flushLifecycleSignals();

    expect(events.at(-1)?.state).toBe('transitioning');
    monitor.stop();
  });

  it('deduplicates unchanged signals and cleans up on stop', async () => {
    const route = createRouteObserver();
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    const video = addMainVideo(addPlayer());
    video.src = 'blob:https://www.coupangplay.com/content';
    const monitor = new VideoLifecycleMonitor(document, route.observe);
    const events: VideoLifecycleEvent[] = [];
    monitor.start((event) => events.push(event));
    const initialCount = events.length;

    video.dispatchEvent(new Event('canplay'));
    video.dispatchEvent(new Event('durationchange'));
    monitor.refresh();
    await flushLifecycleSignals();

    expect(events).toHaveLength(initialCount);
    monitor.stop();
    video.src = 'blob:https://www.coupangplay.com/changed';
    video.dispatchEvent(new Event('loadedmetadata'));
    await vi.runAllTicks();
    expect(events).toHaveLength(initialCount);
    expect(disconnect).toHaveBeenCalledOnce();
    expect(route.remove).toHaveBeenCalledOnce();
  });
});
