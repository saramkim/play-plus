import { getCoupangPlayVideoId } from '@utils/coupang-play';
import { sendMessageToTab } from '@utils/message';
import { MessageSchema } from '@utils/message/type';

import { enqueueViewAction } from './pending-actions';

type ViewVideoTab = Pick<chrome.tabs.Tab, 'active' | 'id' | 'status' | 'url'>;

export type ViewVideoDependencies = {
  activateTab: (tabId: number) => Promise<void>;
  createTab: (url: string) => Promise<void>;
  enqueueViewAction: typeof enqueueViewAction;
  getVideoId: typeof getCoupangPlayVideoId;
  playVideo: (tabId: number, startTime: number) => Promise<void>;
  queryTabs: () => Promise<ViewVideoTab[]>;
};

const defaultDependencies: ViewVideoDependencies = {
  activateTab: async (tabId) => {
    await chrome.tabs.update(tabId, { active: true });
  },
  createTab: async (url) => {
    await chrome.tabs.create({ url });
  },
  enqueueViewAction,
  getVideoId: getCoupangPlayVideoId,
  playVideo: async (tabId, startTime) => {
    const ping = await sendMessageToTab(tabId, 'pingContent');
    if (!ping.success || !ping.data.learningAvailable) return;
    const {
      contentEpoch,
      contentInstanceId,
      routeChangedAt,
      subtitleIdentity,
      videoId,
      videoRevision,
    } = ping.data;
    await sendMessageToTab(tabId, 'playVideo', {
      expectedIdentity: {
        contentEpoch,
        contentInstanceId,
        routeChangedAt,
        videoId,
        videoRevision,
      },
      expectedSubtitleRevision: subtitleIdentity.subtitleRevision,
      startTime,
    });
  },
  queryTabs: () => chrome.tabs.query({}),
};

export const createViewVideoHandler = (dependencies = defaultDependencies) =>
  async ({ url, startTime }: MessageSchema['viewVideo']['params']) => {
    const tabs = await dependencies.queryTabs();
    const videoId = dependencies.getVideoId(url);
    const matchingTabs = tabs.filter((tab) =>
      videoId ? dependencies.getVideoId(tab.url) === videoId : tab.url === url
    );
    const matchingTab = matchingTabs.find((tab) => tab.active) ?? matchingTabs[0];

    if (matchingTab?.id !== undefined) {
      await dependencies.activateTab(matchingTab.id);
      if (matchingTab.status === 'complete') {
        await dependencies.playVideo(matchingTab.id, startTime);
      } else {
        await dependencies.enqueueViewAction({ url, startTime, videoId });
      }
      return;
    }

    await dependencies.createTab(url);
    await dependencies.enqueueViewAction({ url, startTime, videoId });
  };
