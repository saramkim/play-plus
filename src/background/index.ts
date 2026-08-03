import { getRegisteredSubtitles } from '@storage/registered-subtitle';
import { getTabInfo, updateTabInfo } from '@storage/tab';
import { runV2Migration } from '@storage/v2/chrome-storage-adapter';
import { createV2LearningCardStorage } from '@storage/v2/learning-card-storage';
import { createV2SyncStorage } from '@storage/v2/sync-storage';

import { createConnectionStatus } from './connection-status';
import { registerBackgroundMessageHandler } from './message-handler';
import { registerRuntimeEvents } from './runtime-events';
import {
  createSubtitleRequestHandler,
  registerSubtitleRequestCapture,
} from './subtitle-request';
import { reconcileTabSubtitleRoles } from './subtitle-role-reconciliation';
import { registerTabEvents } from './tab-events';
import { createV2ReadinessController } from './v2-readiness';
import { createViewVideoHandler } from './view-video';

const readiness = createV2ReadinessController(() => runV2Migration(chrome.storage));
const awaitReady = async () => {
  const status = await readiness.wait();
  if (status.status !== 'ready') throw new Error('Play Plus data is unavailable');
};
const connectionStatus = createConnectionStatus();
const handleViewVideo = createViewVideoHandler();
const learningCards = createV2LearningCardStorage(chrome.storage.local);
const syncStorage = createV2SyncStorage(chrome.storage.sync);
const deliverSubtitleRequest = createSubtitleRequestHandler();
const sendSubtitleRequest: typeof deliverSubtitleRequest = async (tabId, request) => {
  await awaitReady();
  await deliverSubtitleRequest(tabId, request);
};

registerRuntimeEvents();
registerBackgroundMessageHandler({
  awaitReady,
  getReadiness: readiness.wait,
  retryReadiness: readiness.retry,
  getContentBootstrap: (tabId) =>
    reconcileTabSubtitleRoles(tabId, {
      getLearningProfile: () => syncStorage.get('learningProfile'),
      getRegisteredSubtitles,
      getTabInfo,
      updateTabInfo,
    }),
  handleViewVideo,
  learningCards,
  updateConnectedStatus: connectionStatus.updateConnectedStatus,
});
registerSubtitleRequestCapture(sendSubtitleRequest);
registerTabEvents({
  awaitReady,
  checkContentConnection: connectionStatus.checkContentConnection,
  sendSubtitleRequest,
});
