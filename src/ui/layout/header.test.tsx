import { act } from 'react';

import { PAGE_NAME } from '@utils/constants';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { usePageStore } from '@/ui/store/page-store';

import { Header } from './header';

describe('Header navigation lock', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    usePageStore.setState({
      currentPage: PAGE_NAME.SUBTITLE_UPLOAD,
      navigationLocked: true,
      params: {},
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    usePageStore.getState().setNavigationLocked(false);
    container.remove();
  });

  it('disables every global page tab until navigation is unlocked', () => {
    act(() => root.render(<Header />));

    expect(Array.from(container.querySelectorAll('button')).every((button) => button.disabled)).toBe(true);

    act(() => usePageStore.getState().setNavigationLocked(false));

    expect(Array.from(container.querySelectorAll('button')).every((button) => !button.disabled)).toBe(true);
  });
});
