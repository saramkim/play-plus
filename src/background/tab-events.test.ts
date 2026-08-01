import { describe, expect, it, vi } from 'vitest';

import { ActivatedTabDependencies, handleTabActivated } from './tab-events';

const createDependencies = (tab: chrome.tabs.Tab): ActivatedTabDependencies => ({
  checkContentConnection: vi.fn(async () => {}),
  getTab: vi.fn(async () => tab),
  setActiveTab: vi.fn(async () => {}),
  updateTabInfo: vi.fn(async () => {}),
});

describe('activated tab handling', () => {
  it('persists and checks a Coupang Play tab with id zero', async () => {
    const tab = {
      active: true,
      highlighted: true,
      id: 0,
      incognito: false,
      index: 0,
      pinned: false,
      selected: true,
      url: 'https://www.coupangplay.com/play/one',
      windowId: 1,
    } as chrome.tabs.Tab;
    const dependencies = createDependencies(tab);

    await handleTabActivated(0, dependencies);

    expect(dependencies.setActiveTab).toHaveBeenCalledWith(tab);
    expect(dependencies.updateTabInfo).toHaveBeenCalledWith(0, {
      connectionStatus: 'connecting',
      videoStatus: 'detecting',
    });
    expect(dependencies.checkContentConnection).toHaveBeenCalledWith(0, true);
  });

  it('only persists an unrelated active tab', async () => {
    const tab = {
      active: true,
      highlighted: true,
      id: 8,
      incognito: false,
      index: 0,
      pinned: false,
      selected: true,
      url: 'https://example.com',
      windowId: 1,
    } as chrome.tabs.Tab;
    const dependencies = createDependencies(tab);

    await handleTabActivated(8, dependencies);

    expect(dependencies.setActiveTab).toHaveBeenCalledWith(tab);
    expect(dependencies.updateTabInfo).not.toHaveBeenCalled();
    expect(dependencies.checkContentConnection).not.toHaveBeenCalled();
  });
});
