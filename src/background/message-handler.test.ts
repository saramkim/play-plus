
import { LearningCard } from '@storage/v2/type';
import type { V2ReadinessStatus } from '@utils/message/type';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { registerBackgroundMessageHandler } from './message-handler';

const VIDEO_ID = '123e4567-e89b-12d3-a456-426614174000';

const card: LearningCard = {
  id: 'card-one',
  content: { learning: { language: 'en', text: 'Learning' } },
  createdAt: '2026-08-03T00:00:00.000Z',
  source: { startTime: 1, url: 'https://www.coupangplay.com/play/example' },
  studyState: 'active',
};

const createDependencies = () => ({
  awaitReady: vi.fn(async () => {}),
  getReadiness: vi.fn<() => Promise<V2ReadinessStatus>>(async () => ({ status: 'ready' })),
  retryReadiness: vi.fn<() => Promise<V2ReadinessStatus>>(async () => ({ status: 'ready' })),
  getContentBootstrap: vi.fn(async () => ({
    learningSubtitleId: 'subtitle-00000000-0000-0000-0000-000000000001',
    supportSubtitleId: null,
  })),
  handleViewVideo: vi.fn(async () => {}),
  handleSubtitleContentStatus: vi.fn(async () => {}),
  learningCards: {
    get: vi.fn(async () => [card]),
    add: vi.fn(async () => card),
    update: vi.fn(async () => card),
    delete: vi.fn(async () => ({ card, index: 0 })),
    restore: vi.fn(async () => card),
  },
  updateConnectedStatus: vi.fn(async () => true),
});

const getRegisteredListener = () =>
  vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0]?.[0];

beforeEach(() => vi.clearAllMocks());

describe('background message handler', () => {
  it('returns sanitized readiness and retries through the shared controller', async () => {
    const dependencies = createDependencies();
    dependencies.getReadiness.mockResolvedValueOnce({ status: 'error', code: 'migration-failed' });
    const sendResponse = vi.fn();

    registerBackgroundMessageHandler(dependencies);
    const listener = getRegisteredListener();
    expect(listener?.({ message: 'getV2Readiness' }, {}, sendResponse)).toBe(true);
    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        data: { status: 'error', code: 'migration-failed' },
      })
    );

    const retryResponse = vi.fn();
    expect(listener?.({ message: 'retryV2Readiness' }, {}, retryResponse)).toBe(true);
    await vi.waitFor(() =>
      expect(retryResponse).toHaveBeenCalledWith({ success: true, data: { status: 'ready' } })
    );
  });

  it('awaits readiness and returns the current canonical role selection to content', async () => {
    const dependencies = createDependencies();
    const sendResponse = vi.fn();

    registerBackgroundMessageHandler(dependencies);
    const listener = getRegisteredListener();
    expect(listener?.(
      { message: 'contentInitialized' },
      { tab: { id: 0 } as chrome.tabs.Tab },
      sendResponse
    )).toBe(true);

    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        data: {
          learningSubtitleId: 'subtitle-00000000-0000-0000-0000-000000000001',
          supportSubtitleId: null,
        },
      })
    );
    expect(dependencies.awaitReady).toHaveBeenCalledOnce();
    expect(dependencies.getContentBootstrap).toHaveBeenCalledWith(0);
  });

  it('gates view, status, and learning-card work', async () => {
    const dependencies = createDependencies();
    registerBackgroundMessageHandler(dependencies);
    const listener = getRegisteredListener();

    const viewResponse = vi.fn();
    listener?.(
      { message: 'viewVideo', params: { url: 'https://example.com', startTime: 10 } },
      {},
      viewResponse
    );
    const statusResponse = vi.fn();
    listener?.(
      {
        message: 'contentStatus',
        params: {
          contentInstanceId: 'content-1',
          hasVideo: true,
          isVideoUrl: true,
          routeChangedAt: 1_000,
          videoId: VIDEO_ID,
          videoRevision: 2,
        },
      },
      {
        documentId: 'document-1',
        tab: { id: 7, url: `https://www.coupangplay.com/play/${VIDEO_ID}` } as chrome.tabs.Tab,
      },
      statusResponse
    );
    const cardsResponse = vi.fn();
    listener?.({ message: 'getLearningCards' }, {}, cardsResponse);

    await vi.waitFor(() => expect(cardsResponse).toHaveBeenCalledWith({ success: true, data: [card] }));
    expect(dependencies.awaitReady).toHaveBeenCalledTimes(3);
    expect(dependencies.updateConnectedStatus).toHaveBeenCalledWith(7, {
      contentInstanceId: 'content-1',
      documentId: 'document-1',
      hasVideo: true,
      isVideoUrl: true,
      routeChangedAt: 1_000,
      videoId: VIDEO_ID,
      videoRevision: 2,
    });
    expect(dependencies.handleSubtitleContentStatus).toHaveBeenCalledWith(7, {
      contentInstanceId: 'content-1',
      documentId: 'document-1',
      hasVideo: true,
      isVideoUrl: true,
      routeChangedAt: 1_000,
      videoId: VIDEO_ID,
      videoRevision: 2,
    });
    expect(dependencies.handleViewVideo).toHaveBeenCalledWith({ url: 'https://example.com', startTime: 10 });
  });

  it('applies content status in receipt order when replacement detection arrives during a slow write', async () => {
    const firstStatusWrite = createDeferred<boolean>();
    const dependencies = createDependencies();
    dependencies.updateConnectedStatus
      .mockImplementationOnce(() => firstStatusWrite.promise)
      .mockResolvedValueOnce(true);
    registerBackgroundMessageHandler(dependencies);
    const listener = getRegisteredListener();
    const sender = {
      documentId: 'document-1',
      tab: { id: 7, url: `https://www.coupangplay.com/play/${VIDEO_ID}` } as chrome.tabs.Tab,
    };
    const waitingResponse = vi.fn();
    const detectedResponse = vi.fn();

    listener?.(
      {
        message: 'contentStatus',
        params: {
          contentInstanceId: 'content-1',
          hasVideo: false,
          isVideoUrl: true,
          routeChangedAt: 1_000,
          videoId: VIDEO_ID,
          videoRevision: 1,
        },
      },
      sender,
      waitingResponse
    );
    listener?.(
      {
        message: 'contentStatus',
        params: {
          contentInstanceId: 'content-1',
          hasVideo: true,
          isVideoUrl: true,
          routeChangedAt: 1_000,
          videoId: VIDEO_ID,
          videoRevision: 2,
        },
      },
      sender,
      detectedResponse
    );

    await vi.waitFor(() => expect(dependencies.updateConnectedStatus).toHaveBeenCalledOnce());
    expect(dependencies.updateConnectedStatus).toHaveBeenLastCalledWith(7, {
      contentInstanceId: 'content-1',
      documentId: 'document-1',
      hasVideo: false,
      isVideoUrl: true,
      routeChangedAt: 1_000,
      videoId: VIDEO_ID,
      videoRevision: 1,
    });
    expect(dependencies.handleSubtitleContentStatus).not.toHaveBeenCalled();
    expect(detectedResponse).not.toHaveBeenCalled();

    firstStatusWrite.resolve(true);
    await vi.waitFor(() => expect(detectedResponse).toHaveBeenCalledWith({ success: true }));

    expect(dependencies.updateConnectedStatus).toHaveBeenNthCalledWith(2, 7, {
      contentInstanceId: 'content-1',
      documentId: 'document-1',
      hasVideo: true,
      isVideoUrl: true,
      routeChangedAt: 1_000,
      videoId: VIDEO_ID,
      videoRevision: 2,
    });
    expect(dependencies.handleSubtitleContentStatus).toHaveBeenNthCalledWith(1, 7, {
      contentInstanceId: 'content-1',
      documentId: 'document-1',
      hasVideo: false,
      isVideoUrl: true,
      routeChangedAt: 1_000,
      videoId: VIDEO_ID,
      videoRevision: 1,
    });
    expect(dependencies.handleSubtitleContentStatus).toHaveBeenNthCalledWith(2, 7, {
      contentInstanceId: 'content-1',
      documentId: 'document-1',
      hasVideo: true,
      isVideoUrl: true,
      routeChangedAt: 1_000,
      videoId: VIDEO_ID,
      videoRevision: 2,
    });
  });

  it('does not expose raw learning-card storage failures', async () => {
    const dependencies = createDependencies();
    dependencies.learningCards.add.mockRejectedValueOnce(new Error('private raw storage detail'));
    const sendResponse = vi.fn();

    registerBackgroundMessageHandler(dependencies);
    const listener = getRegisteredListener();
    expect(listener?.({ message: 'addLearningCard', params: { card } }, {}, sendResponse)).toBe(true);

    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        message: 'Unable to access the learning library',
      })
    );
  });

  it('does not expose raw tab or readiness failures', async () => {
    const dependencies = createDependencies();
    dependencies.handleViewVideo.mockRejectedValueOnce(
      new Error('private URL https://www.coupangplay.com/play/private')
    );
    const sendResponse = vi.fn();

    registerBackgroundMessageHandler(dependencies);
    const listener = getRegisteredListener();
    expect(
      listener?.(
        { message: 'viewVideo', params: { url: 'https://example.com', startTime: 10 } },
        {},
        sendResponse
      )
    ).toBe(true);

    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        message: 'Unable to complete the Play Plus action',
      })
    );
  });
});

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};
