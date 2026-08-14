import { getRegisteredSubtitles } from '@storage/registered-subtitle';
import { getTabInfo, updateTabInfo } from '@storage/tab';
import { runV2Migration } from '@storage/v2/chrome-storage-adapter';
import { createV2LearningCardStorage } from '@storage/v2/learning-card-storage';
import { createV2ListeningProgressStorage } from '@storage/v2/listening-progress-storage';
import { createV2SyncStorage } from '@storage/v2/sync-storage';
import { sendMessage, sendMessageToTab } from '@utils/message';
import {
  playbackContextStatusSchema,
  selectPlaybackContextStatus,
} from '@utils/playback-context';

import { createConnectionStatus } from './connection-status';
import { registerBackgroundMessageHandler } from './message-handler';
import { createOpenSubtitlesClient } from './opensubtitles-client';
import { createOpenSubtitlesSessionCache } from './opensubtitles-session-cache';
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
const listeningProgress = createV2ListeningProgressStorage(chrome.storage.local);
const openSubtitles = createOpenSubtitlesClient({
  apiKey: __OPENSUBTITLES_API_KEY__,
  userAgent: __OPENSUBTITLES_USER_AGENT__,
  cache: createOpenSubtitlesSessionCache(chrome.storage.session),
});
const syncStorage = createV2SyncStorage(chrome.storage.sync);
const subtitleRequests = createSubtitleRequestReplayController({
  clearReplay: clearSubtitleReplayRequest,
  deliver: (tabId, request) => sendMessageToTab(tabId, 'fetchVideoMetadata', request),
  getReplay: getSubtitleReplayRequest,
  pingContent: (tabId) => sendMessageToTab(tabId, 'pingContent'),
  saveReplay: saveSubtitleReplayRequest,
});
const publishPlaybackContext = async (
  tabId: number,
  status: Parameters<typeof selectPlaybackContextStatus>[0] | null
) => {
  try {
    await sendMessage('playbackContextChanged', {
      status: status === null ? null : selectPlaybackContextStatus(status),
      tabId,
    });
  } catch {
    // The transient relay has no receiver while the Side Panel is closed.
  }
};
const connectionStatus = createConnectionStatus({
  handleSubtitleContentStatus: subtitleRequests.handleContentStatus,
  publishPlaybackContext,
});

registerRuntimeEvents();
registerBackgroundMessageHandler({
  awaitReady,
  downloadOpenSubtitle: ({ fileId, language }) => openSubtitles.download(fileId, language),
  getReadiness: readiness.wait,
  getPlaybackContext: async (tabId) => {
    const response = await sendMessageToTab(tabId, 'pingContent');
    if (!response.success) return null;
    const parsed = playbackContextStatusSchema.safeParse(
      selectPlaybackContextStatus(response.data)
    );
    return parsed.success ? parsed.data : null;
  },
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
  listeningProgress,
  searchOpenSubtitles: openSubtitles.search,
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
