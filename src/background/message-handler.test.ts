import { beforeEach, describe, expect, it, vi } from 'vitest';

import { registerBackgroundMessageHandler } from './message-handler';

const createDependencies = () => ({
  handleViewVideo: vi.fn(async () => {}),
  updateConnectedStatus: vi.fn(async () => {}),
  updateTabInfo: vi.fn(async () => {}),
});

const getRegisteredListener = () =>
  vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0]?.[0];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('background message handler', () => {
  it('awaits view-video work before responding', async () => {
    let completeTask: (() => void) | undefined;
    const dependencies = createDependencies();
    dependencies.handleViewVideo.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          completeTask = resolve;
        })
    );
    const sendResponse = vi.fn();

    registerBackgroundMessageHandler(dependencies);
    const listener = getRegisteredListener();

    expect(listener?.(
      { message: 'viewVideo', params: { url: 'https://example.com', startTime: 10 } },
      {},
      sendResponse
    )).toBe(true);
    await Promise.resolve();
    expect(sendResponse).not.toHaveBeenCalled();

    completeTask?.();
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ success: true }));
  });

  it('accepts tab id zero and waits for subtitle persistence', async () => {
    const dependencies = createDependencies();
    const sendResponse = vi.fn();

    registerBackgroundMessageHandler(dependencies);
    const listener = getRegisteredListener();
    expect(listener?.(
      { message: 'updateSubtitles', params: { lang: 'ko', subtitleData: null } },
      { tab: { id: 0 } as chrome.tabs.Tab },
      sendResponse
    )).toBe(true);

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ success: true }));
    expect(dependencies.updateTabInfo).toHaveBeenCalledWith(0, { ko: null });
  });

  it('responds with failure when a sender tab is missing', async () => {
    const dependencies = createDependencies();
    const sendResponse = vi.fn();

    registerBackgroundMessageHandler(dependencies);
    const listener = getRegisteredListener();
    expect(listener?.(
      { message: 'contentStatus', params: { hasVideo: true, isVideoUrl: true } },
      {},
      sendResponse
    )).toBe(true);

    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        message: 'Missing sender tab id',
      })
    );
    expect(dependencies.updateConnectedStatus).not.toHaveBeenCalled();
  });
});
