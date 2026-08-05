import { describe, expect, it, vi } from 'vitest';

import { createTabLifecycleDependencies, handleTabCompleted } from './tab-lifecycle';

const VIDEO_URL = 'https://www.coupangplay.com/play/123e4567-e89b-12d3-a456-426614174000';

const createDependencies = () => ({
  ...createTabLifecycleDependencies,
  getTab: vi.fn(async () => ({ id: 7, status: 'complete', url: VIDEO_URL }) as chrome.tabs.Tab),
  updateTabInfo: vi.fn(),
  checkContentConnection: vi.fn(),
  sendMessageToTab: vi.fn(),
  clearSubtitleReplay: vi.fn(),
  takeViewAction: vi.fn(),
  updateNavigatingStatus: vi.fn(),
});

describe('handleTabCompleted', () => {
  it('keeps detecting when the initial detection response is not ready', async () => {
    const dependencies = createDependencies();
    dependencies.sendMessageToTab
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, message: 'not found' });

    await handleTabCompleted(7, { id: 7, active: true, url: VIDEO_URL } as chrome.tabs.Tab, dependencies);

    expect(dependencies.getTab).toHaveBeenCalledWith(7);
    expect(dependencies.updateTabInfo).toHaveBeenLastCalledWith(7, {
      connectionStatus: 'connected',
      videoStatus: 'detecting',
    });
    expect(dependencies.takeViewAction).not.toHaveBeenCalled();
  });

  it('delivers the newest queued playback action after detection', async () => {
    const dependencies = createDependencies();
    dependencies.sendMessageToTab.mockResolvedValue({ success: true });
    dependencies.takeViewAction.mockResolvedValue({ url: VIDEO_URL, videoId: null, startTime: 42 });

    await handleTabCompleted(7, { id: 7, active: false, url: VIDEO_URL } as chrome.tabs.Tab, dependencies);

    expect(dependencies.takeViewAction).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', VIDEO_URL);
    expect(dependencies.sendMessageToTab).toHaveBeenLastCalledWith(7, 'playVideo', { startTime: 42 });
  });

  it('ignores a completed snapshot after a newer navigation starts', async () => {
    const readiness = createDeferred<void>();
    const dependencies = createDependencies();
    dependencies.awaitReady = vi.fn(() => readiness.promise);
    dependencies.getTab.mockResolvedValue({
      id: 7,
      status: 'loading',
      url: 'https://www.coupangplay.com/play/newer',
    } as chrome.tabs.Tab);

    const handling = handleTabCompleted(
      7,
      { id: 7, active: true, status: 'complete', url: VIDEO_URL } as chrome.tabs.Tab,
      dependencies
    );

    expect(dependencies.getTab).not.toHaveBeenCalled();
    readiness.resolve();
    await handling;

    expect(dependencies.updateTabInfo).not.toHaveBeenCalled();
    expect(dependencies.checkContentConnection).not.toHaveBeenCalled();
    expect(dependencies.sendMessageToTab).not.toHaveBeenCalled();
  });

  it('does not let a stale completed home route clear a newer video replay', async () => {
    const connectionCheck = createDeferred<void>();
    const homeUrl = 'https://www.coupangplay.com/';
    const dependencies = createDependencies();
    dependencies.getTab
      .mockResolvedValueOnce({ id: 7, status: 'complete', url: homeUrl } as chrome.tabs.Tab)
      .mockResolvedValueOnce({ id: 7, status: 'complete', url: homeUrl } as chrome.tabs.Tab)
      .mockResolvedValue({ id: 7, status: 'complete', url: VIDEO_URL } as chrome.tabs.Tab);
    dependencies.checkContentConnection.mockImplementationOnce(() => connectionCheck.promise);

    const handling = handleTabCompleted(
      7,
      { id: 7, active: true, status: 'complete', url: homeUrl } as chrome.tabs.Tab,
      dependencies
    );
    await vi.waitFor(() => expect(dependencies.checkContentConnection).toHaveBeenCalledOnce());
    connectionCheck.resolve();
    await handling;

    expect(dependencies.clearSubtitleReplay).not.toHaveBeenCalled();
    expect(dependencies.sendMessageToTab).not.toHaveBeenCalled();
  });
});

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};
