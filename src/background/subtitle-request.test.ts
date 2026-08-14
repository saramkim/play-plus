import type { SubtitleReplayRequest } from '@storage/session-type';
import type { MessageResponse } from '@utils/message';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createSubtitleRequestReplayController,
  registerSubtitleRequestCapture,
} from './subtitle-request';
import type { CaptureSubtitleRequest } from './subtitle-request';

const VIDEO_ID = '123e4567-e89b-12d3-a456-426614174000';
const OTHER_VIDEO_ID = '123e4567-e89b-12d3-a456-426614174001';
const VIDEO_URL = `https://www.coupangplay.com/play/${VIDEO_ID}`;

const createRequest = (
  requestId: string,
  videoId: string | null = VIDEO_ID,
  identity: Partial<
    Pick<SubtitleReplayRequest, 'capturedAt' | 'contentInstanceId' | 'documentId'>
  > = {}
): SubtitleReplayRequest => ({
  capturedAt: null,
  contentInstanceId: 'unknown-content-instance',
  documentId: null,
  requestId,
  videoId,
  url: 'https://synthetic.test/playback',
  headers: [{ name: 'x-test', value: 'yes' }],
  ...identity,
});

const createHarness = () => {
  const replayByTab = new Map<number, SubtitleReplayRequest>();
  const dependencies = {
    clearReplay: vi.fn(async (tabId: number) => {
      replayByTab.delete(tabId);
    }),
    deliver: vi.fn<
      (tabId: number, request: SubtitleReplayRequest) => Promise<MessageResponse<'fetchVideoMetadata'>>
    >(async () => ({ success: true })),
    getReplay: vi.fn(async (tabId: number) => replayByTab.get(tabId)),
    now: vi.fn(() => 1_000),
    pingContent: vi.fn(async () => ({
      success: true as const,
      data: {
        contentEpoch: 1,
        contentInstanceId: 'content-1',
        hasVideo: false,
        routeChangedAt: 1_000,
        videoId: VIDEO_ID,
        videoRevision: 0,
      },
    })),
    saveReplay: vi.fn(async (tabId: number, request: SubtitleReplayRequest) => {
      replayByTab.set(tabId, request);
    }),
  };

  return {
    controller: createSubtitleRequestReplayController(dependencies),
    dependencies,
    replayByTab,
  };
};

beforeEach(() => vi.clearAllMocks());

describe('subtitle request replay controller', () => {
  it('replays a pre-listener capture once per detected player and retains its source', async () => {
    const { controller, dependencies, replayByTab } = createHarness();
    const request = createRequest('request-1');

    await controller.capture(5, request);

    expect(dependencies.deliver).not.toHaveBeenCalled();
    expect(replayByTab.get(5)).toEqual(request);

    await controller.handleContentStatus(5, {
      hasVideo: true,
      isVideoUrl: true,
      videoId: VIDEO_ID,
      videoRevision: 1,
    });
    await controller.handleContentStatus(5, {
      hasVideo: true,
      isVideoUrl: true,
      videoId: VIDEO_ID,
      videoRevision: 1,
    });

    expect(dependencies.deliver).toHaveBeenCalledOnce();
    expect(replayByTab.get(5)).toEqual(request);

    await controller.handleContentStatus(5, {
      hasVideo: true,
      isVideoUrl: true,
      videoId: VIDEO_ID,
      videoRevision: 2,
    });

    expect(dependencies.deliver).toHaveBeenCalledTimes(2);
  });

  it('retains and retries typed and transport failures', async () => {
    const { controller, dependencies, replayByTab } = createHarness();
    const request = createRequest('request-1');
    dependencies.deliver
      .mockResolvedValueOnce({ success: false, message: 'synthetic failure' })
      .mockRejectedValueOnce(new Error('synthetic transport failure'))
      .mockResolvedValueOnce({ success: true });
    await controller.capture(5, request);
    const status = {
      hasVideo: true,
      isVideoUrl: true,
      videoId: VIDEO_ID,
      videoRevision: 1,
    };

    await controller.handleContentStatus(5, status);
    await controller.handleContentStatus(5, status);
    await controller.handleContentStatus(5, status);
    await controller.handleContentStatus(5, status);

    expect(dependencies.deliver).toHaveBeenCalledTimes(3);
    expect(replayByTab.get(5)).toEqual(request);
  });

  it('delivers the latest capture after an older delivery settles', async () => {
    const { controller, dependencies } = createHarness();
    const firstDelivery = createDeferred<{ success: true }>();
    dependencies.deliver
      .mockImplementationOnce(() => firstDelivery.promise)
      .mockResolvedValueOnce({ success: true });
    await controller.handleContentStatus(5, {
      hasVideo: true,
      isVideoUrl: true,
      videoId: VIDEO_ID,
      videoRevision: 1,
    });

    const firstCapture = controller.capture(5, createRequest('request-1'));
    await vi.waitFor(() => expect(dependencies.deliver).toHaveBeenCalledOnce());
    const secondCapture = controller.capture(5, createRequest('request-2'));
    await vi.waitFor(() => expect(dependencies.saveReplay).toHaveBeenCalledTimes(2));

    firstDelivery.resolve({ success: true });
    await Promise.all([firstCapture, secondCapture]);

    expect(dependencies.deliver).toHaveBeenCalledTimes(2);
    expect(dependencies.deliver).toHaveBeenLastCalledWith(
      5,
      expect.objectContaining(createRequest('request-2'))
    );
  });

  it('flushes the latest capture and player revision after an older delivery fails', async () => {
    const { controller, dependencies } = createHarness();
    const firstDelivery = createDeferred<MessageResponse<'fetchVideoMetadata'>>();
    dependencies.deliver
      .mockImplementationOnce(() => firstDelivery.promise)
      .mockResolvedValueOnce({ success: true });
    await controller.handleContentStatus(5, {
      hasVideo: true,
      isVideoUrl: true,
      videoId: VIDEO_ID,
      videoRevision: 1,
    });

    const firstCapture = controller.capture(5, createRequest('request-1'));
    await vi.waitFor(() => expect(dependencies.deliver).toHaveBeenCalledOnce());
    const secondCapture = controller.capture(5, createRequest('request-2'));
    await vi.waitFor(() => expect(dependencies.saveReplay).toHaveBeenCalledTimes(2));
    const newerStatus = controller.handleContentStatus(5, {
      hasVideo: true,
      isVideoUrl: true,
      videoId: VIDEO_ID,
      videoRevision: 2,
    });

    firstDelivery.resolve({ success: false, message: 'synthetic failure' });
    await Promise.all([firstCapture, secondCapture, newerStatus]);

    expect(dependencies.deliver).toHaveBeenCalledTimes(2);
    expect(dependencies.deliver).toHaveBeenLastCalledWith(
      5,
      expect.objectContaining(createRequest('request-2'))
    );

    await controller.handleContentStatus(5, {
      hasVideo: true,
      isVideoUrl: true,
      videoId: VIDEO_ID,
      videoRevision: 2,
    });

    expect(dependencies.deliver).toHaveBeenCalledTimes(2);
  });

  it('keeps a newer capture when an older video resolution finishes later', async () => {
    const { controller, dependencies, replayByTab } = createHarness();
    const oldVideoId = createDeferred<string | null>();
    const oldCapture = controller.capture(
      5,
      {
        contentInstanceId: null,
        documentId: null,
        requestId: 'request-old',
        url: 'https://synthetic.test/playback',
        headers: [{ name: 'x-test', value: 'yes' }],
      },
      () => oldVideoId.promise
    );

    const newCapture = controller.capture(
      5,
      {
        contentInstanceId: null,
        documentId: null,
        requestId: 'request-new',
        url: 'https://synthetic.test/playback',
        headers: [{ name: 'x-test', value: 'yes' }],
      },
      async () => OTHER_VIDEO_ID
    );
    await newCapture;
    oldVideoId.resolve(VIDEO_ID);
    await oldCapture;

    expect(replayByTab.get(5)).toEqual(
      createRequest('request-new', OTHER_VIDEO_ID, { contentInstanceId: null })
    );
    expect(dependencies.saveReplay).toHaveBeenCalledOnce();
    expect(dependencies.saveReplay).toHaveBeenCalledWith(
      5,
      createRequest('request-new', OTHER_VIDEO_ID, { contentInstanceId: null })
    );
  });

  it('preserves a same-video source across reload but clears another navigation', async () => {
    const { controller, dependencies, replayByTab } = createHarness();
    await controller.capture(
      5,
      createRequest('request-1', VIDEO_ID, {
        contentInstanceId: 'content-1',
        documentId: 'document-1',
      })
    );
    const detected = {
      contentInstanceId: 'content-1',
      documentId: 'document-1',
      hasVideo: true,
      isVideoUrl: true,
      routeChangedAt: 1_000,
      videoId: VIDEO_ID,
      videoRevision: 1,
    };
    await controller.handleContentStatus(5, detected);

    await controller.handleNavigation(5, VIDEO_URL);
    await controller.handleContentStatus(5, {
      ...detected,
      contentInstanceId: 'content-2',
      documentId: 'document-2',
      routeChangedAt: 2_000,
    });

    expect(dependencies.deliver).toHaveBeenCalledTimes(2);
    expect(replayByTab.has(5)).toBe(true);
    expect(replayByTab.get(5)).toMatchObject({
      contentInstanceId: 'content-2',
      documentId: 'document-2',
    });

    await controller.handleNavigation(5, `https://www.coupangplay.com/play/${OTHER_VIDEO_ID}`);

    expect(replayByTab.has(5)).toBe(false);
  });

  it('does not let a slow old navigation clear a newer capture', async () => {
    const { controller, dependencies, replayByTab } = createHarness();
    const oldRequest = createRequest('request-old');
    const navigationClear = createDeferred<void>();
    replayByTab.set(5, oldRequest);
    dependencies.clearReplay.mockImplementationOnce(async (tabId) => {
      await navigationClear.promise;
      replayByTab.delete(tabId);
    });

    const oldNavigation = controller.handleNavigation(5, 'https://www.coupangplay.com/');
    await vi.waitFor(() => expect(dependencies.clearReplay).toHaveBeenCalledOnce());
    const newNavigation = controller.handleNavigation(
      5,
      `https://www.coupangplay.com/play/${OTHER_VIDEO_ID}`
    );
    const newCapture = controller.capture(5, createRequest('request-new', OTHER_VIDEO_ID));
    await Promise.resolve();

    expect(dependencies.saveReplay).not.toHaveBeenCalled();
    navigationClear.resolve();
    await Promise.all([oldNavigation, newNavigation, newCapture]);

    expect(replayByTab.get(5)).toEqual(createRequest('request-new', OTHER_VIDEO_ID));
    expect(dependencies.clearReplay).toHaveBeenCalledOnce();
    expect(dependencies.saveReplay).toHaveBeenCalledWith(
      5,
      createRequest('request-new', OTHER_VIDEO_ID)
    );
  });

  it('rejects a delayed old web request whose event predates the latest navigation', async () => {
    const { controller, dependencies, replayByTab } = createHarness();
    await controller.handleNavigation(5, `https://www.coupangplay.com/play/${OTHER_VIDEO_ID}`);
    dependencies.pingContent.mockResolvedValue({
      success: true,
      data: {
        contentEpoch: 1,
        contentInstanceId: 'content-1',
        hasVideo: false,
        routeChangedAt: 1_000,
        videoId: OTHER_VIDEO_ID,
        videoRevision: 0,
      },
    });

    await controller.capture(
      5,
      {
        contentInstanceId: null,
        documentId: 'document-old',
        requestId: 'request-old',
        url: 'https://synthetic.test/playback',
        headers: [],
      },
      async () => OTHER_VIDEO_ID,
      999
    );

    expect(dependencies.saveReplay).not.toHaveBeenCalled();
    expect(replayByTab.has(5)).toBe(false);
  });

  it('keeps the first current-route request when content observes navigation before tabs.onUpdated', async () => {
    const { controller, dependencies, replayByTab } = createHarness();
    await controller.handleNavigation(5, VIDEO_URL);
    dependencies.pingContent.mockResolvedValue({
      success: true,
      data: {
        contentEpoch: 1,
        contentInstanceId: 'content-1',
        hasVideo: false,
        routeChangedAt: 2_000,
        videoId: OTHER_VIDEO_ID,
        videoRevision: 1,
      },
    });

    await controller.capture(
      5,
      {
        contentInstanceId: null,
        documentId: 'document-current',
        requestId: 'request-current',
        url: 'https://synthetic.test/playback',
        headers: [{ name: 'x-test', value: 'yes' }],
      },
      async () => OTHER_VIDEO_ID,
      2_100
    );
    await controller.handleNavigation(5, `https://www.coupangplay.com/play/${OTHER_VIDEO_ID}`);
    await controller.handleContentStatus(5, {
      contentInstanceId: 'content-1',
      hasVideo: true,
      isVideoUrl: true,
      routeChangedAt: 2_000,
      videoId: OTHER_VIDEO_ID,
      videoRevision: 2,
    });

    expect(replayByTab.get(5)).toEqual(
      createRequest('request-current', OTHER_VIDEO_ID, {
        capturedAt: 2_100,
        contentInstanceId: 'content-1',
        documentId: 'document-current',
      })
    );
    expect(dependencies.deliver).toHaveBeenCalledWith(
      5,
      expect.objectContaining(
        createRequest('request-current', OTHER_VIDEO_ID, {
          capturedAt: 2_100,
          contentInstanceId: 'content-1',
          documentId: 'document-current',
        })
      )
    );
  });

  it('keeps the first new-document request before the tab URL and content ping are ready', async () => {
    const { controller, dependencies, replayByTab } = createHarness();
    await controller.handleContentStatus(5, {
      contentInstanceId: 'content-1',
      documentId: 'document-old',
      hasVideo: false,
      isVideoUrl: true,
      routeChangedAt: 1_000,
      videoId: VIDEO_ID,
      videoRevision: 0,
    });
    dependencies.pingContent.mockRejectedValue(new Error('synthetic no receiver'));

    await controller.capture(
      5,
      {
        contentInstanceId: null,
        documentId: 'document-current',
        requestId: 'request-current',
        url: 'https://synthetic.test/playback',
        headers: [{ name: 'x-test', value: 'yes' }],
      },
      async () => VIDEO_ID,
      2_100
    );
    await controller.handleNavigation(5, `https://www.coupangplay.com/play/${OTHER_VIDEO_ID}`);

    expect(replayByTab.get(5)).toEqual(
      createRequest('request-current', OTHER_VIDEO_ID, {
        capturedAt: 2_100,
        contentInstanceId: null,
        documentId: 'document-current',
      })
    );

    await controller.handleContentStatus(5, {
      contentInstanceId: 'content-2',
      documentId: 'document-current',
      hasVideo: true,
      isVideoUrl: true,
      routeChangedAt: 2_000,
      videoId: OTHER_VIDEO_ID,
      videoRevision: 1,
    });

    expect(replayByTab.get(5)).toEqual(
      createRequest('request-current', OTHER_VIDEO_ID, {
        capturedAt: 2_100,
        contentInstanceId: 'content-2',
        documentId: 'document-current',
      })
    );
    expect(dependencies.deliver).toHaveBeenCalledOnce();
  });

  it('binds a current request when Chrome reports a different document identity', async () => {
    const { controller, dependencies, replayByTab } = createHarness();
    await controller.handleNavigation(5, `https://www.coupangplay.com/play/${OTHER_VIDEO_ID}`);
    dependencies.pingContent.mockRejectedValue(new Error('synthetic no receiver'));

    await controller.capture(
      5,
      {
        contentInstanceId: null,
        documentId: 'document-old',
        requestId: 'request-old',
        url: 'https://synthetic.test/playback',
        headers: [{ name: 'x-test', value: 'yes' }],
      },
      async () => OTHER_VIDEO_ID,
      2_100
    );

    expect(replayByTab.get(5)).toMatchObject({
      contentInstanceId: null,
      documentId: 'document-old',
      videoId: OTHER_VIDEO_ID,
    });

    await controller.handleContentStatus(5, {
      contentInstanceId: 'content-new',
      documentId: 'document-new',
      hasVideo: true,
      isVideoUrl: true,
      routeChangedAt: 2_000,
      videoId: OTHER_VIDEO_ID,
      videoRevision: 1,
    });

    expect(replayByTab.get(5)).toEqual(
      createRequest('request-old', OTHER_VIDEO_ID, {
        capturedAt: 2_100,
        contentInstanceId: 'content-new',
        documentId: 'document-new',
      })
    );
    expect(dependencies.deliver).toHaveBeenCalledOnce();
  });

  it('rejects conflicting document identities when the video identity is unavailable', async () => {
    const { controller, dependencies, replayByTab } = createHarness();
    dependencies.pingContent.mockRejectedValue(new Error('synthetic no receiver'));

    await controller.capture(
      5,
      {
        contentInstanceId: null,
        documentId: 'document-old',
        requestId: 'request-unknown',
        url: 'https://synthetic.test/playback',
        headers: [],
      },
      async () => null,
      2_100
    );
    await controller.handleContentStatus(5, {
      contentInstanceId: 'content-current',
      documentId: 'document-current',
      hasVideo: true,
      isVideoUrl: true,
      routeChangedAt: 2_000,
      videoId: OTHER_VIDEO_ID,
      videoRevision: 1,
    });

    expect(replayByTab.has(5)).toBe(false);
    expect(dependencies.deliver).not.toHaveBeenCalled();
  });

  it('keeps a current request when Chrome omits both document identities', async () => {
    const { controller, dependencies, replayByTab } = createHarness();
    dependencies.pingContent.mockRejectedValue(new Error('synthetic no receiver'));

    await controller.capture(
      5,
      {
        contentInstanceId: null,
        documentId: null,
        requestId: 'request-current',
        url: 'https://synthetic.test/playback',
        headers: [{ name: 'x-test', value: 'yes' }],
      },
      async () => VIDEO_ID,
      2_100
    );
    await controller.handleNavigation(5, VIDEO_URL);

    await controller.handleContentStatus(5, {
      contentInstanceId: 'content-current',
      documentId: null,
      hasVideo: true,
      isVideoUrl: true,
      routeChangedAt: 2_000,
      videoId: VIDEO_ID,
      videoRevision: 1,
    });

    expect(replayByTab.get(5)).toEqual(
      createRequest('request-current', VIDEO_ID, {
        capturedAt: 2_100,
        contentInstanceId: 'content-current',
        documentId: null,
      })
    );
    expect(dependencies.deliver).toHaveBeenCalledOnce();
  });

  it('quarantines a capture until stale content advances to the captured route', async () => {
    const { controller, dependencies, replayByTab } = createHarness();
    await controller.handleNavigation(5, `https://www.coupangplay.com/play/${OTHER_VIDEO_ID}`);
    dependencies.pingContent.mockResolvedValue({
      success: true,
      data: {
        contentEpoch: 1,
        contentInstanceId: 'content-old',
        hasVideo: true,
        routeChangedAt: 1_000,
        videoId: VIDEO_ID,
        videoRevision: 1,
      },
    });

    await controller.capture(
      5,
      {
        contentInstanceId: null,
        documentId: null,
        requestId: 'request-current',
        url: 'https://synthetic.test/playback',
        headers: [],
      },
      async () => OTHER_VIDEO_ID,
      2_100
    );

    expect(replayByTab.get(5)).toMatchObject({
      contentInstanceId: null,
      requestId: 'request-current',
      videoId: OTHER_VIDEO_ID,
    });
    expect(dependencies.deliver).not.toHaveBeenCalled();

    await controller.handleContentStatus(5, {
      contentInstanceId: 'content-current',
      documentId: null,
      hasVideo: true,
      isVideoUrl: true,
      routeChangedAt: 2_000,
      videoId: OTHER_VIDEO_ID,
      videoRevision: 1,
    });

    expect(replayByTab.get(5)).toMatchObject({
      contentInstanceId: 'content-current',
      requestId: 'request-current',
      videoId: OTHER_VIDEO_ID,
    });
    expect(dependencies.deliver).toHaveBeenCalledOnce();
  });

  it('preserves a quarantined capture until the stale content route advances', async () => {
    const { controller, dependencies, replayByTab } = createHarness();
    await controller.handleNavigation(5, `https://www.coupangplay.com/play/${OTHER_VIDEO_ID}`);
    dependencies.pingContent.mockResolvedValue({
      success: true,
      data: {
        contentEpoch: 1,
        contentInstanceId: 'content-old',
        hasVideo: true,
        routeChangedAt: 1_000,
        videoId: VIDEO_ID,
        videoRevision: 1,
      },
    });

    await controller.capture(
      5,
      {
        contentInstanceId: null,
        documentId: null,
        requestId: 'request-current',
        url: 'https://synthetic.test/playback',
        headers: [],
      },
      async () => OTHER_VIDEO_ID,
      2_100
    );
    await controller.handleContentStatus(5, {
      contentInstanceId: 'content-old',
      documentId: null,
      hasVideo: true,
      isVideoUrl: true,
      routeChangedAt: 1_000,
      videoId: VIDEO_ID,
      videoRevision: 1,
    });

    expect(replayByTab.get(5)).toMatchObject({
      contentInstanceId: null,
      requestId: 'request-current',
      videoId: OTHER_VIDEO_ID,
    });
    expect(dependencies.deliver).not.toHaveBeenCalled();

    await controller.handleContentStatus(5, {
      contentInstanceId: 'content-current',
      documentId: null,
      hasVideo: true,
      isVideoUrl: true,
      routeChangedAt: 2_000,
      videoId: OTHER_VIDEO_ID,
      videoRevision: 1,
    });

    expect(replayByTab.get(5)).toMatchObject({
      contentInstanceId: 'content-current',
      requestId: 'request-current',
      videoId: OTHER_VIDEO_ID,
    });
    expect(dependencies.deliver).toHaveBeenCalledOnce();
  });

  it('rejects a request whose capture predates the new content route', async () => {
    const { controller, dependencies, replayByTab } = createHarness();
    await controller.handleNavigation(5, `https://www.coupangplay.com/play/${OTHER_VIDEO_ID}`);
    dependencies.pingContent.mockRejectedValue(new Error('synthetic no receiver'));

    await controller.capture(
      5,
      {
        contentInstanceId: null,
        documentId: null,
        requestId: 'request-old',
        url: 'https://synthetic.test/playback',
        headers: [],
      },
      async () => OTHER_VIDEO_ID,
      1_900
    );
    await controller.handleContentStatus(5, {
      contentInstanceId: 'content-new',
      documentId: null,
      hasVideo: true,
      isVideoUrl: true,
      routeChangedAt: 2_000,
      videoId: OTHER_VIDEO_ID,
      videoRevision: 1,
    });

    expect(replayByTab.has(5)).toBe(false);
    expect(dependencies.deliver).not.toHaveBeenCalled();
  });

  it('ignores mismatched and lower-revision statuses after the current route is detected', async () => {
    const { controller, dependencies } = createHarness();
    await controller.handleNavigation(5, `https://www.coupangplay.com/play/${OTHER_VIDEO_ID}`);
    await controller.capture(5, createRequest('request-1', OTHER_VIDEO_ID));
    await controller.handleContentStatus(5, {
      contentInstanceId: 'content-2',
      hasVideo: true,
      isVideoUrl: true,
      routeChangedAt: 2_000,
      videoId: OTHER_VIDEO_ID,
      videoRevision: 2,
    });

    await controller.handleContentStatus(5, {
      contentInstanceId: 'content-old',
      hasVideo: true,
      isVideoUrl: true,
      routeChangedAt: 1_000,
      videoId: VIDEO_ID,
      videoRevision: 9,
    });
    await controller.handleContentStatus(5, {
      contentInstanceId: 'content-2',
      hasVideo: false,
      isVideoUrl: true,
      routeChangedAt: 2_000,
      videoId: OTHER_VIDEO_ID,
      videoRevision: 1,
    });
    await controller.capture(
      5,
      createRequest('request-2', OTHER_VIDEO_ID, { contentInstanceId: 'content-2' })
    );

    expect(dependencies.clearReplay).not.toHaveBeenCalled();
    expect(dependencies.deliver).toHaveBeenCalledTimes(2);
    expect(dependencies.deliver).toHaveBeenLastCalledWith(
      5,
      expect.objectContaining(
        createRequest('request-2', OTHER_VIDEO_ID, { contentInstanceId: 'content-2' })
      )
    );
  });

  it('serializes status mutations from independent background triggers', async () => {
    const { controller, dependencies, replayByTab } = createHarness();
    const firstRead = createDeferred<void>();
    replayByTab.set(5, createRequest('request-1'));
    dependencies.getReplay
      .mockImplementationOnce(async (tabId) => {
        await firstRead.promise;
        return replayByTab.get(tabId);
      })
      .mockImplementation(async (tabId) => replayByTab.get(tabId));

    const firstStatus = controller.handleContentStatus(5, {
      hasVideo: true,
      isVideoUrl: true,
      videoId: VIDEO_ID,
      videoRevision: 1,
    });
    const secondStatus = controller.handleContentStatus(5, {
      hasVideo: true,
      isVideoUrl: true,
      videoId: VIDEO_ID,
      videoRevision: 2,
    });

    await Promise.resolve();
    expect(dependencies.deliver).not.toHaveBeenCalled();
    firstRead.resolve();
    await Promise.all([firstStatus, secondStatus]);

    expect(dependencies.deliver).toHaveBeenCalledTimes(2);
  });

  it('does not let a delayed incompatible status clear a newer capture', async () => {
    const { controller, dependencies, replayByTab } = createHarness();
    const oldRequest = createRequest('request-old');
    const statusRead = createDeferred<SubtitleReplayRequest | undefined>();
    replayByTab.set(5, oldRequest);
    dependencies.getReplay.mockImplementationOnce(() => statusRead.promise);

    const oldStatus = controller.handleContentStatus(5, {
      hasVideo: true,
      isVideoUrl: true,
      videoId: OTHER_VIDEO_ID,
      videoRevision: 1,
    });
    const newCapture = controller.capture(5, createRequest('request-new', OTHER_VIDEO_ID));
    await vi.waitFor(() => expect(dependencies.saveReplay).toHaveBeenCalledOnce());

    statusRead.resolve(oldRequest);
    await Promise.all([oldStatus, newCapture]);

    expect(replayByTab.get(5)).toEqual(createRequest('request-new', OTHER_VIDEO_ID));
    expect(dependencies.clearReplay).not.toHaveBeenCalled();
  });

  it('does not let a delayed null binding overwrite a newer capture', async () => {
    const { controller, dependencies, replayByTab } = createHarness();
    const oldRequest = createRequest('request-old', null);
    const statusRead = createDeferred<SubtitleReplayRequest | undefined>();
    replayByTab.set(5, oldRequest);
    dependencies.getReplay.mockImplementationOnce(() => statusRead.promise);

    const oldStatus = controller.handleContentStatus(5, {
      hasVideo: true,
      isVideoUrl: true,
      videoId: VIDEO_ID,
      videoRevision: 1,
    });
    const newCapture = controller.capture(5, createRequest('request-new', VIDEO_ID));
    await vi.waitFor(() => expect(dependencies.saveReplay).toHaveBeenCalledOnce());

    statusRead.resolve(oldRequest);
    await Promise.all([oldStatus, newCapture]);

    expect(replayByTab.get(5)).toEqual(createRequest('request-new', VIDEO_ID));
    expect(dependencies.saveReplay).toHaveBeenCalledOnce();
  });

  it('clears an incompatible status and binds an unresolved source to the detected video', async () => {
    const first = createHarness();
    await first.controller.capture(5, createRequest('request-1', OTHER_VIDEO_ID));

    await first.controller.handleContentStatus(5, {
      hasVideo: true,
      isVideoUrl: true,
      videoId: VIDEO_ID,
      videoRevision: 1,
    });

    expect(first.replayByTab.has(5)).toBe(false);
    expect(first.dependencies.deliver).not.toHaveBeenCalled();

    const second = createHarness();
    await second.controller.capture(5, createRequest('request-2', null));
    await second.controller.handleContentStatus(5, {
      hasVideo: true,
      isVideoUrl: true,
      videoId: VIDEO_ID,
      videoRevision: 1,
    });

    expect(second.replayByTab.get(5)?.videoId).toBe(VIDEO_ID);
    expect(second.dependencies.deliver).toHaveBeenCalledOnce();
  });

  it('reconstructs replay from session state after the controller is recreated', async () => {
    const { controller, dependencies } = createHarness();
    await controller.capture(5, createRequest('request-1'));
    const restartedController = createSubtitleRequestReplayController(dependencies);

    await restartedController.handleContentStatus(5, {
      hasVideo: true,
      isVideoUrl: true,
      videoId: VIDEO_ID,
      videoRevision: 1,
    });

    expect(dependencies.deliver).toHaveBeenCalledOnce();
  });
});

describe('subtitle request capture', () => {
  it('captures the page-owned request and ignores extension re-fetches', async () => {
    const captured = vi.fn(
      async (_tabId: number, _request: SubtitleReplayRequest, _capturedAt?: number) => {}
    );
    const capture: CaptureSubtitleRequest = async (
      tabId,
      request,
      resolveVideoId,
      capturedAt
    ) => {
      const resolved =
        'videoId' in request
          ? request
          : {
              ...request,
              capturedAt: capturedAt ?? null,
              videoId: await resolveVideoId?.() ?? null,
            };
      await captured(tabId, resolved, capturedAt);
    };
    const resolveVideoId = vi.fn(async () => VIDEO_ID);
    const addListener = vi.fn();
    Object.defineProperty(chrome, 'webRequest', {
      configurable: true,
      value: { onSendHeaders: { addListener } },
    });
    registerSubtitleRequestCapture(capture, resolveVideoId);
    const listener = addListener.mock.calls[0]?.[0] as
      | ((details: chrome.webRequest.WebRequestHeadersDetails) => void)
      | undefined;
    const details = {
      frameId: 0,
      documentId: 'document-1',
      method: 'GET',
      parentFrameId: -1,
      requestHeaders: [{ name: 'x-test', value: 'yes' }],
      requestId: 'request-1',
      tabId: 5,
      timeStamp: 1,
      type: 'xmlhttprequest',
      url: 'https://synthetic.test/playback',
    } as chrome.webRequest.WebRequestHeadersDetails;

    listener?.(details);
    await vi.waitFor(() => expect(captured).toHaveBeenCalledOnce());
    expect(captured).toHaveBeenCalledWith(
      5,
      createRequest('request-1', VIDEO_ID, {
        capturedAt: 1,
        contentInstanceId: null,
        documentId: 'document-1',
      }),
      1
    );

    listener?.({
      ...details,
      requestHeaders: [{ name: 'X-Extension-Request', value: 'true' }],
      requestId: 'request-2',
    });
    await Promise.resolve();

    expect(resolveVideoId).toHaveBeenCalledOnce();
    expect(captured).toHaveBeenCalledOnce();
  });
});

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};
