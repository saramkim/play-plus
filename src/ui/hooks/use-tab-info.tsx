import { getSessionStorage, onSessionStorageChange } from '@storage/index';
import { getTabInfo, onTabInfoChange, TabInfo } from '@storage/tab';
import { useEffect, useState } from 'react';

export function useTabInfo() {
  const [activeTab, setActiveTab] = useState<chrome.tabs.Tab | null>(null);
  const [tabInfo, setTabInfo] = useState<TabInfo | null>(null);

  useEffect(() => {
    (async () => {
      const tab = await getSessionStorage('activeTab');
      if (tab) setActiveTab(tab);
    })();

    const { remove } = onSessionStorageChange((changes) => {
      const change = changes['activeTab'];
      if (change?.newValue) setActiveTab(change.newValue);
    });
    return remove;
  }, []);

  useEffect(() => {
    const activeTabId = activeTab?.id;
    if (!activeTabId) return;

    (async () => {
      const info = await getTabInfo(activeTabId);
      setTabInfo(info ?? null);
    })();

    const { remove } = onTabInfoChange((tabId, info) => {
      if (tabId === activeTabId) setTabInfo(info);
    });
    return remove;
  }, [activeTab]);

  return { activeTab, tabInfo };
}
