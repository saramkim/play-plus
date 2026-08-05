import { getRegisteredSubtitles } from '@storage/registered-subtitle';
import { getTabInfo, updateTabInfo } from '@storage/tab';
import { runV2Migration } from '@storage/v2/chrome-storage-adapter';
import { createV2LearningCardStorage } from '@storage/v2/learning-card-storage';
import { createV2SyncStorage } from '@storage/v2/sync-storage';
import { sendMessageToTab } from '@utils/message';

import { createConnectionStatus } from './connection-status';
import { registerBackgroundMessageHandler } from './message-handler';
import {
  clearSubtitleReplayRequest,
  getSubtitleReplayRequest,
  saveSubtitleReplayRequest,
} from './pending-actions';
import { registerRuntimeEvents } from './runtime-events';
import {
  createSubtitleRequestReplayController,
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
const handleViewVideo = createViewVideoHandler();
const learningCards = createV2LearningCardStorage(chrome.storage.local);
const syncStorage = createV2SyncStorage(chrome.storage.sync);
const subtitleRequests = createSubtitleRequestReplayController({
  clearReplay: clearSubtitleReplayRequest,
  deliver: (tabId, request) => sendMessageToTab(tabId, 'fetchVideoMetadata', request),
  getReplay: getSubtitleReplayRequest,
  pingContent: (tabId) => sendMessageToTab(tabId, 'pingContent'),
  saveReplay: saveSubtitleReplayRequest,
});
const connectionStatus = createConnectionStatus({
  handleSubtitleContentStatus: subtitleRequests.handleContentStatus,
});

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
  handleSubtitleContentStatus: subtitleRequests.handleContentStatus,
  learningCards,
  updateConnectedStatus: connectionStatus.updateConnectedStatus,
});
registerSubtitleRequestCapture(subtitleRequests.capture);
registerTabEvents({
  awaitReady,
  checkContentConnection: connectionStatus.checkContentConnection,
  clearSubtitleReplay: subtitleRequests.clear,
  handleSubtitleNavigation: subtitleRequests.handleNavigation,
  updateNavigatingStatus: connectionStatus.updateNavigatingStatus,
});
