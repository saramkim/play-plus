import { PAGE_NAME } from '@utils/constants';
import { beforeEach, describe, expect, it } from 'vitest';

import { usePageStore } from './page-store';

describe('page store navigation lock', () => {
  beforeEach(() => {
    usePageStore.setState({
      currentPage: PAGE_NAME.SUBTITLE_UPLOAD,
      navigationLocked: false,
      params: {},
    });
  });

  it('blocks page changes until navigation is unlocked', () => {
    usePageStore.getState().setNavigationLocked(true);
    usePageStore.getState().setPage(PAGE_NAME.REVIEW);

    expect(usePageStore.getState().currentPage).toBe(PAGE_NAME.SUBTITLE_UPLOAD);

    usePageStore.getState().setNavigationLocked(false);
    usePageStore.getState().setPage(PAGE_NAME.REVIEW);

    expect(usePageStore.getState().currentPage).toBe(PAGE_NAME.REVIEW);
  });
});
