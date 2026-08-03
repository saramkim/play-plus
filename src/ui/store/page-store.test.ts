import { beforeEach, describe, expect, it } from 'vitest';

import { PAGE_NAMES, usePageStore } from './page-store';

describe('page store', () => {
  beforeEach(() => {
    usePageStore.setState({
      currentPage: 'learning',
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
});
