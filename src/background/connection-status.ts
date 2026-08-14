import { updateTabInfo } from '@storage/tab';
import { getCoupangPlayVideoId } from '@utils/coupang-play';
import { MessageResponse, sendMessageToTab } from '@utils/message';
import type { MessageSchema } from '@utils/message/type';
import type { PlaybackContextStatus } from '@utils/playback-context';

type ConnectionStatusDependencies = {
  getCurrentVideoId: (tabId: number) => Promise<string | null>;
  handleSubtitleContentStatus: (
    tabId: number,
    status: MessageSchema['contentStatus']['params'] & { documentId: string | null }
  ) => Promise<void>;
  publishPlaybackContext: (tabId: number, status: PlaybackContextStatus | null) => Promise<void>;
  pingContent: (tabId: number) => Promise<MessageResponse<'pingContent'>>;
  updateTabInfo: typeof updateTabInfo;
};

type ConnectedContentStatus = Parameters<
  ConnectionStatusDependencies['handleSubtitleContentStatus']
>[1];

const defaultDependencies: ConnectionStatusDependencies = {
  getCurrentVideoId: async (tabId) => getCoupangPlayVideoId((await chrome.tabs.get(tabId)).url),
  handleSubtitleContentStatus: async () => {},
  pingContent: (tabId) => sendMessageToTab(tabId, 'pingContent'),
  publishPlaybackContext: async () => {},
  updateTabInfo,
};

export const createConnectionStatus = (
  overrides: Partial<ConnectionStatusDependencies> = {}
) => {
  const dependencies: ConnectionStatusDependencies = { ...defaultDependencies, ...overrides };
  const latestStatuses = new Map<number, ConnectedContentStatus>();
  const statusQueues = new Map<number, Promise<void>>();

  const enqueueStatus = <T>(tabId: number, operation: () => Promise<T>) => {
    const previous = statusQueues.get(tabId) ?? Promise.resolve();
    const result = previous.catch(() => undefined).then(operation);
    const tail = result.then(
      () => undefined,
      () => undefined
    );
    statusQueues.set(tabId, tail);
    void tail.then(() => {
      if (statusQueues.get(tabId) === tail) statusQueues.delete(tabId);
    });
    return result;
  };

  const restoreCurrentRouteStatus = async (tabId: number, videoId: string | null) => {
    await dependencies.updateTabInfo(tabId, {
      connectionStatus: 'connecting',
      videoStatus: videoId === null ? 'idle' : 'detecting',
    });
  };

  const updateConnectedStatus = (tabId: number, status: ConnectedContentStatus) =>
    enqueueStatus(tabId, async () => {
      const currentVideoId = await dependencies.getCurrentVideoId(tabId);
      if (currentVideoId !== status.videoId) return false;

      const latest = latestStatuses.get(tabId);
      if (
        latest &&
        (status.routeChangedAt < latest.routeChangedAt ||
          (status.routeChangedAt === latest.routeChangedAt &&
            status.contentInstanceId === latest.contentInstanceId &&
            (status.contentEpoch < latest.contentEpoch ||
              (status.contentEpoch === latest.contentEpoch &&
                status.videoRevision < latest.videoRevision))))
      ) {
        return false;
      }

      latestStatuses.set(tabId, status);
      await dependencies.updateTabInfo(tabId, {
        connectionStatus: 'connected',
        videoStatus: status.isVideoUrl
          ? status.hasVideo
            ? 'detected'
            : 'not_detected'
          : 'idle',
      });
      await dependencies.publishPlaybackContext(tabId, status);

      const verifiedVideoId = await dependencies.getCurrentVideoId(tabId);
      if (verifiedVideoId === status.videoId) return true;
      await restoreCurrentRouteStatus(tabId, verifiedVideoId);
      return false;
    });

  const updateNavigatingStatus = (
    tabId: number,
    isVideoUrl: boolean,
    expectedVideoId: string | null
  ) =>
    enqueueStatus(tabId, async () => {
      if ((await dependencies.getCurrentVideoId(tabId)) !== expectedVideoId) return;

      const latest = latestStatuses.get(tabId);
      if (latest?.videoId === expectedVideoId && latest.isVideoUrl === isVideoUrl) return;

      latestStatuses.delete(tabId);
      await dependencies.updateTabInfo(tabId, {
        connectionStatus: 'connecting',
        videoStatus: isVideoUrl ? 'detecting' : 'idle',
      });
    });

  const updateDisconnectedStatus = (
    tabId: number,
    isVideoUrl: boolean,
    expectedVideoId: string | null
  ) => enqueueStatus(tabId, async () => {
    if ((await dependencies.getCurrentVideoId(tabId)) !== expectedVideoId) return;
    latestStatuses.delete(tabId);
    await dependencies.updateTabInfo(tabId, {
      connectionStatus: 'disconnected',
      videoStatus: isVideoUrl ? 'not_detected' : 'idle',
    });
    await dependencies.publishPlaybackContext(tabId, null);
    const verifiedVideoId = await dependencies.getCurrentVideoId(tabId);
    if (verifiedVideoId !== expectedVideoId) {
      await restoreCurrentRouteStatus(tabId, verifiedVideoId);
    }
  });

  const checkContentConnection = async (tabId: number, _isVideoUrl: boolean) => {
    const expectedVideoId = await dependencies.getCurrentVideoId(tabId);
    const expectedIsVideoUrl = expectedVideoId !== null;
    let response: MessageResponse<'pingContent'>;
    try {
      response = await dependencies.pingContent(tabId);
    } catch {
      await updateDisconnectedStatus(tabId, expectedIsVideoUrl, expectedVideoId);
      return;
    }

    if (response.success) {
      const status = {
        ...response.data,
        documentId: null,
        isVideoUrl: response.data.videoId !== null,
      };
      if (await updateConnectedStatus(tabId, status)) {
        await dependencies.handleSubtitleContentStatus(tabId, status);
      }
    } else {
      await updateDisconnectedStatus(tabId, expectedIsVideoUrl, expectedVideoId);
    }
  };

  return { checkContentConnection, updateConnectedStatus, updateNavigatingStatus };
};
