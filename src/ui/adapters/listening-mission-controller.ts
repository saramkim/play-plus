import { z } from 'zod';

import type { ListeningMissionResult } from '@storage/v2/listening-progress-storage';
import {
  listeningMissionResultSchema,
} from '@storage/v2/listening-progress-storage';
import {
  languageSchema,
  listeningProgressSchema,
  listeningSegmentKeySchema,
  listeningSourceKeySchema,
  nonnegativeSafeIntegerSchema,
} from '@storage/v2/schema';
import type { ListeningProgressV1 } from '@storage/v2/type';
import { sendMessage, sendMessageToTab } from '@utils/message';
import type {
  BeginListeningSessionResponse,
  ContentVideoIdentity,
  ListeningCatalogResponse,
  MessageSchema,
} from '@utils/message/type';

import type { ListeningSegmentKey } from '@/listening/domain/source-identity';
import type {
  DifficultSaveResult,
  EndSessionResult,
  ListeningMissionController,
  ListeningTerminalReason,
  PlaySegmentResult,
} from '@/listening/session/mission-controller';
import type { ReadyListeningCatalog } from '@/ui/features/listening-flow/listening-flow-model';

type DirectListeningMessage =
  | 'beginListeningSession'
  | 'endListeningSession'
  | 'getListeningCatalog'
  | 'heartbeatListeningSession'
  | 'playListeningSegment'
  | 'resumeListeningSessionAfterAdvertisement'
  | 'saveListeningSegment';

type RuntimeListeningMessage =
  | 'clearAllListeningProgress'
  | 'clearListeningVideoProgress'
  | 'getListeningProgress'
  | 'recordListeningMissionResult';

type MessageParams<M extends keyof MessageSchema> = MessageSchema[M] extends {
  params: infer Params;
}
  ? Params
  : never;
type MessageResult<M extends keyof MessageSchema> = MessageSchema[M] extends {
  response: infer Response;
}
  ? Response
  : void;
type TransportResponse<T> =
  | { success: true; data: T }
  | { success: false; message: string };

export type ListeningTabMessageSender = <M extends DirectListeningMessage>(
  tabId: number,
  message: M,
  ...args: MessageParams<M> extends never ? [] : [params: MessageParams<M>]
) => Promise<TransportResponse<MessageResult<M>>>;

export type ListeningRuntimeMessageSender = <M extends RuntimeListeningMessage>(
  message: M,
  ...args: MessageParams<M> extends never ? [] : [params: MessageParams<M>]
) => Promise<TransportResponse<MessageResult<M>>>;

export type ListeningSessionFatalReason = ListeningTerminalReason | 'error';

export interface ListeningSessionController extends ListeningMissionController {
  dispose: () => Promise<void>;
  sessionId: string;
  resumeAfterAdvertisement: () => Promise<'resumed' | ListeningSessionFatalReason | 'error'>;
  startHeartbeat: () => void;
  stopHeartbeat: () => void;
}

export interface ListeningMissionTransport {
  beginSession: (
    catalog: ReadyListeningCatalog,
    segmentKeys: readonly ListeningSegmentKey[]
  ) => Promise<BeginListeningSessionResponse>;
  clearAllProgress: () => Promise<ListeningProgressV1>;
  clearVideoProgress: (videoId: string) => Promise<ListeningProgressV1>;
  createSessionController: (
    session: Extract<BeginListeningSessionResponse, { status: 'ready' }>,
    onFatal: (reason: ListeningSessionFatalReason) => void
  ) => ListeningSessionController;
  getCatalog: () => Promise<ListeningCatalogResponse>;
  getProgress: () => Promise<ListeningProgressV1>;
}

export interface ListeningMissionTransportDependencies {
  clearInterval: typeof globalThis.clearInterval;
  sendRuntimeMessage: ListeningRuntimeMessageSender;
  sendTabMessage: ListeningTabMessageSender;
  setInterval: typeof globalThis.setInterval;
}

export const LISTENING_HEARTBEAT_INTERVAL_MS = 5_000;

const finiteNumberSchema = z.number().finite();
const contentVideoIdentitySchema = z
  .object({
    contentEpoch: nonnegativeSafeIntegerSchema,
    contentInstanceId: z.string().min(1),
    routeChangedAt: finiteNumberSchema,
    videoId: z.string().min(1).nullable(),
    videoRevision: nonnegativeSafeIntegerSchema,
  })
  .strict();
const intervalSchema = z
  .object({
    endMs: finiteNumberSchema,
    segmentKey: listeningSegmentKeySchema,
    startMs: finiteNumberSchema,
  })
  .strict()
  .refine(({ endMs, startMs }) => endMs >= startMs, { path: ['endMs'] });
const catalogReadySchema = z
  .object({
    currentTime: finiteNumberSchema.nonnegative(),
    identity: contentVideoIdentitySchema,
    segmenterVersion: z.literal(1),
    segments: z.array(intervalSchema).min(1),
    sourceKey: listeningSourceKeySchema,
    status: z.literal('ready'),
    subtitleRevision: nonnegativeSafeIntegerSchema,
    supportAvailable: z.boolean(),
    videoId: z.string().min(1),
  })
  .strict()
  .superRefine(({ identity, segments, videoId }, context) => {
    if (identity.videoId !== videoId) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['identity', 'videoId'] });
    }
    const keys = new Set<string>();
    segments.forEach(({ segmentKey }, index) => {
      if (keys.has(segmentKey)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['segments', index, 'segmentKey'] });
      }
      keys.add(segmentKey);
    });
  });
const listeningCatalogResponseSchema = z.union([
  catalogReadySchema,
  z
    .object({
      status: z.enum([
        'no-video',
        'video-identity-unavailable',
        'no-learning-track',
        'no-segments',
        'error',
      ]),
    })
    .strict(),
]);
const sourceIndicesSchema = z
  .array(nonnegativeSafeIntegerSchema)
  .min(1)
  .refine((indices) => indices.every((value, index) => index === 0 || value > indices[index - 1]));
const sessionSnapshotSegmentSchema = z
  .object({
    alignedSupport: z
      .object({
        sourceIndices: sourceIndicesSchema,
        text: z.string().refine((value) => value.trim().length > 0),
      })
      .strict()
      .optional(),
    answerText: z.string().refine((value) => value.trim().length > 0),
    endMs: finiteNumberSchema,
    segmentKey: listeningSegmentKeySchema,
    sourceIndices: sourceIndicesSchema,
    sourceKey: listeningSourceKeySchema,
    startMs: finiteNumberSchema,
  })
  .strict()
  .refine(({ endMs, startMs }) => endMs >= startMs, { path: ['endMs'] });
const listeningSessionSnapshotSchema = z
  .object({
    learningLanguage: languageSchema,
    segmenterVersion: z.literal(1),
    segments: z.array(sessionSnapshotSegmentSchema).min(1).max(10),
    sourceKey: listeningSourceKeySchema,
    videoId: z.string().min(1),
  })
  .strict()
  .superRefine(({ segments, sourceKey }, context) => {
    const keys = new Set<string>();
    let previousSourceIndex = -1;
    segments.forEach((segment, index) => {
      if (segment.sourceKey !== sourceKey) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['segments', index, 'sourceKey'] });
      }
      if (keys.has(segment.segmentKey)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['segments', index, 'segmentKey'] });
      }
      if (segment.sourceIndices[0] <= previousSourceIndex) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['segments', index, 'sourceIndices'] });
      }
      previousSourceIndex = segment.sourceIndices[segment.sourceIndices.length - 1];
      keys.add(segment.segmentKey);
    });
  });
const beginListeningSessionResponseSchema = z.union([
  z
    .object({
      identity: contentVideoIdentitySchema,
      sessionId: z.string().min(1),
      snapshot: listeningSessionSnapshotSchema,
      status: z.literal('ready'),
      subtitleRevision: nonnegativeSafeIntegerSchema,
    })
    .strict()
    .refine(({ identity, snapshot }) => identity.videoId === snapshot.videoId, {
      path: ['snapshot', 'videoId'],
    }),
  z
    .object({ status: z.enum(['busy', 'stale', 'no-video', 'segment-unavailable', 'error']) })
    .strict(),
]);
const heartbeatListeningSessionResponseSchema = z
  .object({ status: z.enum(['alive', 'stale', 'no-video', 'segment-unavailable', 'error']) })
  .strict();
const playListeningSegmentResponseSchema = z
  .object({ status: z.enum(['played', 'suspended', 'stale', 'no-video', 'segment-unavailable', 'error']) })
  .strict();
const resumeListeningSessionAfterAdvertisementResponseSchema = z.union([
  z
    .object({
      identity: contentVideoIdentitySchema,
      status: z.literal('resumed'),
      subtitleRevision: nonnegativeSafeIntegerSchema,
    })
    .strict(),
  z
    .object({ status: z.enum(['stale', 'no-video', 'segment-unavailable', 'error']) })
    .strict(),
]);
const saveListeningSegmentResponseSchema = z
  .object({
    status: z.enum([
      'saved-with-support',
      'saved-learning-only',
      'busy',
      'stale',
      'no-video',
      'segment-unavailable',
      'error',
    ]),
  })
  .strict();
const endListeningSessionResponseSchema = z
  .object({ status: z.enum(['ended', 'already-ended', 'stale', 'no-video', 'error']) })
  .strict();

const defaultDependencies: ListeningMissionTransportDependencies = {
  clearInterval: globalThis.clearInterval,
  sendRuntimeMessage: sendMessage as ListeningRuntimeMessageSender,
  sendTabMessage: sendMessageToTab as ListeningTabMessageSender,
  setInterval: globalThis.setInterval,
};

export const createListeningMissionTransport = (
  tabId: number,
  dependencies: ListeningMissionTransportDependencies = defaultDependencies
): ListeningMissionTransport => ({
  beginSession: async (catalog, segmentKeys) => {
    try {
      const response = await dependencies.sendTabMessage(tabId, 'beginListeningSession', {
        expectedIdentity: catalog.identity,
        expectedSubtitleRevision: catalog.subtitleRevision,
        segmentKeys,
      });
      if (!response.success) return { status: 'error' };
      const parsed = beginListeningSessionResponseSchema.safeParse(response.data);
      if (!parsed.success) return { status: 'error' };
      if (
        parsed.data.status === 'ready' &&
        (!contentIdentityEqual(parsed.data.identity, catalog.identity) ||
          parsed.data.subtitleRevision !== catalog.subtitleRevision ||
          parsed.data.snapshot.videoId !== catalog.videoId ||
          parsed.data.snapshot.sourceKey !== catalog.sourceKey ||
          parsed.data.snapshot.segmenterVersion !== catalog.segmenterVersion ||
          !sameOrderedValues(
            parsed.data.snapshot.segments.map(({ segmentKey }) => segmentKey),
            segmentKeys
          ))
      ) {
        try {
          await createListeningSessionController({
            clearInterval: dependencies.clearInterval,
            identity: parsed.data.identity,
            onFatal: () => undefined,
            sendRuntimeMessage: dependencies.sendRuntimeMessage,
            sendTabMessage: dependencies.sendTabMessage,
            sessionId: parsed.data.sessionId,
            setInterval: dependencies.setInterval,
            subtitleRevision: parsed.data.subtitleRevision,
            tabId,
          }).dispose();
        } catch {
          // The content-side lease remains the fallback when best-effort cleanup rejects.
        }
        return { status: 'stale' };
      }
      return parsed.data;
    } catch {
      return { status: 'error' };
    }
  },
  clearAllProgress: () =>
    unwrapRuntime(
      dependencies.sendRuntimeMessage('clearAllListeningProgress'),
      listeningProgressSchema
    ),
  clearVideoProgress: (videoId) =>
    unwrapRuntime(
      dependencies.sendRuntimeMessage('clearListeningVideoProgress', { videoId }),
      listeningProgressSchema
    ),
  createSessionController: (session, onFatal) =>
    createListeningSessionController({
      clearInterval: dependencies.clearInterval,
      identity: session.identity,
      onFatal,
      sendRuntimeMessage: dependencies.sendRuntimeMessage,
      sendTabMessage: dependencies.sendTabMessage,
      sessionId: session.sessionId,
      setInterval: dependencies.setInterval,
      subtitleRevision: session.subtitleRevision,
      tabId,
    }),
  getCatalog: async () => {
    try {
      const response = await dependencies.sendTabMessage(tabId, 'getListeningCatalog');
      if (!response.success) return { status: 'error' };
      const parsed = listeningCatalogResponseSchema.safeParse(response.data);
      return parsed.success ? parsed.data : { status: 'error' };
    } catch {
      return { status: 'error' };
    }
  },
  getProgress: () =>
    unwrapRuntime(dependencies.sendRuntimeMessage('getListeningProgress'), listeningProgressSchema),
});

export const createListeningSessionController = ({
  clearInterval,
  identity,
  onFatal,
  sendRuntimeMessage,
  sendTabMessage,
  sessionId,
  setInterval,
  subtitleRevision,
  tabId,
}: {
  clearInterval: typeof globalThis.clearInterval;
  identity: ContentVideoIdentity;
  onFatal: (reason: ListeningSessionFatalReason) => void;
  sendRuntimeMessage: ListeningRuntimeMessageSender;
  sendTabMessage: ListeningTabMessageSender;
  sessionId: string;
  setInterval: typeof globalThis.setInterval;
  subtitleRevision: number;
  tabId: number;
}): ListeningSessionController => {
  let currentIdentity = identity;
  let currentSubtitleRevision = subtitleRevision;
  let disposed = false;
  let disposeRequest: Promise<void> | undefined;
  let endCompleted = false;
  let endRequest: Promise<EndSessionResult> | undefined;
  let fatalReported = false;
  let heartbeatGeneration = 0;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let playRequestGeneration = 0;
  let progressSaved = false;
  let progressRequest: Promise<{ status: 'saved' | 'error' }> | undefined;

  const stopHeartbeat = () => {
    heartbeatGeneration += 1;
    if (heartbeatTimer !== undefined) clearInterval(heartbeatTimer);
    heartbeatTimer = undefined;
  };

  const reportFatal = (reason: ListeningSessionFatalReason) => {
    if (disposed || fatalReported || endCompleted) return;
    fatalReported = true;
    stopHeartbeat();
    onFatal(reason);
  };

  const heartbeat = async (generation: number) => {
    try {
      const response = await sendTabMessage(tabId, 'heartbeatListeningSession', {
        expectedIdentity: currentIdentity,
        expectedSubtitleRevision: currentSubtitleRevision,
        sessionId,
      });
      if (generation !== heartbeatGeneration || endCompleted) return;
      const parsed = response.success
        ? heartbeatListeningSessionResponseSchema.safeParse(response.data)
        : undefined;
      if (!parsed?.success || parsed.data.status === 'error') {
        reportFatal('error');
      } else if (parsed.data.status !== 'alive') {
        reportFatal(parsed.data.status);
      }
    } catch {
      if (generation === heartbeatGeneration && !endCompleted) reportFatal('error');
    }
  };

  const startHeartbeat = () => {
    if (disposed || heartbeatTimer !== undefined || endCompleted) return;
    const generation = ++heartbeatGeneration;
    heartbeatTimer = setInterval(() => void heartbeat(generation), LISTENING_HEARTBEAT_INTERVAL_MS);
  };

  const resumeAfterAdvertisement = async () => {
    if (disposed || endCompleted || fatalReported) return 'stale' as const;
    try {
      const response = await sendTabMessage(
        tabId,
        'resumeListeningSessionAfterAdvertisement',
        {
          expectedIdentity: currentIdentity,
          expectedSubtitleRevision: currentSubtitleRevision,
          sessionId,
        }
      );
      const parsed = response.success
        ? resumeListeningSessionAfterAdvertisementResponseSchema.safeParse(response.data)
        : undefined;
      if (!parsed?.success) return 'error' as const;
      if (parsed.data.status !== 'resumed') return parsed.data.status;
      currentIdentity = parsed.data.identity;
      currentSubtitleRevision = parsed.data.subtitleRevision;
      return 'resumed' as const;
    } catch {
      return 'error' as const;
    }
  };

  const playSegment = async (segmentKey: string, rate: 1 | 0.75): Promise<PlaySegmentResult> => {
    if (disposed || endCompleted || fatalReported) return { status: 'stale' };
    const parsedSegmentKey = listeningSegmentKeySchema.safeParse(segmentKey);
    if (!parsedSegmentKey.success) return { status: 'error' };
    const requestGeneration = ++playRequestGeneration;
    try {
      const response = await sendTabMessage(tabId, 'playListeningSegment', {
        rate,
        segmentKey: parsedSegmentKey.data,
        sessionId,
      });
      if (!response.success) return { status: 'error' };
      const parsed = playListeningSegmentResponseSchema.safeParse(response.data);
      if (!parsed.success) return { status: 'error' };
      if (
        requestGeneration === playRequestGeneration &&
        isTerminalListeningStatus(parsed.data.status)
      ) {
        stopHeartbeat();
      }
      return parsed.data;
    } catch {
      return { status: 'error' };
    }
  };

  const commitProgress = (result: ListeningMissionResult) => {
    if (progressSaved) return Promise.resolve({ status: 'saved' } as const);
    if (progressRequest) return progressRequest;

    const parsedResult = listeningMissionResultSchema.safeParse(result);
    if (!parsedResult.success) return Promise.resolve({ status: 'error' } as const);

    progressRequest = (async () => {
      try {
        const response = await sendRuntimeMessage('recordListeningMissionResult', {
          result: parsedResult.data,
        });
        if (!response.success || !listeningProgressSchema.safeParse(response.data).success) {
          return { status: 'error' } as const;
        }
        progressSaved = true;
        return { status: 'saved' } as const;
      } catch {
        return { status: 'error' } as const;
      } finally {
        progressRequest = undefined;
      }
    })();
    return progressRequest;
  };

  const performEndSession = async (
    mode: 'restore-start' | 'complete-stay' | 'continue-watching',
    restartHeartbeatOnError: boolean
  ): Promise<EndSessionResult> => {
    if (endCompleted) return { status: 'already-ended' };
    playRequestGeneration += 1;
    stopHeartbeat();
    try {
      const response = await sendTabMessage(tabId, 'endListeningSession', { mode, sessionId });
      if (!response.success) {
        if (restartHeartbeatOnError && !disposed) startHeartbeat();
        return { status: 'error' };
      }
      const parsed = endListeningSessionResponseSchema.safeParse(response.data);
      if (!parsed.success) {
        if (restartHeartbeatOnError && !disposed) startHeartbeat();
        return { status: 'error' };
      }
      if (parsed.data.status !== 'error') endCompleted = true;
      else if (restartHeartbeatOnError && !disposed) startHeartbeat();
      return parsed.data;
    } catch {
      if (restartHeartbeatOnError && !disposed) startHeartbeat();
      return { status: 'error' };
    }
  };

  const endSession = (
    mode: 'restore-start' | 'complete-stay' | 'continue-watching'
  ): Promise<EndSessionResult> => {
    if (endCompleted) return Promise.resolve({ status: 'already-ended' });
    if (disposed) return Promise.resolve({ status: 'error' });
    if (endRequest) return endRequest;
    const request = performEndSession(mode, true);
    endRequest = request;
    void request.then(() => {
      if (endRequest === request) endRequest = undefined;
    });
    return request;
  };

  const saveDifficultSegments = async (segmentKeys: string[]): Promise<DifficultSaveResult> => {
    const saved: string[] = [];
    const retryableFailures: DifficultSaveResult['retryableFailures'] = [];

    for (const [index, segmentKey] of segmentKeys.entries()) {
      let status: MessageResult<'saveListeningSegment'>['status'];
      const parsedSegmentKey = listeningSegmentKeySchema.safeParse(segmentKey);
      if (!parsedSegmentKey.success) {
        status = 'error';
      } else if (disposed || endCompleted || fatalReported) {
        status = 'stale';
      } else {
        try {
          const response = await sendTabMessage(tabId, 'saveListeningSegment', {
            segmentKey: parsedSegmentKey.data,
            sessionId,
          });
          const parsed = response.success
            ? saveListeningSegmentResponseSchema.safeParse(response.data)
            : undefined;
          status = parsed?.success ? parsed.data.status : 'error';
        } catch {
          status = 'error';
        }
      }

      if (status === 'saved-learning-only' || status === 'saved-with-support') {
        saved.push(segmentKey);
      } else if (status === 'busy' || status === 'error') {
        retryableFailures.push({ reason: status, segmentKey });
      } else {
        stopHeartbeat();
        return {
          retryableFailures,
          saved,
          terminalFailure: {
            reason: status,
            segmentKey,
            unattempted: segmentKeys.slice(index + 1),
          },
        };
      }
    }

    return { retryableFailures, saved };
  };

  return {
    commitProgress,
    dispose: () => {
      if (disposeRequest) return disposeRequest;
      disposed = true;
      stopHeartbeat();
      const currentEndRequest = endRequest;
      disposeRequest = (async () => {
        if (currentEndRequest) {
          const currentResult = await currentEndRequest;
          if (currentResult.status !== 'error') return;
        }
        if (endCompleted) return;
        const cleanupRequest = performEndSession('restore-start', false);
        endRequest = cleanupRequest;
        try {
          await cleanupRequest;
        } finally {
          if (endRequest === cleanupRequest) endRequest = undefined;
        }
      })();
      return disposeRequest;
    },
    endSession,
    playSegment,
    saveDifficultSegments,
    sessionId,
    resumeAfterAdvertisement,
    startHeartbeat,
    stopHeartbeat,
  };
};

const unwrapRuntime = async <T>(
  request: Promise<TransportResponse<unknown>>,
  schema: z.ZodType<T>
): Promise<T> => {
  const response = await request;
  if (!response.success) throw new Error('Listening progress operation failed');
  const parsed = schema.safeParse(response.data);
  if (!parsed.success) throw new Error('Listening progress operation failed');
  return parsed.data;
};

const contentIdentityEqual = (left: ContentVideoIdentity, right: ContentVideoIdentity) =>
  left.contentInstanceId === right.contentInstanceId &&
  left.routeChangedAt === right.routeChangedAt &&
  left.videoId === right.videoId &&
  left.videoRevision === right.videoRevision;

const sameOrderedValues = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const isTerminalListeningStatus = (
  status: string
): status is ListeningTerminalReason =>
  status === 'stale' || status === 'no-video' || status === 'segment-unavailable';
