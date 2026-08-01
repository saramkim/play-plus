import { beforeEach, describe, expect, it, vi } from 'vitest';

import { registerBackgroundMessageHandler } from './message-handler';

const createDependencies = () => ({
  downloadOpenSubtitle: vi.fn(async () => ({
    fileId: 11,
    fileName: 'example.srt',
    text: 'subtitle',
    fromCache: false,
  })),
  handleViewVideo: vi.fn(async () => {}),
  searchOpenSubtitles: vi.fn(async () => ({
    totalCount: 0,
    totalPages: 0,
    page: 1,
    candidates: [],
  })),
  updateConnectedStatus: vi.fn(async () => {}),
  updateTabInfo: vi.fn(async () => {}),
});

const getRegisteredListener = () =>
  vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0]?.[0];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('background message handler', () => {
  it('clears stale custom roles when content initializes', async () => {
    const dependencies = createDependencies();
    const sendResponse = vi.fn();

    registerBackgroundMessageHandler(dependencies);
    const listener = getRegisteredListener();
    expect(listener?.(
      { message: 'contentInitialized' },
      { tab: { id: 7 } as chrome.tabs.Tab },
      sendResponse
    )).toBe(true);

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ success: true }));
    expect(dependencies.updateTabInfo).toHaveBeenCalledWith(7, {
      primarySubtitle: null,
      secondarySubtitle: null,
    });
  });

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

  it('returns typed OpenSubtitles search data', async () => {
    const dependencies = createDependencies();
    const sendResponse = vi.fn();

    registerBackgroundMessageHandler(dependencies);
    const listener = getRegisteredListener();
    expect(listener?.(
      { message: 'searchOpenSubtitles', params: { query: 'Example', language: 'en' } },
      {},
      sendResponse
    )).toBe(true);

    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        data: { totalCount: 0, totalPages: 0, page: 1, candidates: [] },
      })
    );
    expect(dependencies.searchOpenSubtitles).toHaveBeenCalledWith({ query: 'Example', language: 'en' });
  });

  it('returns a typed provider failure without exposing unknown error data', async () => {
    const dependencies = createDependencies();
    dependencies.downloadOpenSubtitle.mockRejectedValueOnce(new Error('raw provider detail'));
    const sendResponse = vi.fn();

    registerBackgroundMessageHandler(dependencies);
    const listener = getRegisteredListener();
    expect(listener?.(
      { message: 'downloadOpenSubtitle', params: { fileId: 11, language: 'en' } },
      {},
      sendResponse
    )).toBe(true);

    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        code: 'SERVER',
        message: 'The OpenSubtitles request failed.',
      })
    );
  });
});
