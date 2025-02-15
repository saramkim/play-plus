import { getSessionStorage, onSessionStorageChange } from '@storage/index';
import { getTabInfo, TabInfo } from '@storage/tab';
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
    (async () => {
      if (!activeTab?.id) return;
      const info = await getTabInfo(activeTab.id);
      setTabInfo(info ?? null);
    })();
  }, [activeTab]);

  return { activeTab, tabInfo };
}
