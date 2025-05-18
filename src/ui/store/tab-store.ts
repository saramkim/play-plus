import { getSessionStorage, onSessionStorageChange } from '@storage/index';
import { TabInfo, getTabInfo, onTabInfoChange } from '@storage/tab';
import { create } from 'zustand';
import { combine } from 'zustand/middleware';

export type TabStore = ReturnType<typeof useTabStore.getState>;

export const useTabStore = create(
  combine(
    {
      activeTab: null as chrome.tabs.Tab | null,
      tabInfo: null as TabInfo | null,
    },
    (set, get) => {
      const updateTabInfo = async (tabId: number) => {
        const info = await getTabInfo(tabId);
        set({ tabInfo: info ?? null });
      };

      const handleTabChange = async (tab: chrome.tabs.Tab) => {
        if (!tab.id) return;

        set({ activeTab: tab });
        await updateTabInfo(tab.id);
      };

      return {
        setActiveTab: (tab: chrome.tabs.Tab | null) => set({ activeTab: tab }),
        setTabInfo: (info: TabInfo | null) => set({ tabInfo: info }),
        initialize: async () => {
          const tab = await getSessionStorage('activeTab');
          if (tab) {
            await handleTabChange(tab);
          }

          const { remove: removeSessionStorageChange } = onSessionStorageChange((changes) => {
            const change = changes['activeTab'];
            if (change?.newValue) {
              handleTabChange(change.newValue);
            }
          });

          const { remove: removeTabInfoChange } = onTabInfoChange((tabId, info) => {
            const { activeTab } = get();
            if (tabId === activeTab?.id) {
              set({ tabInfo: info });
            }
          });

          return () => {
            removeSessionStorageChange();
            removeTabInfoChange();
          };
        },
      };
    }
  )
);
