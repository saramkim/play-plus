import { updateTabInfo } from '@storage/tab';

import { createConnectionStatus } from './connection-status';
import { registerBackgroundMessageHandler } from './message-handler';
import { createOpenSubtitlesClient } from './opensubtitles-client';
import { createOpenSubtitlesSessionCache } from './opensubtitles-session-cache';
import { registerRuntimeEvents } from './runtime-events';
import {
  createSubtitleRequestHandler,
  registerSubtitleRequestCapture,
} from './subtitle-request';
import { registerTabEvents } from './tab-events';
import { createViewVideoHandler } from './view-video';

const connectionStatus = createConnectionStatus();
const handleViewVideo = createViewVideoHandler();
const sendSubtitleRequest = createSubtitleRequestHandler();
const openSubtitles = createOpenSubtitlesClient({
  apiKey: __OPENSUBTITLES_API_KEY__,
  userAgent: __OPENSUBTITLES_USER_AGENT__,
  cache: createOpenSubtitlesSessionCache(chrome.storage.session),
});

registerRuntimeEvents();
registerBackgroundMessageHandler({
  handleViewVideo,
  searchOpenSubtitles: openSubtitles.search,
  downloadOpenSubtitle: ({ fileId, language }) => openSubtitles.download(fileId, language),
  updateConnectedStatus: connectionStatus.updateConnectedStatus,
  updateTabInfo,
});
registerSubtitleRequestCapture(sendSubtitleRequest);
registerTabEvents({
  checkContentConnection: connectionStatus.checkContentConnection,
  sendSubtitleRequest,
});
