import { describe, expect, it, vi } from 'vitest';

import { ContentRuntime, ContentRuntimeDependencies } from './content-runtime';

const createDependencies = () => {
  const cleanupOrder: string[] = [];
  const cleanup = (name: string) => vi.fn(() => cleanupOrder.push(name));
  const dependencies: ContentRuntimeDependencies = {
    clearVideo: cleanup('video-state'),
    initializeMessageListener: vi.fn(() => cleanup('message')),
    initializeStorageChange: vi.fn(() => cleanup('storage')),
    initializeSubtitleSync: vi.fn(async () => cleanup('subtitle')),
    removeContainers: cleanup('containers'),
    reportContentInitialized: vi.fn(async () => {}),
    renderApp: vi.fn(() => cleanup('app')),
    setupSystemContainer: vi.fn(),
    startLoopController: vi.fn(),
    startPlaybackSpeedController: vi.fn(),
    startVideoController: vi.fn(async () => {}),
    stopLoopController: cleanup('loop'),
    stopPlaybackSpeedController: cleanup('playback-speed'),
    stopVideoController: cleanup('video-controller'),
  };
  return { cleanupOrder, dependencies };
};

describe('ContentRuntime', () => {
  it('starts once for concurrent calls and stops resources in reverse order', async () => {
    const { cleanupOrder, dependencies } = createDependencies();
    const runtime = new ContentRuntime(dependencies);

    const firstStart = runtime.start();
    const secondStart = runtime.start();
    expect(secondStart).toBe(firstStart);
    await firstStart;

    expect(dependencies.startLoopController).toHaveBeenCalledOnce();
    expect(dependencies.startPlaybackSpeedController).toHaveBeenCalledOnce();
    expect(dependencies.startVideoController).toHaveBeenCalledOnce();
    expect(dependencies.initializeMessageListener).toHaveBeenCalledOnce();
    expect(dependencies.initializeStorageChange).toHaveBeenCalledOnce();
    expect(dependencies.reportContentInitialized).toHaveBeenCalledOnce();
    expect(dependencies.initializeSubtitleSync).toHaveBeenCalledOnce();
    expect(dependencies.renderApp).toHaveBeenCalledOnce();

    runtime.stop();
    runtime.stop();

    expect(cleanupOrder).toEqual([
      'app',
      'subtitle',
      'video-controller',
      'playback-speed',
      'loop',
      'storage',
      'message',
      'video-state',
      'containers',
    ]);

    await runtime.start();
    expect(dependencies.startLoopController).toHaveBeenCalledTimes(2);
    expect(dependencies.renderApp).toHaveBeenCalledTimes(2);
    runtime.stop();
  });

  it('rolls back a partial start and can start again', async () => {
    const { dependencies } = createDependencies();
    let finishFirstSubtitle: ((disposer: () => void) => void) | undefined;
    const firstSubtitle = new Promise<() => void>((resolve) => {
      finishFirstSubtitle = resolve;
    });
    const subtitleCleanup = vi.fn();
    vi.mocked(dependencies.initializeSubtitleSync)
      .mockReturnValueOnce(firstSubtitle)
      .mockResolvedValueOnce(subtitleCleanup);
    vi.mocked(dependencies.startVideoController)
      .mockRejectedValueOnce(new Error('video setup failed'))
      .mockResolvedValueOnce();
    const runtime = new ContentRuntime(dependencies);

    await expect(runtime.start()).rejects.toThrow('video setup failed');
    expect(dependencies.stopVideoController).toHaveBeenCalledOnce();
    expect(dependencies.stopPlaybackSpeedController).toHaveBeenCalledOnce();
    expect(dependencies.stopLoopController).toHaveBeenCalledOnce();
    expect(dependencies.removeContainers).toHaveBeenCalledOnce();
    expect(dependencies.renderApp).not.toHaveBeenCalled();

    const lateCleanup = vi.fn();
    finishFirstSubtitle?.(lateCleanup);
    await vi.waitFor(() => expect(lateCleanup).toHaveBeenCalledOnce());

    await runtime.start();
    expect(dependencies.startLoopController).toHaveBeenCalledTimes(2);
    expect(dependencies.renderApp).toHaveBeenCalledOnce();
    runtime.stop();
    expect(subtitleCleanup).toHaveBeenCalledOnce();
  });

  it('disposes a late subtitle subscription after stop during startup', async () => {
    const { dependencies } = createDependencies();
    let finishSubtitle: ((disposer: () => void) => void) | undefined;
    vi.mocked(dependencies.initializeSubtitleSync).mockReturnValue(
      new Promise((resolve) => {
        finishSubtitle = resolve;
      })
    );
    const runtime = new ContentRuntime(dependencies);
    const start = runtime.start();
    await Promise.resolve();

    runtime.stop();
    const lateCleanup = vi.fn();
    finishSubtitle?.(lateCleanup);
    await start;

    expect(lateCleanup).toHaveBeenCalledOnce();
    expect(dependencies.renderApp).not.toHaveBeenCalled();
  });

  it('does not start video or subtitle work before session roles are reset', async () => {
    const { dependencies } = createDependencies();
    let finishInitialization: (() => void) | undefined;
    vi.mocked(dependencies.reportContentInitialized).mockReturnValue(
      new Promise((resolve) => {
        finishInitialization = resolve;
      })
    );
    const runtime = new ContentRuntime(dependencies);

    const start = runtime.start();
    await Promise.resolve();

    expect(dependencies.startVideoController).not.toHaveBeenCalled();
    expect(dependencies.initializeSubtitleSync).not.toHaveBeenCalled();

    finishInitialization?.();
    await start;

    expect(dependencies.startVideoController).toHaveBeenCalledOnce();
    expect(dependencies.initializeSubtitleSync).toHaveBeenCalledOnce();
    runtime.stop();
  });
});
