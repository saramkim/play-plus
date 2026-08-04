import type { V2LearningCardStorageApi } from '@storage/v2/learning-card-storage';
import { onMessage } from '@utils/message';
import type { ContentBootstrap, MessageSchema, V2ReadinessStatus } from '@utils/message/type';

import { respondToAsyncMessage } from './async-message-response';

type BackgroundMessageHandlerDependencies = {
  awaitReady: () => Promise<void>;
  getReadiness: () => Promise<V2ReadinessStatus>;
  retryReadiness: () => Promise<V2ReadinessStatus>;
  getContentBootstrap: (tabId: number) => Promise<ContentBootstrap>;
  handleViewVideo: (params: MessageSchema['viewVideo']['params']) => Promise<void>;
  learningCards: V2LearningCardStorageApi;
  updateConnectedStatus: (tabId: number, isVideoUrl: boolean, hasVideo: boolean) => Promise<void>;
};

const CARD_OPERATION_ERROR = 'Unable to access the learning library';
const BACKGROUND_OPERATION_ERROR = 'Unable to complete the Play Plus action';

export const registerBackgroundMessageHandler = (
  dependencies: BackgroundMessageHandlerDependencies
) =>
  onMessage((request) => {
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
        return respondToAsyncMessage(request.sendResponse, () =>
          runBackgroundOperation(async () => {
            await dependencies.awaitReady();
            const tabId = request.sender.tab?.id;
            if (tabId === undefined) throw new Error('Content status is unavailable');
            const { hasVideo, isVideoUrl } = request.params;
            await dependencies.updateConnectedStatus(tabId, isVideoUrl, hasVideo);
          })
        );
      }
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
    }
  });

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
