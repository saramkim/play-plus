import type { ListeningMissionResult } from '@storage/v2/listening-progress-storage';
import type { LearningCard, ListeningProgressV1 } from '@storage/v2/type';
import type { V2ReadinessStatus } from '@utils/message/type';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { registerBackgroundMessageHandler } from './message-handler';

const VIDEO_ID = '123e4567-e89b-12d3-a456-426614174000';
const SEGMENT_KEY = `segment-v1-${'a'.repeat(64)}` as const;

const emptyProgress: ListeningProgressV1 = { version: 1, videos: {} };

const attemptedWithoutSubmission: ListeningMissionResult = {
  videoId: VIDEO_ID,
  learningSourceKey: 'native:en',
  segmenterVersion: 1,
  practicedAt: '2026-08-09T00:00:00.000Z',
  bestCombo: 0,
  items: [
    {
      segmentKey: SEGMENT_KEY,
      achievedState: 'attempted',
      submittedAttemptIncrement: 0,
    },
  ],
};

const card: LearningCard = {
  id: 'card-one',
  content: { learning: { language: 'en', text: 'Learning' } },
  createdAt: '2026-08-03T00:00:00.000Z',
  source: { startTime: 1, url: 'https://www.coupangplay.com/play/example' },
  studyState: 'active',
};

const createDependencies = () => ({
  awaitReady: vi.fn(async () => {}),
  downloadOpenSubtitle: vi.fn(async () => ({
    fileId: 11,
    fileName: 'example.srt',
    text: 'subtitle',
    fromCache: false,
  })),
  getReadiness: vi.fn<() => Promise<V2ReadinessStatus>>(async () => ({ status: 'ready' })),
  retryReadiness: vi.fn<() => Promise<V2ReadinessStatus>>(async () => ({ status: 'ready' })),
  getContentBootstrap: vi.fn(async () => ({
    learningSubtitleId: 'subtitle-00000000-0000-0000-0000-000000000001',
    supportSubtitleId: null,
  })),
  handleViewVideo: vi.fn(async () => {}),
  handleSubtitleContentStatus: vi.fn(async () => {}),
  searchOpenSubtitles: vi.fn(async () => ({
    totalCount: 0,
    totalPages: 0,
    page: 1,
    candidates: [],
  })),
  learningCards: {
    get: vi.fn(async () => [card]),
    add: vi.fn(async () => card),
    update: vi.fn(async () => card),
    delete: vi.fn(async () => ({ card, index: 0 })),
    restore: vi.fn(async () => card),
  },
  listeningProgress: {
    get: vi.fn(async () => emptyProgress),
    recordMissionResult: vi.fn(async () => emptyProgress),
    clearVideo: vi.fn(async () => emptyProgress),
    clearAll: vi.fn(async () => emptyProgress),
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

  it('readiness-gates and routes strict listening progress operations, including zero attempts', async () => {
    const dependencies = createDependencies();
    const positiveResult: ListeningMissionResult = {
      ...attemptedWithoutSubmission,
      bestCombo: 2,
      items: [
        {
          ...attemptedWithoutSubmission.items[0],
          achievedState: 'cleared',
          submittedAttemptIncrement: 2,
        },
      ],
    };

    registerBackgroundMessageHandler(dependencies);
    const listener = getRegisteredListener();
    const responses = Array.from({ length: 6 }, () => vi.fn());

    expect(listener?.({ message: 'getListeningProgress' }, {}, responses[0])).toBe(true);
    expect(listener?.(
      {
        message: 'recordListeningMissionResult',
        params: { result: attemptedWithoutSubmission },
      },
      {},
      responses[1]
    )).toBe(true);
    expect(listener?.(
      { message: 'recordListeningMissionResult', params: { result: positiveResult } },
      {},
      responses[2]
    )).toBe(true);
    expect(listener?.(
      { message: 'clearListeningVideoProgress', params: { videoId: VIDEO_ID } },
      {},
      responses[3]
    )).toBe(true);
    expect(listener?.({ message: 'clearAllListeningProgress' }, {}, responses[4])).toBe(true);
    expect(listener?.({ message: 'getListeningProgress' }, {}, responses[5])).toBe(true);

    await vi.waitFor(() => {
      for (const response of responses) {
        expect(response).toHaveBeenCalledWith({ success: true, data: emptyProgress });
      }
    });

    expect(dependencies.awaitReady).toHaveBeenCalledTimes(6);
    expect(dependencies.listeningProgress.get).toHaveBeenCalledTimes(2);
    expect(dependencies.listeningProgress.recordMissionResult).toHaveBeenNthCalledWith(
      1,
      attemptedWithoutSubmission
    );
    expect(dependencies.listeningProgress.recordMissionResult).toHaveBeenNthCalledWith(
      2,
      positiveResult
    );
    expect(dependencies.listeningProgress.clearVideo).toHaveBeenCalledOnce();
    expect(dependencies.listeningProgress.clearVideo).toHaveBeenCalledWith(VIDEO_ID);
    expect(dependencies.listeningProgress.clearAll).toHaveBeenCalledOnce();
    expect(JSON.stringify(dependencies.listeningProgress.recordMissionResult.mock.calls)).not.toMatch(
      /answer|draft|text|url/i
    );
  });

  it('rejects malformed or extra listening progress params before touching storage', async () => {
    const dependencies = createDependencies();
    const invalidVideoIds = [
      ' ',
      'video-listening',
      `https://www.coupangplay.com/play/${VIDEO_ID}`,
      '123e4567-e89b-12d3-a456-42661417400z',
    ];

    registerBackgroundMessageHandler(dependencies);
    const listener = getRegisteredListener();
    const malformedRequests = [
      { message: 'getListeningProgress', params: {} },
      {
        message: 'recordListeningMissionResult',
        params: { result: { ...attemptedWithoutSubmission, answerText: 'forbidden fixture' } },
      },
      {
        message: 'clearListeningVideoProgress',
        params: { videoId: VIDEO_ID, unexpected: true },
      },
      ...invalidVideoIds.flatMap((videoId) => [
        {
          message: 'recordListeningMissionResult',
          params: { result: { ...attemptedWithoutSubmission, videoId } },
        },
        { message: 'clearListeningVideoProgress', params: { videoId } },
      ]),
      { message: 'clearAllListeningProgress', params: {} },
    ];

    for (const request of malformedRequests) {
      const sendResponse = vi.fn();
      expect(listener?.(request, {}, sendResponse)).toBe(true);
      await vi.waitFor(() =>
        expect(sendResponse).toHaveBeenCalledWith({
          success: false,
          message: 'Unable to access listening progress',
        })
      );
    }

    expect(dependencies.awaitReady).toHaveBeenCalledTimes(malformedRequests.length);
    expect(dependencies.listeningProgress.get).not.toHaveBeenCalled();
    expect(dependencies.listeningProgress.recordMissionResult).not.toHaveBeenCalled();
    expect(dependencies.listeningProgress.clearVideo).not.toHaveBeenCalled();
    expect(dependencies.listeningProgress.clearAll).not.toHaveBeenCalled();
  });

  it('sanitizes progress failures and allows the next request to retry', async () => {
    const dependencies = createDependencies();
    dependencies.awaitReady.mockRejectedValueOnce(new Error('private migration state'));
    dependencies.listeningProgress.get.mockRejectedValueOnce(new Error('private persisted value'));

    registerBackgroundMessageHandler(dependencies);
    const listener = getRegisteredListener();

    for (const expectedSuccess of [false, false, true]) {
      const sendResponse = vi.fn();
      expect(listener?.({ message: 'getListeningProgress' }, {}, sendResponse)).toBe(true);
      await vi.waitFor(() =>
        expect(sendResponse).toHaveBeenCalledWith(
          expectedSuccess
            ? { success: true, data: emptyProgress }
            : { success: false, message: 'Unable to access listening progress' }
        )
      );
    }

    expect(dependencies.awaitReady).toHaveBeenCalledTimes(3);
    expect(dependencies.listeningProgress.get).toHaveBeenCalledTimes(2);
  });

  it('gates OpenSubtitles requests and returns typed provider data', async () => {
    const dependencies = createDependencies();
    const searchResponse = vi.fn();
    const downloadResponse = vi.fn();

    registerBackgroundMessageHandler(dependencies);
    const listener = getRegisteredListener();
    expect(
      listener?.(
        { message: 'searchOpenSubtitles', params: { query: 'Example', language: 'en' } },
        {},
        searchResponse
      )
    ).toBe(true);
    expect(
      listener?.(
        { message: 'downloadOpenSubtitle', params: { fileId: 11, language: 'en' } },
        {},
        downloadResponse
      )
    ).toBe(true);

    await vi.waitFor(() =>
      expect(searchResponse).toHaveBeenCalledWith({
        success: true,
        data: { totalCount: 0, totalPages: 0, page: 1, candidates: [] },
      })
    );
    await vi.waitFor(() =>
      expect(downloadResponse).toHaveBeenCalledWith({
        success: true,
        data: {
          fileId: 11,
          fileName: 'example.srt',
          text: 'subtitle',
          fromCache: false,
        },
      })
    );
    expect(dependencies.awaitReady).toHaveBeenCalledTimes(2);
    expect(dependencies.searchOpenSubtitles).toHaveBeenCalledWith({
      query: 'Example',
      language: 'en',
    });
    expect(dependencies.downloadOpenSubtitle).toHaveBeenCalledWith({
      fileId: 11,
      language: 'en',
    });
  });

  it('returns a typed provider failure without exposing unknown details', async () => {
    const dependencies = createDependencies();
    dependencies.downloadOpenSubtitle.mockRejectedValueOnce(
      new Error('raw provider detail https://www.opensubtitles.com/download/private')
    );
    const sendResponse = vi.fn();

    registerBackgroundMessageHandler(dependencies);
    const listener = getRegisteredListener();
    expect(
      listener?.(
        { message: 'downloadOpenSubtitle', params: { fileId: 11, language: 'en' } },
        {},
        sendResponse
      )
    ).toBe(true);

    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        code: 'SERVER',
        message: 'The OpenSubtitles request failed.',
      })
    );
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
