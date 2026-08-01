import { updateTabInfo } from '@storage/tab';
import { onMessage } from '@utils/message';
import { MessageSchema } from '@utils/message/type';

import { respondToAsyncMessage } from './async-message-response';
import { getOpenSubtitlesErrorDetails } from './opensubtitles-client';

type BackgroundMessageHandlerDependencies = {
  handleViewVideo: (params: MessageSchema['viewVideo']['params']) => Promise<void>;
  searchOpenSubtitles: (
    params: MessageSchema['searchOpenSubtitles']['params']
  ) => Promise<MessageSchema['searchOpenSubtitles']['response']>;
  downloadOpenSubtitle: (
    params: MessageSchema['downloadOpenSubtitle']['params']
  ) => Promise<MessageSchema['downloadOpenSubtitle']['response']>;
  updateConnectedStatus: (tabId: number, isVideoUrl: boolean, hasVideo: boolean) => Promise<void>;
  updateTabInfo: typeof updateTabInfo;
};

export const registerBackgroundMessageHandler = (
  dependencies: BackgroundMessageHandlerDependencies
) =>
  onMessage((request) => {
    switch (request.message) {
      case 'contentInitialized': {
        return respondToAsyncMessage(request.sendResponse, async () => {
          const tabId = request.sender.tab?.id;
          if (tabId === undefined) throw new Error('Missing sender tab id');
          await dependencies.updateTabInfo(tabId, {
            primarySubtitle: null,
            secondarySubtitle: null,
          });
        });
      }
      case 'viewVideo': {
        return respondToAsyncMessage(request.sendResponse, () =>
          dependencies.handleViewVideo(request.params)
        );
      }
      case 'updateSubtitles': {
        return respondToAsyncMessage(request.sendResponse, async () => {
          const tabId = request.sender.tab?.id;
          if (tabId === undefined) throw new Error('Missing sender tab id');
          const { lang, subtitleData } = request.params;
          await dependencies.updateTabInfo(tabId, { [lang]: subtitleData });
        });
      }
      case 'contentStatus': {
        return respondToAsyncMessage(request.sendResponse, async () => {
          const tabId = request.sender.tab?.id;
          if (tabId === undefined) throw new Error('Missing sender tab id');
          const { hasVideo, isVideoUrl } = request.params;
          await dependencies.updateConnectedStatus(tabId, isVideoUrl, hasVideo);
        });
      }
      case 'searchOpenSubtitles': {
        return respondToAsyncMessage(
          request.sendResponse,
          () => dependencies.searchOpenSubtitles(request.params),
          getOpenSubtitlesErrorDetails
        );
      }
      case 'downloadOpenSubtitle': {
        return respondToAsyncMessage(
          request.sendResponse,
          () => dependencies.downloadOpenSubtitle(request.params),
          getOpenSubtitlesErrorDetails
        );
      }
    }
  });
