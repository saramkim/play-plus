import { getSessionStorage, onSessionStorageChange } from '@storage/session';
import { TabInfo, getTabInfo, onTabInfoChange } from '@storage/tab';
import { create } from 'zustand';
import { combine } from 'zustand/middleware';

export type TabStoreDependencies = {
  getActiveTab: () => Promise<chrome.tabs.Tab | undefined>;
  getTabInfo: typeof getTabInfo;
  onActiveTabChange: typeof onSessionStorageChange;
  onTabInfoChange: typeof onTabInfoChange;
};

const defaultDependencies: TabStoreDependencies = {
  getActiveTab: () => getSessionStorage('activeTab'),
  getTabInfo,
  onActiveTabChange: onSessionStorageChange,
  onTabInfoChange,
};

export const createTabStore = (dependencies: TabStoreDependencies = defaultDependencies) => create(
  combine(
    {
      activeTab: null as chrome.tabs.Tab | null,
      tabInfo: null as TabInfo | null,
    },
    (set, get) => {
      let activeTabRevision = 0;
      let tabInfoRevision = 0;

      const handleTabChange = async (tab: chrome.tabs.Tab) => {
        if (tab.id === undefined) return;

        const revision = ++activeTabRevision;
        const infoRevision = tabInfoRevision;
        set({ activeTab: tab, tabInfo: null });
        const info = await dependencies.getTabInfo(tab.id);
        if (revision === activeTabRevision && infoRevision === tabInfoRevision) {
          set({ tabInfo: info ?? null });
        }
      };

      return {
        setActiveTab: (tab: chrome.tabs.Tab | null) => {
          activeTabRevision += 1;
          set({ activeTab: tab, tabInfo: null });
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

          const removeListeners = () => {
            removeSessionStorageChange();
            removeTabInfoChange();
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
