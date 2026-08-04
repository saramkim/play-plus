import { act } from 'react';

import { createRoot, Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePageStore } from '@/ui/store/page-store';

import { Header } from './header';

describe('Header', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));

  beforeEach(() => {
    usePageStore.setState({
      currentPage: 'learning',
      navigationLocked: false,
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    usePageStore.setState({ currentPage: 'learning', navigationLocked: false });
    container.remove();
  });

  afterAll(() => vi.unstubAllGlobals());

  it('renders the four v2 destinations and marks the current page', () => {
    act(() => root.render(<Header />));

    const navigation = container.querySelector('nav');
    const buttons = Array.from(container.querySelectorAll('button'));

    expect(navigation?.getAttribute('aria-label')).toBe('v2_navigation_label');
    expect(navigation?.className).toContain('grid-cols-4');
    expect(buttons).toHaveLength(4);
    expect(buttons.map((button) => button.getAttribute('aria-current'))).toEqual([
      'page',
      null,
      null,
      null,
    ]);

    act(() => buttons[3].click());

    expect(usePageStore.getState().currentPage).toBe('review');
    expect(buttons[3].getAttribute('aria-current')).toBe('page');
  });

  it('disables every destination until navigation is unlocked', () => {
    usePageStore.getState().setNavigationLocked(true);
    act(() => root.render(<Header />));

    expect(Array.from(container.querySelectorAll('button')).every((button) => button.disabled)).toBe(true);

    act(() => usePageStore.getState().setNavigationLocked(false));

    expect(Array.from(container.querySelectorAll('button')).every((button) => !button.disabled)).toBe(true);
  });
});
