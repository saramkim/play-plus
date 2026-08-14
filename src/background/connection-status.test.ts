import { describe, expect, it, vi } from 'vitest';

import { createConnectionStatus } from './connection-status';

const createPlaybackStatus = (overrides: Record<string, unknown> = {}) => ({
  contentEpoch: 1,
  contentInstanceId: 'content-1',
  hasVideo: true,
  learningAvailable: true,
  lifecycle: 'content' as const,
  mediaAttachmentRevision: 1,
  missionResumeRequired: false,
  routeChangedAt: 1_000,
  routeKind: 'episode' as const,
  subtitleIdentity: {
    learning: 'native:en',
    subtitleRevision: 1,
    support: null,
  },
  videoId: '00000000-0000-4000-8000-000000000001',
  videoRevision: 1,
  ...overrides,
});

const createDependencies = () => ({
  getCurrentVideoId: vi.fn(async () => '00000000-0000-4000-8000-000000000001'),
  handleSubtitleContentStatus: vi.fn(async () => {}),
  pingContent: vi.fn(async () => ({
    success: true as const,
    data: createPlaybackStatus(),
  })),
  updateTabInfo: vi.fn(async () => {}),
});

describe('connection status', () => {
  it('persists a successful content connection', async () => {
    const dependencies = createDependencies();
    const { checkContentConnection } = createConnectionStatus(dependencies);

    await checkContentConnection(4, true);

    expect(dependencies.updateTabInfo).toHaveBeenCalledWith(4, {
      connectionStatus: 'connected',
      videoStatus: 'detected',
    });
    expect(dependencies.handleSubtitleContentStatus).toHaveBeenCalledWith(4, expect.objectContaining({
      contentEpoch: 1,
      contentInstanceId: 'content-1',
      documentId: null,
      hasVideo: true,
      isVideoUrl: true,
      routeChangedAt: 1_000,
      videoId: '00000000-0000-4000-8000-000000000001',
      videoRevision: 1,
    }));
  });

  it('forwards a successful startup ping as a replay trigger even before content emits a new status', async () => {
    const dependencies = createDependencies();
    dependencies.pingContent.mockResolvedValue({
      success: true,
      data: createPlaybackStatus({ mediaAttachmentRevision: 7, videoRevision: 7 }),
    });
    const { checkContentConnection } = createConnectionStatus(dependencies);

    await checkContentConnection(4, true);

    expect(dependencies.getCurrentVideoId).toHaveBeenCalledWith(4);
    expect(dependencies.handleSubtitleContentStatus).toHaveBeenCalledWith(4, expect.objectContaining({
      contentEpoch: 1,
      contentInstanceId: 'content-1',
      documentId: null,
      hasVideo: true,
      isVideoUrl: true,
      routeChangedAt: 1_000,
      videoId: '00000000-0000-4000-8000-000000000001',
      videoRevision: 7,
    }));
  });

  it('discards a ping whose page-owned video changed before the current route check', async () => {
    const dependencies = createDependencies();
    dependencies.pingContent.mockResolvedValue({
      success: true,
      data: createPlaybackStatus({
        contentInstanceId: 'content-old',
        mediaAttachmentRevision: 4,
        routeChangedAt: 900,
        videoId: '00000000-0000-4000-8000-000000000002',
        videoRevision: 4,
      }),
    });
    const { checkContentConnection } = createConnectionStatus(dependencies);

    await checkContentConnection(4, true);

    expect(dependencies.updateTabInfo).not.toHaveBeenCalled();
    expect(dependencies.handleSubtitleContentStatus).not.toHaveBeenCalled();
  });

  it('restores connecting when navigation wins after a stale connected write starts', async () => {
    const dependencies = createDependencies();
    dependencies.getCurrentVideoId
      .mockResolvedValueOnce('00000000-0000-4000-8000-000000000001')
      .mockResolvedValueOnce('00000000-0000-4000-8000-000000000001')
      .mockResolvedValue('00000000-0000-4000-8000-000000000002');
    const { checkContentConnection } = createConnectionStatus(dependencies);

    await checkContentConnection(4, true);

    expect(dependencies.updateTabInfo).toHaveBeenNthCalledWith(1, 4, {
      connectionStatus: 'connected',
      videoStatus: 'detected',
    });
    expect(dependencies.updateTabInfo).toHaveBeenNthCalledWith(2, 4, {
      connectionStatus: 'connecting',
      videoStatus: 'detecting',
    });
    expect(dependencies.handleSubtitleContentStatus).not.toHaveBeenCalled();
  });

  it('does not let a lower-revision same-route status overwrite TabInfo', async () => {
    const dependencies = createDependencies();
    const { updateConnectedStatus } = createConnectionStatus(dependencies);
    const status = {
      ...createPlaybackStatus({ mediaAttachmentRevision: 2, videoRevision: 2 }),
      documentId: null,
      isVideoUrl: true,
    };

    await expect(updateConnectedStatus(4, status)).resolves.toBe(true);
    await expect(
      updateConnectedStatus(4, {
        ...status,
        hasVideo: false,
        mediaAttachmentRevision: 1,
        videoRevision: 1,
      })
    ).resolves.toBe(false);

    expect(dependencies.updateTabInfo).toHaveBeenCalledOnce();
    expect(dependencies.updateTabInfo).toHaveBeenCalledWith(4, {
      connectionStatus: 'connected',
      videoStatus: 'detected',
    });
  });

  it('does not let a delayed URL transition overwrite an accepted current status', async () => {
    const dependencies = createDependencies();
    const connectedWrite = createDeferred<void>();
    dependencies.updateTabInfo.mockImplementationOnce(() => connectedWrite.promise);
    const { updateConnectedStatus, updateNavigatingStatus } = createConnectionStatus(dependencies);
    const status = {
      ...createPlaybackStatus(),
      documentId: 'document-1',
      isVideoUrl: true,
    };

    const connected = updateConnectedStatus(4, status);
    await vi.waitFor(() => expect(dependencies.updateTabInfo).toHaveBeenCalledOnce());
    const navigating = updateNavigatingStatus(4, true, status.videoId);
    connectedWrite.resolve();
    await Promise.all([connected, navigating]);

    expect(dependencies.updateTabInfo).toHaveBeenCalledOnce();
    expect(dependencies.updateTabInfo).toHaveBeenCalledWith(4, {
      connectionStatus: 'connected',
      videoStatus: 'detected',
    });
  });

  it('derives a successful ping route from the verified content snapshot', async () => {
    const dependencies = createDependencies();
    const { checkContentConnection } = createConnectionStatus(dependencies);

    await checkContentConnection(4, false);

    expect(dependencies.handleSubtitleContentStatus).toHaveBeenCalledWith(
      4,
      expect.objectContaining({
        isVideoUrl: true,
        videoId: '00000000-0000-4000-8000-000000000001',
      })
    );
    expect(dependencies.updateTabInfo).toHaveBeenCalledWith(4, {
      connectionStatus: 'connected',
      videoStatus: 'detected',
    });
  });

  it('marks the tab disconnected when ping delivery fails', async () => {
    const dependencies = createDependencies();
    dependencies.pingContent.mockRejectedValue(new Error('no receiver'));
    const { checkContentConnection } = createConnectionStatus(dependencies);

    await checkContentConnection(4, true);

    expect(dependencies.updateTabInfo).toHaveBeenCalledWith(4, {
      connectionStatus: 'disconnected',
      videoStatus: 'not_detected',
    });
    expect(dependencies.handleSubtitleContentStatus).not.toHaveBeenCalled();
  });

  it('propagates status persistence failures without writing a false disconnected state', async () => {
    const dependencies = createDependencies();
    dependencies.updateTabInfo.mockRejectedValue(new Error('storage failed'));
    const { checkContentConnection } = createConnectionStatus(dependencies);

    await expect(checkContentConnection(4, true)).rejects.toThrow('storage failed');
    expect(dependencies.updateTabInfo).toHaveBeenCalledTimes(1);
    expect(dependencies.handleSubtitleContentStatus).not.toHaveBeenCalled();
  });
});

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};
