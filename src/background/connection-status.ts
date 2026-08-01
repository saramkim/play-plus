import { updateTabInfo } from '@storage/tab';
import { MessageResponse, sendMessageToTab } from '@utils/message';

type ConnectionStatusDependencies = {
  pingContent: (tabId: number) => Promise<MessageResponse<'pingContent'>>;
  updateTabInfo: typeof updateTabInfo;
};

const defaultDependencies: ConnectionStatusDependencies = {
  pingContent: (tabId) => sendMessageToTab(tabId, 'pingContent'),
  updateTabInfo,
};

export const createConnectionStatus = (dependencies = defaultDependencies) => {
  const updateConnectedStatus = async (tabId: number, isVideoUrl: boolean, hasVideo: boolean) => {
    await dependencies.updateTabInfo(tabId, {
      connectionStatus: 'connected',
      videoStatus: isVideoUrl ? (hasVideo ? 'detected' : 'not_detected') : 'idle',
    });
  };

  const updateDisconnectedStatus = async (tabId: number, isVideoUrl: boolean) => {
    await dependencies.updateTabInfo(tabId, {
      connectionStatus: 'disconnected',
      videoStatus: isVideoUrl ? 'not_detected' : 'idle',
    });
  };

  const checkContentConnection = async (tabId: number, isVideoUrl: boolean) => {
    let response: MessageResponse<'pingContent'>;
    try {
      response = await dependencies.pingContent(tabId);
    } catch {
      await updateDisconnectedStatus(tabId, isVideoUrl);
      return;
    }

    if (response.success) {
      await updateConnectedStatus(tabId, isVideoUrl, response.data.hasVideo);
    } else {
      await updateDisconnectedStatus(tabId, isVideoUrl);
    }
  };

  return { checkContentConnection, updateConnectedStatus };
};
