import type { ListeningMissionResult } from '@storage/v2/listening-progress-storage';
import { listeningSegmentKeySchema } from '@storage/v2/schema';
import type { BeginListeningSessionResponse } from '@utils/message/type';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createListeningMissionTransport,
  LISTENING_HEARTBEAT_INTERVAL_MS,
  type ListeningRuntimeMessageSender,
  type ListeningTabMessageSender,
} from './listening-mission-controller';

describe('Listening Mission UI transport', () => {
  const sendRuntimeMessage = vi.fn();
  const sendTabMessage = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => vi.useRealTimers());

  it('uses only direct guarded catalog/begin messages and runtime progress facts', async () => {
    sendTabMessage
      .mockResolvedValueOnce({ success: true, data: catalog })
      .mockResolvedValueOnce({ success: true, data: readySession });
    sendRuntimeMessage.mockResolvedValueOnce({ success: true, data: EMPTY_PROGRESS });
    const transport = createTransport();

    await expect(transport.getCatalog()).resolves.toEqual(catalog);
    await expect(transport.getProgress()).resolves.toEqual(EMPTY_PROGRESS);
    await expect(transport.beginSession(catalog, [SEGMENT_A])).resolves.toEqual(readySession);

    expect(sendTabMessage).toHaveBeenNthCalledWith(1, 17, 'getListeningCatalog');
    expect(sendRuntimeMessage).toHaveBeenCalledWith('getListeningProgress');
    expect(sendTabMessage).toHaveBeenNthCalledWith(2, 17, 'beginListeningSession', {
      expectedIdentity: catalog.identity,
      expectedSubtitleRevision: 3,
      segmentKeys: [SEGMENT_A],
    });
  });

  it('accepts signed delayed intervals while rejecting reversed and nonfinite timing', async () => {
    sendTabMessage
      .mockResolvedValueOnce({ success: true, data: negativeCatalog })
      .mockResolvedValueOnce({ success: true, data: negativeReadySession })
      .mockResolvedValueOnce({
        success: true,
        data: {
          ...negativeReadySession,
          snapshot: {
            ...negativeReadySession.snapshot,
            segments: [{ ...negativeReadySession.snapshot.segments[0], endMs: -1_500 }],
          },
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          ...negativeCatalog,
          segments: [{ ...negativeCatalog.segments[0], endMs: Number.POSITIVE_INFINITY }],
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          ...negativeCatalog,
          segments: [{ ...negativeCatalog.segments[0], endMs: -1_500 }],
        },
      });
    const transport = createTransport();

    await expect(transport.getCatalog()).resolves.toEqual(negativeCatalog);
    await expect(transport.beginSession(negativeCatalog, [SEGMENT_A])).resolves.toEqual(
      negativeReadySession
    );
    await expect(transport.beginSession(negativeCatalog, [SEGMENT_A])).resolves.toEqual({
      status: 'error',
    });
    await expect(transport.getCatalog()).resolves.toEqual({ status: 'error' });
    await expect(transport.getCatalog()).resolves.toEqual({ status: 'error' });
  });

  it('maps playback, saves selected difficult keys in order, and preserves terminal truth', async () => {
    sendTabMessage
      .mockResolvedValueOnce({ success: true, data: { status: 'played' } })
      .mockResolvedValueOnce({ success: true, data: { status: 'saved-with-support' } })
      .mockResolvedValueOnce({ success: true, data: { status: 'busy' } })
      .mockResolvedValueOnce({ success: true, data: { status: 'stale' } });
    const controller = createController();

    await expect(controller.playSegment(SEGMENT_A, 0.75)).resolves.toEqual({ status: 'played' });
    await expect(
      controller.saveDifficultSegments([SEGMENT_A, SEGMENT_B, SEGMENT_C, SEGMENT_D])
    ).resolves.toEqual({
      retryableFailures: [{ reason: 'busy', segmentKey: SEGMENT_B }],
      saved: [SEGMENT_A],
      terminalFailure: {
        reason: 'stale',
        segmentKey: SEGMENT_C,
        unattempted: [SEGMENT_D],
      },
    });
    expect(sendTabMessage).not.toHaveBeenCalledWith(
      17,
      'saveListeningSegment',
      expect.objectContaining({ segmentKey: SEGMENT_D })
    );
  });

  it('fails closed for malformed, extra, and mismatched transport data', async () => {
    sendTabMessage
      .mockResolvedValueOnce({ success: true, data: { ...catalog, extra: true } })
      .mockResolvedValueOnce({
        success: true,
        data: { ...readySession, subtitleRevision: 4 },
      })
      .mockResolvedValueOnce({ success: true, data: { status: 'ended' } })
      .mockResolvedValueOnce({
        success: true,
        data: {
          ...readySession,
          snapshot: {
            ...readySession.snapshot,
            segments: [{ ...readySession.snapshot.segments[0], answerText: ' ' }],
          },
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          ...readySession,
          snapshot: { ...readySession.snapshot, learningLanguage: 'unsupported-language' },
        },
      })
      .mockResolvedValueOnce({ success: true, data: { status: 'played', extra: true } });
    sendRuntimeMessage
      .mockResolvedValueOnce({ success: true, data: { version: 1, videos: {}, extra: true } })
      .mockResolvedValueOnce({ success: true, data: { version: 1, videos: {}, extra: true } });
    const transport = createTransport();

    await expect(transport.getCatalog()).resolves.toEqual({ status: 'error' });
    await expect(transport.getProgress()).rejects.toThrow('Listening progress operation failed');
    await expect(transport.beginSession(catalog, [SEGMENT_A])).resolves.toEqual({ status: 'stale' });
    await expect(transport.beginSession(catalog, [SEGMENT_A])).resolves.toEqual({ status: 'error' });
    await expect(transport.beginSession(catalog, [SEGMENT_A])).resolves.toEqual({ status: 'error' });
    const controller = transport.createSessionController(readySession, vi.fn());
    await expect(controller.playSegment(SEGMENT_A, 1)).resolves.toEqual({ status: 'error' });
    await expect(controller.commitProgress(PROGRESS_RESULT)).resolves.toEqual({ status: 'error' });
  });

  it('awaits exact stale-ready cleanup before returning stale', async () => {
    const cleanup = deferred<{ success: true; data: { status: 'ended' } }>();
    sendTabMessage
      .mockResolvedValueOnce({ success: true, data: mismatchedReadySession })
      .mockReturnValueOnce(cleanup.promise);
    const transport = createTransport();

    const request = transport.beginSession(catalog, [SEGMENT_A]);
    let settled = false;
    void request.then(() => {
      settled = true;
    });
    await Promise.resolve();

    expect(settled).toBe(false);
    expect(sendTabMessage).toHaveBeenNthCalledWith(1, 17, 'beginListeningSession', {
      expectedIdentity: catalog.identity,
      expectedSubtitleRevision: catalog.subtitleRevision,
      segmentKeys: [SEGMENT_A],
    });
    expect(sendTabMessage).toHaveBeenNthCalledWith(2, 17, 'endListeningSession', {
      mode: 'restore-start',
      sessionId: mismatchedReadySession.sessionId,
    });

    cleanup.resolve({ success: true, data: { status: 'ended' } });
    await expect(request).resolves.toEqual({ status: 'stale' });
    expect(sendTabMessage).toHaveBeenCalledTimes(2);
  });

  it('keeps stale truth when stale-ready cleanup rejects', async () => {
    sendTabMessage
      .mockResolvedValueOnce({ success: true, data: mismatchedReadySession })
      .mockRejectedValueOnce(new Error('cleanup unavailable'));
    const transport = createTransport();

    await expect(transport.beginSession(catalog, [SEGMENT_A])).resolves.toEqual({
      status: 'stale',
    });
    await vi.advanceTimersByTimeAsync(LISTENING_HEARTBEAT_INTERVAL_MS * 4);

    expect(sendTabMessage).toHaveBeenCalledTimes(2);
    expect(sendTabMessage).toHaveBeenLastCalledWith(17, 'endListeningSession', {
      mode: 'restore-start',
      sessionId: mismatchedReadySession.sessionId,
    });
  });

  it('does not resend a successful progress commit and retries a rejected one without text', async () => {
    sendRuntimeMessage
      .mockResolvedValueOnce({ success: false, message: 'write failed' })
      .mockResolvedValueOnce({ success: true, data: EMPTY_PROGRESS });
    const controller = createController();

    await expect(controller.commitProgress(PROGRESS_RESULT)).resolves.toEqual({ status: 'error' });
    await expect(controller.commitProgress(PROGRESS_RESULT)).resolves.toEqual({ status: 'saved' });
    await expect(controller.commitProgress(PROGRESS_RESULT)).resolves.toEqual({ status: 'saved' });

    expect(sendRuntimeMessage).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(sendRuntimeMessage.mock.calls)).not.toMatch(/answer|draft|text/i);
  });

  it('heartbeats every five seconds, ignores a late beat after stop, and reports terminal state once', async () => {
    const terminal = vi.fn();
    const heartbeat = deferred<{ success: true; data: { status: 'stale' } }>();
    sendTabMessage.mockReturnValueOnce(heartbeat.promise);
    const controller = createController(terminal);

    controller.startHeartbeat();
    await vi.advanceTimersByTimeAsync(LISTENING_HEARTBEAT_INTERVAL_MS);
    controller.stopHeartbeat();
    heartbeat.resolve({ success: true, data: { status: 'stale' } });
    await Promise.resolve();
    expect(terminal).not.toHaveBeenCalled();

    sendTabMessage.mockResolvedValueOnce({ success: true, data: { status: 'no-video' } });
    controller.startHeartbeat();
    await vi.advanceTimersByTimeAsync(LISTENING_HEARTBEAT_INTERVAL_MS);
    expect(terminal).toHaveBeenCalledOnce();
    expect(terminal).toHaveBeenCalledWith('no-video');
  });

  it('stops heartbeat after terminal play while completed progress remains saveable', async () => {
    const terminal = vi.fn();
    sendTabMessage.mockResolvedValueOnce({ success: true, data: { status: 'stale' } });
    sendRuntimeMessage.mockResolvedValueOnce({ success: true, data: EMPTY_PROGRESS });
    const controller = createController(terminal);
    controller.startHeartbeat();

    await expect(controller.playSegment(SEGMENT_A, 1)).resolves.toEqual({ status: 'stale' });
    await expect(controller.commitProgress(PROGRESS_RESULT)).resolves.toEqual({ status: 'saved' });
    await vi.advanceTimersByTimeAsync(LISTENING_HEARTBEAT_INTERVAL_MS * 3);

    expect(sendTabMessage).toHaveBeenCalledOnce();
    expect(terminal).not.toHaveBeenCalled();
  });

  it.each(['stale', 'no-video', 'segment-unavailable'] as const)(
    'keeps the lease after an obsolete replaced play and stops on current %s truth',
    async (terminalStatus) => {
      const obsoletePlay = deferred<{ success: true; data: { status: 'stale' } }>();
      let playRequestCount = 0;
      sendTabMessage.mockImplementation((_tabId, message) => {
        if (message === 'heartbeatListeningSession') {
          return Promise.resolve({ success: true, data: { status: 'alive' } });
        }
        if (message === 'playListeningSegment') {
          playRequestCount += 1;
          if (playRequestCount === 1) return obsoletePlay.promise;
          return Promise.resolve({
            success: true,
            data: { status: playRequestCount <= 3 ? 'played' : terminalStatus },
          });
        }
        throw new Error(`Unexpected message: ${message}`);
      });
      const controller = createController();
      controller.startHeartbeat();

      const obsoleteResult = controller.playSegment(SEGMENT_A, 1);
      await expect(controller.playSegment(SEGMENT_B, 0.75)).resolves.toEqual({ status: 'played' });
      obsoletePlay.resolve({ success: true, data: { status: 'stale' } });
      await expect(obsoleteResult).resolves.toEqual({ status: 'stale' });

      await vi.advanceTimersByTimeAsync(16_000);
      const activeLeaseRenewals = sendTabMessage.mock.calls.filter(
        ([, message]) => message === 'heartbeatListeningSession'
      );
      expect(activeLeaseRenewals).toHaveLength(3);

      await expect(controller.playSegment(SEGMENT_C, 1)).resolves.toEqual({ status: 'played' });
      await expect(controller.playSegment(SEGMENT_D, 0.75)).resolves.toEqual({
        status: terminalStatus,
      });
      await vi.advanceTimersByTimeAsync(LISTENING_HEARTBEAT_INTERVAL_MS * 3);
      expect(
        sendTabMessage.mock.calls.filter(([, message]) => message === 'heartbeatListeningSession')
      ).toHaveLength(activeLeaseRenewals.length);
    }
  );

  it('does not let an invalid local play supersede an accepted in-flight request', async () => {
    const currentPlay = deferred<{ success: true; data: { status: 'stale' } }>();
    sendTabMessage.mockReturnValueOnce(currentPlay.promise);
    const controller = createController();
    controller.startHeartbeat();

    const currentResult = controller.playSegment(SEGMENT_A, 1);
    await expect(controller.playSegment('invalid-segment-key', 0.75)).resolves.toEqual({
      status: 'error',
    });
    currentPlay.resolve({ success: true, data: { status: 'stale' } });
    await expect(currentResult).resolves.toEqual({ status: 'stale' });
    await vi.advanceTimersByTimeAsync(LISTENING_HEARTBEAT_INTERVAL_MS * 3);

    expect(sendTabMessage).toHaveBeenCalledOnce();
  });

  it('stops heartbeat after a terminal difficult-save result', async () => {
    const terminal = vi.fn();
    sendTabMessage.mockResolvedValueOnce({
      success: true,
      data: { status: 'segment-unavailable' },
    });
    const controller = createController(terminal);
    controller.startHeartbeat();

    await expect(controller.saveDifficultSegments([SEGMENT_A, SEGMENT_B])).resolves.toEqual({
      retryableFailures: [],
      saved: [],
      terminalFailure: {
        reason: 'segment-unavailable',
        segmentKey: SEGMENT_A,
        unattempted: [SEGMENT_B],
      },
    });
    await vi.advanceTimersByTimeAsync(LISTENING_HEARTBEAT_INTERVAL_MS * 3);

    expect(sendTabMessage).toHaveBeenCalledOnce();
    expect(terminal).not.toHaveBeenCalled();
  });

  it('stops heartbeat on end and returns an idempotent exact-session status', async () => {
    sendTabMessage.mockResolvedValueOnce({ success: true, data: { status: 'ended' } });
    const controller = createController();
    controller.startHeartbeat();

    await expect(controller.endSession('complete-stay')).resolves.toEqual({ status: 'ended' });
    await expect(controller.endSession('continue-watching')).resolves.toEqual({ status: 'already-ended' });
    await vi.advanceTimersByTimeAsync(LISTENING_HEARTBEAT_INTERVAL_MS * 2);

    expect(sendTabMessage).toHaveBeenCalledOnce();
    expect(sendTabMessage).toHaveBeenCalledWith(17, 'endListeningSession', {
      mode: 'complete-stay',
      sessionId: 'session-a',
    });
  });

  it('renews the lease beyond 15 seconds while a retryable end error is visible', async () => {
    let endAttempts = 0;
    sendTabMessage.mockImplementation((_tabId, message) => {
      if (message === 'endListeningSession') {
        endAttempts += 1;
        return Promise.resolve({
          success: true,
          data: { status: endAttempts === 1 ? 'error' : 'ended' },
        });
      }
      if (message === 'heartbeatListeningSession') {
        return Promise.resolve({ success: true, data: { status: 'alive' } });
      }
      throw new Error(`Unexpected message: ${message}`);
    });
    const controller = createController();
    controller.startHeartbeat();

    await expect(controller.endSession('restore-start')).resolves.toEqual({ status: 'error' });
    await vi.advanceTimersByTimeAsync(16_000);
    expect(
      sendTabMessage.mock.calls.filter(([, message]) => message === 'heartbeatListeningSession')
    ).toHaveLength(3);
    await expect(controller.endSession('restore-start')).resolves.toEqual({ status: 'ended' });
  });

  it('ignores a late pre-end terminal play after a retryable end restarts the lease', async () => {
    const pendingPlay = deferred<{ success: true; data: { status: 'stale' } }>();
    let endAttempts = 0;
    sendTabMessage.mockImplementation((_tabId, message) => {
      if (message === 'playListeningSegment') return pendingPlay.promise;
      if (message === 'endListeningSession') {
        endAttempts += 1;
        return Promise.resolve({
          success: true,
          data: { status: endAttempts === 1 ? 'error' : 'ended' },
        });
      }
      if (message === 'heartbeatListeningSession') {
        return Promise.resolve({ success: true, data: { status: 'alive' } });
      }
      throw new Error(`Unexpected message: ${message}`);
    });
    const controller = createController();
    controller.startHeartbeat();

    const playRequest = controller.playSegment(SEGMENT_A, 1);
    await expect(controller.endSession('restore-start')).resolves.toEqual({ status: 'error' });
    pendingPlay.resolve({ success: true, data: { status: 'stale' } });
    await expect(playRequest).resolves.toEqual({ status: 'stale' });

    await vi.advanceTimersByTimeAsync(16_000);
    const activeLeaseRenewals = sendTabMessage.mock.calls.filter(
      ([, message]) => message === 'heartbeatListeningSession'
    );
    expect(activeLeaseRenewals).toHaveLength(3);

    await expect(controller.endSession('restore-start')).resolves.toEqual({ status: 'ended' });
    await vi.advanceTimersByTimeAsync(LISTENING_HEARTBEAT_INTERVAL_MS * 3);
    expect(
      sendTabMessage.mock.calls.filter(([, message]) => message === 'heartbeatListeningSession')
    ).toHaveLength(activeLeaseRenewals.length);
  });

  it('does not restart heartbeat when unmount disposal cannot end the session', async () => {
    sendTabMessage.mockResolvedValue({ success: true, data: { status: 'error' } });
    const controller = createController();
    controller.startHeartbeat();

    await controller.dispose();
    await vi.advanceTimersByTimeAsync(16_000);

    expect(sendTabMessage).toHaveBeenCalledOnce();
    expect(sendTabMessage).toHaveBeenCalledWith(17, 'endListeningSession', {
      mode: 'restore-start',
      sessionId: 'session-a',
    });
  });

  it('awaits a successful in-flight complete-stay end before disposal resolves', async () => {
    const pendingEnd = deferred<{ success: true; data: { status: 'ended' } }>();
    sendTabMessage.mockReturnValueOnce(pendingEnd.promise);
    const controller = createController();

    const endRequest = controller.endSession('complete-stay');
    const disposal = controller.dispose();
    let disposalResolved = false;
    void disposal.then(() => {
      disposalResolved = true;
    });
    await Promise.resolve();

    expect(disposalResolved).toBe(false);
    expect(sendTabMessage).toHaveBeenCalledOnce();
    pendingEnd.resolve({ success: true, data: { status: 'ended' } });

    await expect(endRequest).resolves.toEqual({ status: 'ended' });
    await expect(disposal).resolves.toBeUndefined();
    expect(sendTabMessage).toHaveBeenCalledOnce();
  });

  it('waits for an errored continue-watching end, then awaits one restore cleanup', async () => {
    const pendingEnd = deferred<{ success: true; data: { status: 'error' } }>();
    const pendingCleanup = deferred<{ success: true; data: { status: 'ended' } }>();
    sendTabMessage
      .mockReturnValueOnce(pendingEnd.promise)
      .mockReturnValueOnce(pendingCleanup.promise);
    const controller = createController();

    const endRequest = controller.endSession('continue-watching');
    const disposal = controller.dispose();
    let disposalResolved = false;
    void disposal.then(() => {
      disposalResolved = true;
    });
    pendingEnd.resolve({ success: true, data: { status: 'error' } });
    await Promise.resolve();
    await Promise.resolve();

    await expect(endRequest).resolves.toEqual({ status: 'error' });
    expect(disposalResolved).toBe(false);
    expect(sendTabMessage).toHaveBeenNthCalledWith(2, 17, 'endListeningSession', {
      mode: 'restore-start',
      sessionId: 'session-a',
    });

    pendingCleanup.resolve({ success: true, data: { status: 'ended' } });
    await expect(disposal).resolves.toBeUndefined();
    expect(sendTabMessage).toHaveBeenCalledTimes(2);
  });

  const createTransport = () =>
    createListeningMissionTransport(17, {
      clearInterval,
      sendRuntimeMessage: sendRuntimeMessage as unknown as ListeningRuntimeMessageSender,
      sendTabMessage: sendTabMessage as unknown as ListeningTabMessageSender,
      setInterval,
    });

  const createController = (onFatal = vi.fn()) =>
    createTransport().createSessionController(readySession, onFatal);
});

const SEGMENT_A = listeningSegmentKeySchema.parse(`segment-v1-${'a'.repeat(64)}`);
const SEGMENT_B = listeningSegmentKeySchema.parse(`segment-v1-${'b'.repeat(64)}`);
const SEGMENT_C = listeningSegmentKeySchema.parse(`segment-v1-${'c'.repeat(64)}`);
const SEGMENT_D = listeningSegmentKeySchema.parse(`segment-v1-${'d'.repeat(64)}`);

const catalog = {
  currentTime: 1,
  identity: {
    contentEpoch: 1,
    contentInstanceId: 'content-a',
    routeChangedAt: 1,
    videoId: '123e4567-e89b-12d3-a456-426614174020',
    videoRevision: 2,
  },
  segmenterVersion: 1,
  segments: [{ endMs: 1800, segmentKey: SEGMENT_A, startMs: 1000 }],
  sourceKey: 'native:en',
  status: 'ready',
  subtitleRevision: 3,
  supportAvailable: true,
  videoId: '123e4567-e89b-12d3-a456-426614174020',
} as const;

const readySession = {
  identity: catalog.identity,
  sessionId: 'session-a',
  snapshot: {
    learningLanguage: 'en',
    segmenterVersion: 1,
    segments: [
      {
        answerText: 'fixture line',
        endMs: 1800,
        segmentKey: SEGMENT_A,
        sourceIndices: [0],
        sourceKey: 'native:en',
        startMs: 1000,
      },
    ],
    sourceKey: 'native:en',
    videoId: '123e4567-e89b-12d3-a456-426614174020',
  },
  status: 'ready',
  subtitleRevision: 3,
} satisfies Extract<BeginListeningSessionResponse, { status: 'ready' }>;

const mismatchedReadySession = {
  ...readySession,
  sessionId: 'session-stale-ready',
  snapshot: {
    ...readySession.snapshot,
    segments: readySession.snapshot.segments.map((segment) => ({
      ...segment,
      sourceKey: 'registered:subtitle-00000000-0000-4000-8000-000000000000' as const,
    })),
    sourceKey: 'registered:subtitle-00000000-0000-4000-8000-000000000000' as const,
  },
} satisfies Extract<BeginListeningSessionResponse, { status: 'ready' }>;

const negativeCatalog = {
  ...catalog,
  currentTime: 0,
  segments: [{ ...catalog.segments[0], endMs: -200, startMs: -1_000 }],
} as const;

const negativeReadySession = {
  ...readySession,
  snapshot: {
    ...readySession.snapshot,
    segments: [{ ...readySession.snapshot.segments[0], endMs: -200, startMs: -1_000 }],
  },
} satisfies Extract<BeginListeningSessionResponse, { status: 'ready' }>;

const PROGRESS_RESULT: ListeningMissionResult = {
  bestCombo: 1,
  items: [{ achievedState: 'cleared', segmentKey: SEGMENT_A, submittedAttemptIncrement: 1 }],
  learningSourceKey: 'native:en',
  practicedAt: '2026-08-09T12:00:00+00:00',
  segmenterVersion: 1,
  videoId: '123e4567-e89b-12d3-a456-426614174020',
};

const EMPTY_PROGRESS = { version: 1, videos: {} } as const;

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};
