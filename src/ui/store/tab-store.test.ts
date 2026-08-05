import { describe, expect, it, vi } from 'vitest';

import { TabStoreDependencies, createTabStore } from './tab-store';

const ZERO_ID_TAB = {
  active: true,
  id: 0,
  url: 'https://www.coupangplay.com/play/one',
} as chrome.tabs.Tab;

const createDependencies = () => {
  let activeTabListener: Parameters<TabStoreDependencies['onActiveTabChange']>[0] = () => {};
  let tabInfoListener: Parameters<TabStoreDependencies['onTabInfoChange']>[0] = () => {};
  const removeActiveTabListener = vi.fn();
  const removeTabInfoListener = vi.fn();
  const dependencies: TabStoreDependencies = {
    getActiveTab: vi.fn(async () => undefined),
    getTabInfo: vi.fn(async () => undefined),
    onActiveTabChange: vi.fn((listener) => {
      activeTabListener = listener;
      return { remove: removeActiveTabListener };
    }),
    onTabInfoChange: vi.fn((listener) => {
      tabInfoListener = listener;
      return { remove: removeTabInfoListener };
    }),
  };

  return {
    dependencies,
    emitActiveTab: (tab: chrome.tabs.Tab) => {
      activeTabListener({ activeTab: { newValue: tab } });
    },
    emitTabInfo: (tabId: number, info: { connectionStatus: 'connected' | 'disconnected' }) => {
      tabInfoListener(tabId, info);
    },
    removeActiveTabListener,
    removeTabInfoListener,
  };
};

describe('tab store initialization', () => {
  it('accepts tab id zero from the initial active-tab snapshot', async () => {
    const { dependencies } = createDependencies();
    vi.mocked(dependencies.getActiveTab).mockResolvedValue(ZERO_ID_TAB);
    vi.mocked(dependencies.getTabInfo).mockResolvedValue({ connectionStatus: 'connected' });
    const store = createTabStore(dependencies);

    const cleanup = await store.getState().initialize();

    expect(store.getState().activeTab).toBe(ZERO_ID_TAB);
    expect(store.getState().tabInfo).toEqual({ connectionStatus: 'connected' });
    expect(dependencies.getTabInfo).toHaveBeenCalledWith(0);
    cleanup();
  });

  it('keeps an active-tab change that arrives while the initial snapshot is pending', async () => {
    const initialSnapshot = createDeferred<chrome.tabs.Tab | undefined>();
    const { dependencies, emitActiveTab } = createDependencies();
    vi.mocked(dependencies.getActiveTab).mockReturnValue(initialSnapshot.promise);
    vi.mocked(dependencies.getTabInfo).mockResolvedValue({ connectionStatus: 'connected' });
    const store = createTabStore(dependencies);
    const newerTab = {
      active: true,
      id: 8,
      url: 'https://www.coupangplay.com/play/newer',
    } as chrome.tabs.Tab;

    const initialization = store.getState().initialize();
    emitActiveTab(newerTab);
    await vi.waitFor(() => expect(store.getState().activeTab).toBe(newerTab));

    initialSnapshot.resolve({ active: true, id: 4, url: 'https://example.com' } as chrome.tabs.Tab);
    const cleanup = await initialization;

    expect(store.getState().activeTab).toBe(newerTab);
    expect(dependencies.getTabInfo).toHaveBeenCalledOnce();
    expect(dependencies.getTabInfo).toHaveBeenCalledWith(8);
    cleanup();
  });

  it('does not let an older tab-info read overwrite a storage change', async () => {
    const initialInfo = createDeferred<{ connectionStatus: 'disconnected' } | undefined>();
    const { dependencies, emitTabInfo } = createDependencies();
    vi.mocked(dependencies.getActiveTab).mockResolvedValue(ZERO_ID_TAB);
    vi.mocked(dependencies.getTabInfo).mockReturnValue(initialInfo.promise);
    const store = createTabStore(dependencies);

    const initialization = store.getState().initialize();
    await vi.waitFor(() => expect(store.getState().activeTab).toBe(ZERO_ID_TAB));
    emitTabInfo(0, { connectionStatus: 'connected' });
    initialInfo.resolve({ connectionStatus: 'disconnected' });
    const cleanup = await initialization;

    expect(store.getState().tabInfo).toEqual({ connectionStatus: 'connected' });
    cleanup();
  });
});

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};
