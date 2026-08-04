import { beforeEach, describe, expect, it } from 'vitest';

import { PAGE_NAMES, usePageStore } from './page-store';

describe('page store', () => {
  beforeEach(() => {
    usePageStore.setState({
      currentPage: 'learning',
      navigationLockTokens: new Set(),
      navigationLocked: false,
    });
  });

  it('starts with the four canonical pages and Learning as the default', () => {
    expect(PAGE_NAMES).toEqual(['learning', 'subtitles', 'library', 'review']);
    expect(usePageStore.getState().currentPage).toBe('learning');
  });

  it('blocks page changes until navigation is unlocked', () => {
    usePageStore.getState().setNavigationLocked(true);
    usePageStore.getState().setPage('review');

    expect(usePageStore.getState().currentPage).toBe('learning');

    usePageStore.getState().setNavigationLocked(false);
    usePageStore.getState().setPage('review');

    expect(usePageStore.getState().currentPage).toBe('review');
  });

  it('aggregates independent lock owners without stale releases unlocking another owner', () => {
    const releaseFirst = usePageStore.getState().acquireNavigationLock();
    const releaseSecond = usePageStore.getState().acquireNavigationLock();

    releaseFirst();
    expect(usePageStore.getState().navigationLocked).toBe(true);

    usePageStore.getState().setNavigationLocked(true);
    releaseSecond();
    expect(usePageStore.getState().navigationLocked).toBe(true);

    const releaseCurrent = usePageStore.getState().acquireNavigationLock();
    usePageStore.getState().setNavigationLocked(false);
    releaseFirst();
    expect(usePageStore.getState().navigationLocked).toBe(true);

    releaseCurrent();
    expect(usePageStore.getState().navigationLocked).toBe(false);
  });
});
