import { describe, expect, it, vi } from 'vitest';

import { createConnectionStatus } from './connection-status';
import {
  ActivatedTabDependencies,
  createActiveTabSnapshotController,
  handleActiveTabUrlUpdated,
  handleTabActivated,
  seedActiveTabConnection,
} from './tab-events';

const createDependencies = (tab: chrome.tabs.Tab): ActivatedTabDependencies => ({
  awaitReady: vi.fn(async () => {}),
  checkContentConnection: vi.fn(async () => {}),
  getTab: vi.fn(async () => tab),
  setActiveTab: vi.fn(async () => {}),
  updateNavigatingStatus: vi.fn(async () => {}),
});

describe('activated tab handling', () => {
  it('persists the active tab before v2 readiness completes', async () => {
    const readiness = createDeferred<void>();
    const tab = {
      active: true,
      id: 7,
      url: 'https://www.coupangplay.com/play/one',
    } as chrome.tabs.Tab;
    const dependencies = createDependencies(tab);
    dependencies.awaitReady = vi.fn(() => readiness.promise);

    const handling = handleTabActivated(7, dependencies);

    await vi.waitFor(() => expect(dependencies.setActiveTab).toHaveBeenCalledWith(tab));
    expect(dependencies.updateNavigatingStatus).not.toHaveBeenCalled();
    expect(dependencies.checkContentConnection).not.toHaveBeenCalled();

    readiness.resolve();
    await handling;

    expect(dependencies.updateNavigatingStatus).toHaveBeenCalledOnce();
    expect(dependencies.checkContentConnection).toHaveBeenCalledOnce();
  });

  it('does not apply delayed readiness work after a newer navigation', async () => {
    const readiness = createDeferred<void>();
    const tab = {
      active: true,
      id: 7,
      url: 'https://www.coupangplay.com/play/one',
    } as chrome.tabs.Tab;
    const dependencies = createDependencies(tab);
    dependencies.awaitReady = vi.fn(() => readiness.promise);
    vi.mocked(dependencies.getTab)
      .mockResolvedValueOnce(tab)
      .mockResolvedValueOnce({ ...tab, url: 'https://www.coupangplay.com/play/two' });

    const handling = handleTabActivated(7, dependencies);
    await vi.waitFor(() => expect(dependencies.setActiveTab).toHaveBeenCalledWith(tab));
    readiness.resolve();
    await handling;

    expect(dependencies.updateNavigatingStatus).not.toHaveBeenCalled();
    expect(dependencies.checkContentConnection).not.toHaveBeenCalled();
  });

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

    expect(dependencies.awaitReady).toHaveBeenCalledOnce();
    expect(dependencies.setActiveTab).toHaveBeenCalledWith(tab);
    expect(dependencies.updateNavigatingStatus).toHaveBeenCalledWith(0, true, null);
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
    expect(dependencies.updateNavigatingStatus).not.toHaveBeenCalled();
    expect(dependencies.checkContentConnection).not.toHaveBeenCalled();
  });
});

describe('active tab snapshots', () => {
  it('seeds the current active tab when background listeners start', async () => {
    const tab = { active: true, id: 3, url: 'https://www.coupangplay.com/' } as chrome.tabs.Tab;
    const setActiveTab = vi.fn(async () => {});
    const snapshots = createActiveTabSnapshotController(setActiveTab);

    await snapshots.seed(vi.fn(async () => tab));

    expect(setActiveTab).toHaveBeenCalledWith(tab);
  });

  it('continues the startup seed through the production replay trigger', async () => {
    const tab = {
      active: true,
      id: 3,
      url: 'https://www.coupangplay.com/play/00000000-0000-4000-8000-000000000001',
    } as chrome.tabs.Tab;
    const setActiveTab = vi.fn(async () => {});
    const snapshots = createActiveTabSnapshotController(setActiveTab);
    const dependencies = createDependencies(tab);
    const handleSubtitleContentStatus = vi.fn(async () => {});
    const connectionStatus = createConnectionStatus({
      getCurrentVideoId: vi.fn(async () => '00000000-0000-4000-8000-000000000001'),
      handleSubtitleContentStatus,
      pingContent: vi.fn(async () => ({
        success: true as const,
        data: {
          contentEpoch: 1,
          contentInstanceId: 'content-1',
          hasVideo: true,
          learningAvailable: true,
          lifecycle: 'content' as const,
          mediaAttachmentRevision: 8,
          missionResumeRequired: false,
          routeChangedAt: 1_000,
          routeKind: 'episode' as const,
          subtitleIdentity: {
            learning: 'native:en',
            subtitleRevision: 1,
            support: null,
          },
          videoId: '00000000-0000-4000-8000-000000000001',
          videoRevision: 8,
        },
      })),
      updateTabInfo: vi.fn(async () => {}),
    });
    dependencies.checkContentConnection = connectionStatus.checkContentConnection;
    dependencies.setActiveTab = snapshots.persistEvent;

    await seedActiveTabConnection(snapshots, vi.fn(async () => tab), dependencies);

    expect(handleSubtitleContentStatus).toHaveBeenCalledWith(3, expect.objectContaining({
      contentEpoch: 1,
      contentInstanceId: 'content-1',
      documentId: null,
      hasVideo: true,
      isVideoUrl: true,
      routeChangedAt: 1_000,
      videoId: '00000000-0000-4000-8000-000000000001',
      videoRevision: 8,
    }));
  });

  it('does not let a slow startup seed overwrite a newer tab event', async () => {
    const startupTab = createDeferred<chrome.tabs.Tab | undefined>();
    const setActiveTab = vi.fn(async () => {});
    const snapshots = createActiveTabSnapshotController(setActiveTab);
    const newerTab = { active: true, id: 9, url: 'https://www.coupangplay.com/play/newer' } as chrome.tabs.Tab;

    const seeding = snapshots.seed(() => startupTab.promise);
    await snapshots.persistEvent(newerTab);
    startupTab.resolve({ active: true, id: 3, url: 'https://example.com' } as chrome.tabs.Tab);
    await seeding;

    expect(setActiveTab).toHaveBeenCalledOnce();
    expect(setActiveTab).toHaveBeenCalledWith(newerTab);
  });

  it('stores an active tab URL update without waiting for page completion', async () => {
    const tab = { active: true, id: 3, url: 'https://example.com' } as chrome.tabs.Tab;
    const setActiveTab = vi.fn(async () => {});
    const updateNavigatingStatus = vi.fn(async () => {});
    const url = 'https://www.coupangplay.com/play/one';

    await handleActiveTabUrlUpdated(tab, url, { setActiveTab, updateNavigatingStatus });

    expect(setActiveTab).toHaveBeenCalledWith({ ...tab, url });
    expect(updateNavigatingStatus).toHaveBeenCalledWith(3, true, null);
  });

  it('queues the route transition before active-tab persistence settles', async () => {
    const activeTabWrite = createDeferred<void>();
    const tab = { active: true, id: 3, url: 'https://example.com' } as chrome.tabs.Tab;
    const setActiveTab = vi.fn(() => activeTabWrite.promise);
    const updateNavigatingStatus = vi.fn(async () => {});

    const handling = handleActiveTabUrlUpdated(
      tab,
      'https://www.coupangplay.com/play/00000000-0000-4000-8000-000000000001',
      { setActiveTab, updateNavigatingStatus }
    );

    expect(updateNavigatingStatus).toHaveBeenCalledWith(
      3,
      true,
      '00000000-0000-4000-8000-000000000001'
    );
    activeTabWrite.resolve();
    await handling;
  });

  it('ignores URL updates from inactive tabs', async () => {
    const tab = { active: false, id: 3, url: 'https://example.com' } as chrome.tabs.Tab;
    const setActiveTab = vi.fn(async () => {});
    const updateNavigatingStatus = vi.fn(async () => {});

    await handleActiveTabUrlUpdated(tab, 'https://www.coupangplay.com/', {
      setActiveTab,
      updateNavigatingStatus,
    });

    expect(setActiveTab).not.toHaveBeenCalled();
    expect(updateNavigatingStatus).not.toHaveBeenCalled();
  });
});

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};
