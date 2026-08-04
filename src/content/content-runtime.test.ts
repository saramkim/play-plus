import { describe, expect, it, vi } from 'vitest';

import { ContentRuntime, ContentRuntimeDependencies } from './content-runtime';

const BOOTSTRAP = {
  learningSubtitleId: 'subtitle-00000000-0000-4000-8000-000000000001',
  supportSubtitleId: null,
};

const createDependencies = () => {
  const startOrder: string[] = [];
  const cleanupOrder: string[] = [];
  const cleanup = (name: string) => vi.fn(() => cleanupOrder.push(name));
  const dependencies: ContentRuntimeDependencies = {
    clearVideo: cleanup('video-state'),
    initializeMessageListener: vi.fn(() => {
      startOrder.push('message-listener');
      return cleanup('message-listener');
    }),
    initializeSubtitleSelections: vi.fn(async () => {
      startOrder.push('subtitle-selections');
    }),
    initializeSubtitleSync: vi.fn(async () => {
      startOrder.push('subtitle-settings');
      return cleanup('subtitle-settings');
    }),
    removeContainers: cleanup('containers'),
    reportContentInitialized: vi.fn(async () => {
      startOrder.push('content-ready');
      return BOOTSTRAP;
    }),
    renderApp: vi.fn(() => {
      startOrder.push('render');
      return cleanup('render');
    }),
    setupSystemContainer: vi.fn(() => startOrder.push('system-container')),
    startPlaybackSpeedController: vi.fn(() => startOrder.push('playback-speed')),
    startVideoController: vi.fn(async () => {
      startOrder.push('video-controller');
    }),
    stopPlaybackSpeedController: cleanup('playback-speed'),
    stopVideoController: cleanup('video-controller'),
  };
  return { cleanupOrder, dependencies, startOrder };
};

describe('canonical content runtime', () => {
  it('waits for content readiness before listeners, settings, controllers, or rendering', async () => {
    const { dependencies, startOrder } = createDependencies();
    const readiness = deferred<typeof BOOTSTRAP>();
    vi.mocked(dependencies.reportContentInitialized).mockImplementation(async () => {
      startOrder.push('content-ready');
      return readiness.promise;
    });
    const runtime = new ContentRuntime(dependencies);

    const start = runtime.start();
    await Promise.resolve();

    expect(startOrder).toEqual(['content-ready']);
    expect(dependencies.initializeMessageListener).not.toHaveBeenCalled();
    expect(dependencies.initializeSubtitleSync).not.toHaveBeenCalled();
    expect(dependencies.startPlaybackSpeedController).not.toHaveBeenCalled();
    expect(dependencies.startVideoController).not.toHaveBeenCalled();
    expect(dependencies.renderApp).not.toHaveBeenCalled();

    readiness.resolve(BOOTSTRAP);
    await start;

    expect(startOrder).toEqual([
      'content-ready',
      'subtitle-settings',
      'subtitle-selections',
      'message-listener',
      'playback-speed',
      'video-controller',
      'system-container',
      'render',
    ]);
    expect(dependencies.initializeSubtitleSelections).toHaveBeenCalledWith(BOOTSTRAP);
    runtime.stop();
  });

  it('starts once and cleans canonical resources in reverse ownership order', async () => {
    const { cleanupOrder, dependencies } = createDependencies();
    const runtime = new ContentRuntime(dependencies);

    const first = runtime.start();
    expect(runtime.start()).toBe(first);
    await first;

    runtime.stop();
    runtime.stop();

    expect(cleanupOrder).toEqual([
      'render',
      'video-controller',
      'playback-speed',
      'message-listener',
      'subtitle-settings',
      'video-state',
      'containers',
    ]);

    await runtime.start();
    expect(dependencies.reportContentInitialized).toHaveBeenCalledTimes(2);
    expect(dependencies.renderApp).toHaveBeenCalledTimes(2);
    runtime.stop();
  });

  it('cancels during readiness without starting normal content work', async () => {
    const { cleanupOrder, dependencies } = createDependencies();
    const readiness = deferred<typeof BOOTSTRAP>();
    vi.mocked(dependencies.reportContentInitialized).mockReturnValue(readiness.promise);
    const runtime = new ContentRuntime(dependencies);

    const start = runtime.start();
    await Promise.resolve();
    runtime.stop();
    readiness.resolve(BOOTSTRAP);
    await start;

    expect(cleanupOrder).toEqual(['video-state', 'containers']);
    expect(dependencies.initializeSubtitleSync).not.toHaveBeenCalled();
    expect(dependencies.initializeMessageListener).not.toHaveBeenCalled();
    expect(dependencies.renderApp).not.toHaveBeenCalled();
  });

  it('disposes a late settings subscription and does not initialize selections after cancellation', async () => {
    const { dependencies } = createDependencies();
    const subtitleSettings = deferred<() => void>();
    vi.mocked(dependencies.initializeSubtitleSync).mockReturnValue(subtitleSettings.promise);
    const runtime = new ContentRuntime(dependencies);

    const start = runtime.start();
    await vi.waitFor(() => expect(dependencies.initializeSubtitleSync).toHaveBeenCalledOnce());
    runtime.stop();
    const lateCleanup = vi.fn();
    subtitleSettings.resolve(lateCleanup);
    await start;

    expect(lateCleanup).toHaveBeenCalledOnce();
    expect(dependencies.initializeSubtitleSelections).not.toHaveBeenCalled();
    expect(dependencies.initializeMessageListener).not.toHaveBeenCalled();
    expect(dependencies.renderApp).not.toHaveBeenCalled();
  });

  it('stops a partially starting video controller when startup is cancelled', async () => {
    const { dependencies } = createDependencies();
    const videoStart = deferred<void>();
    vi.mocked(dependencies.startVideoController).mockReturnValue(videoStart.promise);
    const runtime = new ContentRuntime(dependencies);

    const start = runtime.start();
    await vi.waitFor(() => expect(dependencies.startVideoController).toHaveBeenCalledOnce());
    runtime.stop();

    expect(dependencies.stopVideoController).toHaveBeenCalledOnce();
    expect(dependencies.stopPlaybackSpeedController).toHaveBeenCalledOnce();
    videoStart.resolve();
    await start;
    expect(dependencies.renderApp).not.toHaveBeenCalled();
  });

  it('rolls back a failed partial start and can start again', async () => {
    const { dependencies } = createDependencies();
    vi.mocked(dependencies.startVideoController)
      .mockRejectedValueOnce(new Error('video setup failed'))
      .mockResolvedValueOnce();
    const runtime = new ContentRuntime(dependencies);

    await expect(runtime.start()).rejects.toThrow('video setup failed');
    expect(dependencies.stopVideoController).toHaveBeenCalledOnce();
    expect(dependencies.stopPlaybackSpeedController).toHaveBeenCalledOnce();
    expect(dependencies.initializeMessageListener).toHaveBeenCalledOnce();
    expect(dependencies.removeContainers).toHaveBeenCalledOnce();
    expect(dependencies.renderApp).not.toHaveBeenCalled();

    await runtime.start();
    expect(dependencies.renderApp).toHaveBeenCalledOnce();
    runtime.stop();
  });
});

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};
