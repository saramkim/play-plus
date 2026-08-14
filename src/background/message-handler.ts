import { z } from 'zod';

import type { V2LearningCardStorageApi } from '@storage/v2/learning-card-storage';
import {
  listeningMissionResultSchema,
  type V2ListeningProgressStorageApi,
} from '@storage/v2/listening-progress-storage';
import { listeningVideoIdSchema } from '@storage/v2/schema';
import { onMessage } from '@utils/message';
import type { ContentBootstrap, MessageSchema, V2ReadinessStatus } from '@utils/message/type';
import {
  playbackContextStatusSchema,
  selectPlaybackContextStatus,
  type PlaybackContextStatus,
} from '@utils/playback-context';

import { respondToAsyncMessage } from './async-message-response';
import { getOpenSubtitlesErrorDetails } from './opensubtitles-client';

type BackgroundMessageHandlerDependencies = {
  awaitReady: () => Promise<void>;
  getReadiness: () => Promise<V2ReadinessStatus>;
  retryReadiness: () => Promise<V2ReadinessStatus>;
  getContentBootstrap: (tabId: number) => Promise<ContentBootstrap>;
  getPlaybackContext?: (tabId: number) => Promise<PlaybackContextStatus | null>;
  searchOpenSubtitles: (
    params: MessageSchema['searchOpenSubtitles']['params']
  ) => Promise<MessageSchema['searchOpenSubtitles']['response']>;
  downloadOpenSubtitle: (
    params: MessageSchema['downloadOpenSubtitle']['params']
  ) => Promise<MessageSchema['downloadOpenSubtitle']['response']>;
  handleViewVideo: (params: MessageSchema['viewVideo']['params']) => Promise<void>;
  handleSubtitleContentStatus: (
    tabId: number,
    status: MessageSchema['contentStatus']['params'] & { documentId: string | null }
  ) => Promise<void>;
  learningCards: V2LearningCardStorageApi;
  listeningProgress: V2ListeningProgressStorageApi;
  updateConnectedStatus: (
    tabId: number,
    status: MessageSchema['contentStatus']['params'] & { documentId: string | null }
  ) => Promise<boolean>;
};

const CARD_OPERATION_ERROR = 'Unable to access the learning library';
const LISTENING_PROGRESS_OPERATION_ERROR = 'Unable to access listening progress';
const BACKGROUND_OPERATION_ERROR = 'Unable to complete the Play Plus action';
const noMessageParamsSchema = z.undefined();
const recordListeningMissionResultParamsSchema = z
  .object({ result: listeningMissionResultSchema })
  .strict();
const clearListeningVideoProgressParamsSchema = z
  .object({ videoId: listeningVideoIdSchema })
  .strict();

export const registerBackgroundMessageHandler = (
  dependencies: BackgroundMessageHandlerDependencies
) => {
  const contentStatusTails = new Map<number, Promise<void>>();

  const enqueueContentStatus = (tabId: number, task: () => Promise<void>) => {
    const operation = (contentStatusTails.get(tabId) ?? Promise.resolve()).then(task);
    const tail = operation.then(
      () => undefined,
      () => undefined
    );
    contentStatusTails.set(tabId, tail);
    void tail.then(() => {
      if (contentStatusTails.get(tabId) === tail) contentStatusTails.delete(tabId);
    });
    return operation;
  };

  return onMessage((request) => {
    switch (request.message) {
      case 'getV2Readiness':
        return respondToAsyncMessage(request.sendResponse, dependencies.getReadiness);
      case 'retryV2Readiness':
        return respondToAsyncMessage(request.sendResponse, dependencies.retryReadiness);
      case 'contentInitialized': {
        return respondToAsyncMessage(request.sendResponse, () =>
          runBackgroundOperation(async () => {
            await dependencies.awaitReady();
            const tabId = request.sender.tab?.id;
            if (tabId === undefined) throw new Error('Content initialization is unavailable');
            return dependencies.getContentBootstrap(tabId);
          })
        );
      }
      case 'viewVideo': {
        return respondToAsyncMessage(request.sendResponse, () =>
          runBackgroundOperation(async () => {
            await dependencies.awaitReady();
            await dependencies.handleViewVideo(request.params);
          })
        );
      }
      case 'contentStatus': {
        const tabId = request.sender.tab?.id;
        if (tabId === undefined) {
          return respondToAsyncMessage(request.sendResponse, () =>
            runBackgroundOperation(async () => {
              await dependencies.awaitReady();
              throw new Error('Content status is unavailable');
            })
          );
        }

        return respondToAsyncMessage(request.sendResponse, () =>
          enqueueContentStatus(tabId, () =>
            runBackgroundOperation(async () => {
              await dependencies.awaitReady();
              const playbackContext = playbackContextStatusSchema.safeParse(
                selectPlaybackContextStatus(request.params)
              );
              if (
                !playbackContext.success ||
                typeof request.params.hasVideo !== 'boolean' ||
                typeof request.params.isVideoUrl !== 'boolean'
              ) {
                throw new Error('Invalid content status');
              }
              const status = {
                ...playbackContext.data,
                documentId: request.sender.documentId ?? null,
                hasVideo: request.params.hasVideo,
                isVideoUrl: request.params.isVideoUrl,
              };
              if (await dependencies.updateConnectedStatus(tabId, status)) {
                await dependencies.handleSubtitleContentStatus(tabId, status);
              }
            })
          )
        );
      }
      case 'getPlaybackContext':
        return respondToAsyncMessage(request.sendResponse, () =>
          runBackgroundOperation(async () => {
            await dependencies.awaitReady();
            const tabId = z.number().int().nonnegative().parse(request.params.tabId);
            return dependencies.getPlaybackContext?.(tabId) ?? null;
          })
        );
      case 'searchOpenSubtitles':
        return respondToAsyncMessage(
          request.sendResponse,
          async () => {
            await dependencies.awaitReady();
            return dependencies.searchOpenSubtitles(request.params);
          },
          getOpenSubtitlesErrorDetails
        );
      case 'downloadOpenSubtitle':
        return respondToAsyncMessage(
          request.sendResponse,
          async () => {
            await dependencies.awaitReady();
            return dependencies.downloadOpenSubtitle(request.params);
          },
          getOpenSubtitlesErrorDetails
        );
      case 'getLearningCards':
        return respondToAsyncMessage(request.sendResponse, () =>
          runCardOperation(dependencies, () => dependencies.learningCards.get())
        );
      case 'addLearningCard':
        return respondToAsyncMessage(request.sendResponse, () =>
          runCardOperation(dependencies, () => dependencies.learningCards.add(request.params.card))
        );
      case 'updateLearningCard':
        return respondToAsyncMessage(request.sendResponse, () =>
          runCardOperation(dependencies, () =>
            dependencies.learningCards.update(request.params.id, request.params.card)
          )
        );
      case 'deleteLearningCard':
        return respondToAsyncMessage(request.sendResponse, () =>
          runCardOperation(dependencies, () => dependencies.learningCards.delete(request.params.id))
        );
      case 'restoreLearningCard':
        return respondToAsyncMessage(request.sendResponse, () =>
          runCardOperation(dependencies, () => dependencies.learningCards.restore(request.params.deleted))
        );
      case 'getListeningProgress':
        return respondToAsyncMessage(request.sendResponse, () =>
          runListeningProgressOperation(dependencies, () => {
            noMessageParamsSchema.parse(request.params);
            return dependencies.listeningProgress.get();
          })
        );
      case 'recordListeningMissionResult':
        return respondToAsyncMessage(request.sendResponse, () =>
          runListeningProgressOperation(dependencies, () => {
            const { result } = recordListeningMissionResultParamsSchema.parse(request.params);
            return dependencies.listeningProgress.recordMissionResult(result);
          })
        );
      case 'clearListeningVideoProgress':
        return respondToAsyncMessage(request.sendResponse, () =>
          runListeningProgressOperation(dependencies, () => {
            const { videoId } = clearListeningVideoProgressParamsSchema.parse(request.params);
            return dependencies.listeningProgress.clearVideo(videoId);
          })
        );
      case 'clearAllListeningProgress':
        return respondToAsyncMessage(request.sendResponse, () =>
          runListeningProgressOperation(dependencies, () => {
            noMessageParamsSchema.parse(request.params);
            return dependencies.listeningProgress.clearAll();
          })
        );
    }
  });
};

const runCardOperation = async <T>(
  dependencies: Pick<BackgroundMessageHandlerDependencies, 'awaitReady'>,
  operation: () => Promise<T>
) => {
  await dependencies.awaitReady();
  try {
    return await operation();
  } catch {
    throw new Error(CARD_OPERATION_ERROR);
  }
};

const runBackgroundOperation = async <T>(operation: () => Promise<T>) => {
  try {
    return await operation();
  } catch {
    throw new Error(BACKGROUND_OPERATION_ERROR);
  }
};

const runListeningProgressOperation = async <T>(
  dependencies: Pick<BackgroundMessageHandlerDependencies, 'awaitReady'>,
  operation: () => Promise<T>
) => {
  try {
    await dependencies.awaitReady();
    return await operation();
  } catch {
    throw new Error(LISTENING_PROGRESS_OPERATION_ERROR);
  }
};
