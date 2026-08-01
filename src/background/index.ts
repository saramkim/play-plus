import { updateTabInfo } from '@storage/tab';

import { createConnectionStatus } from './connection-status';
import { registerBackgroundMessageHandler } from './message-handler';
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

registerRuntimeEvents();
registerBackgroundMessageHandler({
  handleViewVideo,
  updateConnectedStatus: connectionStatus.updateConnectedStatus,
  updateTabInfo,
});
registerSubtitleRequestCapture(sendSubtitleRequest);
registerTabEvents({
  checkContentConnection: connectionStatus.checkContentConnection,
  sendSubtitleRequest,
});
