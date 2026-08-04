import type { PendingSubtitleRequest } from '@storage/session-type';
import { COUPANG_PLAY_SUBTITLE_API_URL } from '@utils/constants';
import { sendMessageToTab } from '@utils/message';

import { savePendingSubtitleRequest } from './pending-actions';

type SubtitleRequestDependencies = {
  deliver: (tabId: number, payload: PendingSubtitleRequest) => Promise<void>;
  savePending: typeof savePendingSubtitleRequest;
};

const defaultDependencies: SubtitleRequestDependencies = {
  deliver: async (tabId, payload) => {
    await sendMessageToTab(tabId, 'fetchVideoMetadata', payload);
  },
  savePending: savePendingSubtitleRequest,
};

export const createSubtitleRequestHandler = (dependencies = defaultDependencies) =>
  async (tabId: number, payload: PendingSubtitleRequest) => {
    try {
      await dependencies.deliver(tabId, payload);
    } catch {
      await dependencies.savePending(tabId, payload);
    }
  };

export const registerSubtitleRequestCapture = (
  sendSubtitleRequest: ReturnType<typeof createSubtitleRequestHandler>
) => {
  chrome.webRequest.onSendHeaders.addListener(
    ({ tabId, url, requestHeaders }) => {
      const hasCustomHeader = requestHeaders?.some((header) => header.name === 'X-Extension-Request');
      if (hasCustomHeader || tabId < 0) return;

      void sendSubtitleRequest(tabId, { url, headers: requestHeaders ?? [] }).catch(() =>
        console.error('Unable to preserve a subtitle request')
      );
    },
    { urls: [`${COUPANG_PLAY_SUBTITLE_API_URL}?*`] },
    ['requestHeaders']
  );
};
