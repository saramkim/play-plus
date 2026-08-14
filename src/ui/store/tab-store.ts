import { getSessionStorage, onSessionStorageChange } from '@storage/session';
import { TabInfo, getTabInfo, onTabInfoChange } from '@storage/tab';
import { onMessage, sendMessage } from '@utils/message';
import type { PlaybackContextStatus } from '@utils/playback-context';
import { playbackContextStatusSchema } from '@utils/playback-context';
import { create } from 'zustand';
import { combine } from 'zustand/middleware';

export type TabStoreDependencies = {
  getActiveTab: () => Promise<chrome.tabs.Tab | undefined>;
  getTabInfo: typeof getTabInfo;
  getPlaybackContext?: (tabId: number) => Promise<PlaybackContextStatus | null>;
  onActiveTabChange: typeof onSessionStorageChange;
  onTabInfoChange: typeof onTabInfoChange;
  onPlaybackContextChange?: (
    callback: (tabId: number, status: PlaybackContextStatus | null) => void
  ) => { remove: () => void };
};

const defaultDependencies: TabStoreDependencies = {
  getActiveTab: () => getSessionStorage('activeTab'),
  getTabInfo,
  getPlaybackContext: async (tabId) => {
    const response = await sendMessage('getPlaybackContext', { tabId });
    if (!response.success || response.data === null) return null;
    const parsed = playbackContextStatusSchema.safeParse(response.data);
    return parsed.success ? parsed.data : null;
  },
  onActiveTabChange: onSessionStorageChange,
  onTabInfoChange,
  onPlaybackContextChange: (callback) =>
    onMessage(({ message, params }) => {
      if (message !== 'playbackContextChanged') return;
      const status = params.status === null
        ? null
        : playbackContextStatusSchema.safeParse(params.status);
      if (status !== null && !status.success) return;
      callback(params.tabId, status === null ? null : status.data);
    }),
};

export const createTabStore = (dependencies: TabStoreDependencies = defaultDependencies) => create(
  combine(
    {
      activeTab: null as chrome.tabs.Tab | null,
      playbackContext: null as PlaybackContextStatus | null,
      tabInfo: null as TabInfo | null,
    },
    (set, get) => {
      let activeTabRevision = 0;
      let playbackContextRevision = 0;
      let tabInfoRevision = 0;

      const handleTabChange = async (tab: chrome.tabs.Tab) => {
        if (tab.id === undefined) return;

        const revision = ++activeTabRevision;
        const infoRevision = tabInfoRevision;
        const contextRevision = playbackContextRevision;
        set({ activeTab: tab, playbackContext: null, tabInfo: null });
        const [info, playbackContext] = await Promise.all([
          dependencies.getTabInfo(tab.id),
          dependencies.getPlaybackContext?.(tab.id) ?? Promise.resolve(null),
        ]);
        if (revision === activeTabRevision && infoRevision === tabInfoRevision) {
          set({ tabInfo: info ?? null });
        }
        if (
          revision === activeTabRevision &&
          contextRevision === playbackContextRevision
        ) {
          set({ playbackContext });
        }
      };

      return {
        setActiveTab: (tab: chrome.tabs.Tab | null) => {
          activeTabRevision += 1;
          playbackContextRevision += 1;
          set({ activeTab: tab, playbackContext: null, tabInfo: null });
        },
        setTabInfo: (info: TabInfo | null) => {
          tabInfoRevision += 1;
          set({ tabInfo: info });
        },
        initialize: async () => {
          const { remove: removeSessionStorageChange } = dependencies.onActiveTabChange((changes) => {
            const change = changes['activeTab'];
            if (change?.newValue) {
              void handleTabChange(change.newValue);
            }
          });

          const { remove: removeTabInfoChange } = dependencies.onTabInfoChange((tabId, info) => {
            const { activeTab } = get();
            if (tabId === activeTab?.id) {
              tabInfoRevision += 1;
              set({ tabInfo: info });
            }
          });
          const playbackContextRegistration = dependencies.onPlaybackContextChange?.(
            (tabId, playbackContext) => {
              const { activeTab } = get();
              if (tabId !== activeTab?.id) return;
              playbackContextRevision += 1;
              set({ playbackContext });
            }
          );
          const removePlaybackContextChange = playbackContextRegistration?.remove ?? (() => {});

          const removeListeners = () => {
            removeSessionStorageChange();
            removeTabInfoChange();
            removePlaybackContextChange();
          };

          try {
            const initialRevision = activeTabRevision;
            const tab = await dependencies.getActiveTab();
            if (tab && initialRevision === activeTabRevision) {
              await handleTabChange(tab);
            }
            return removeListeners;
          } catch (error) {
            removeListeners();
            throw error;
          }
        },
      };
    }
  )
);

export const useTabStore = createTabStore();
export type TabStore = ReturnType<typeof useTabStore.getState>;
