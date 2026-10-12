import { getCoupangPlayVideoId } from '@utils/coupang-play';
import { sendMessageToTab } from '@utils/message';
import { MessageSchema } from '@utils/message/type';

type ViewVideoTab = Pick<chrome.tabs.Tab, 'active' | 'id' | 'status' | 'url'>;

export type ViewVideoDependencies = {
  activateTab: (tabId: number) => Promise<void>;
  createTab: (url: string) => Promise<number>;
  getVideoId: typeof getCoupangPlayVideoId;
  playVideo: (tabId: number, startTime: number, videoId: string) => Promise<void>;
  waitForTab: (tabId: number, videoId: string) => Promise<void>;
  queryTabs: () => Promise<ViewVideoTab[]>;
};

const defaultDependencies: ViewVideoDependencies = {
  activateTab: async (tabId) => {
    await chrome.tabs.update(tabId, { active: true });
  },
  createTab: async (url) => {
    const tab = await chrome.tabs.create({ url });
    if (tab.id === undefined) throw new Error('Original scene unavailable');
    return tab.id;
  },
  getVideoId: getCoupangPlayVideoId,
  playVideo: playOriginalScene,
  waitForTab: waitForOriginalScene,
  queryTabs: () => chrome.tabs.query({}),
};

export async function playOriginalScene(tabId: number, startTime: number, expectedVideoId: string) {
    const ping = await sendMessageToTab(tabId, 'pingContent');
    if (!ping.success || ping.data.videoId !== expectedVideoId || ping.data.lifecycle !== 'content' || !['movie', 'episode'].includes(ping.data.routeKind)) throw new Error('Playback unavailable');
    const {
      contentEpoch,
      contentInstanceId,
      routeChangedAt,
      subtitleIdentity,
      videoId,
      videoRevision,
    } = ping.data;
    const response = await sendMessageToTab(tabId, 'playVideo', {
      expectedIdentity: {
        contentEpoch,
        contentInstanceId,
        routeChangedAt,
        videoId,
        videoRevision,
      },
      expectedSubtitleRevision: subtitleIdentity.subtitleRevision,
      startTime,
      purpose: 'original-scene',
    });
    if (!response.success || response.data.status !== 'played') throw new Error('Playback unavailable');
}

export const createViewVideoHandler = (dependencies = defaultDependencies) =>
  async ({ url, startTime }: MessageSchema['viewVideo']['params']) => {
    const videoId = dependencies.getVideoId(url);
    if (!videoId || !Number.isFinite(startTime) || startTime < 0) {
      throw new Error('Original scene unavailable');
    }
    const tabs = await dependencies.queryTabs();
    const matchingTabs = tabs.filter((tab) =>
      videoId ? dependencies.getVideoId(tab.url) === videoId : tab.url === url
    );
    const matchingTab = matchingTabs.find((tab) => tab.active) ?? matchingTabs[0];

    const tabId = matchingTab?.id ?? await dependencies.createTab(url);
    if (matchingTab?.id !== undefined) await dependencies.activateTab(tabId);
    await dependencies.waitForTab(tabId, videoId);
    await dependencies.playVideo(tabId, startTime, videoId);
  };

export async function waitForOriginalScene(tabId: number, videoId: string) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const tab = await chrome.tabs.get(tabId);
      if (getCoupangPlayVideoId(tab.pendingUrl ?? tab.url) !== videoId) throw new Error('Original scene changed');
      if (tab.status === 'complete') {
        try {
          const ping = await sendMessageToTab(tabId, 'pingContent');
          if (ping.success && ping.data.videoId === videoId && ping.data.hasVideo && ping.data.lifecycle === 'content' &&
            ['movie', 'episode'].includes(ping.data.routeKind)) return;
        } catch {
          // The content script may still be attaching. Only readiness is retried.
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('Original scene is still loading');
}
