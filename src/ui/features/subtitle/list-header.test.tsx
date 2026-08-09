import { act, useState } from 'react';

import { createRoot, Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ListHeader } from './list-header';

interface ListItem {
  title: string;
  savedAt: string;
}

const items: ListItem[] = [
  { title: 'New alpha', savedAt: '2026-08-02T00:00:00.000Z' },
  { title: 'Old beta', savedAt: '2026-08-01T00:00:00.000Z' },
];

describe('ListHeader', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));

  beforeEach(() => {
    vi.mocked(chrome.i18n.getMessage).mockImplementation((key) => key);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  afterAll(() => vi.unstubAllGlobals());

  it('keeps the input draft separate until Search commits it', () => {
    const filteredLists: ListItem[][] = [];
    renderControlledHeader(root, {
      onFilteredListChange: (filteredList) => filteredLists.push(filteredList),
    });

    const input = getSearchInput(container);
    act(() => setInputValue(input, '  alpha  '));

    expect(container.querySelector('[data-testid="search-query"]')?.textContent).toBe('');
    expect(filteredLists.at(-1)?.map(({ title }) => title)).toEqual([
      'New alpha',
      'Old beta',
    ]);

    act(() => submitSearch(container));

    expect(input.value).toBe('alpha');
    expect(container.querySelector('[data-testid="search-query"]')?.textContent).toBe('alpha');
    expect(filteredLists.at(-1)?.map(({ title }) => title)).toEqual(['New alpha']);
  });

  it('uses the same full reset for the internal and external Clear actions', () => {
    const filteredLists: ListItem[][] = [];
    renderControlledHeader(root, {
      onFilteredListChange: (filteredList) => filteredLists.push(filteredList),
    });

    act(() => getButton(container, 'oldest').click());
    applySearch(container, 'alpha');

    act(() => getButton(container, 'clear_search').click());

    const input = getSearchInput(container);
    expect(input.value).toBe('');
    expect(container.querySelector('[data-testid="search-query"]')?.textContent).toBe('');
    expect(filteredLists.at(-1)?.map(({ title }) => title)).toEqual([
      'Old beta',
      'New alpha',
    ]);
    expect(document.activeElement).toBe(input);

    applySearch(container, 'beta');
    act(() => setInputValue(input, 'uncommitted draft'));
    act(() => getButton(container, 'external-clear').click());

    expect(input.value).toBe('');
    expect(container.querySelector('[data-testid="search-query"]')?.textContent).toBe('');
    expect(filteredLists.at(-1)?.map(({ title }) => title)).toEqual([
      'Old beta',
      'New alpha',
    ]);
    expect(document.activeElement).toBe(input);
    expect(getButton(container, 'oldest').getAttribute('aria-pressed')).toBe('true');
  });

  it('disables search, clear, and sort controls while preserving the committed result', () => {
    const onSearchQueryChange = vi.fn();
    const onFilteredListChange = vi.fn();

    act(() =>
      root.render(
        <ListHeader
          originalList={items}
          filterKey='title'
          searchQuery='alpha'
          disabled
          onFilteredListChange={onFilteredListChange}
          onSearchQueryChange={onSearchQueryChange}
        />
      )
    );

    const input = getSearchInput(container);
    expect(input.disabled).toBe(true);
    expect(getButton(container, 'search').disabled).toBe(true);
    expect(getButton(container, 'clear_search').disabled).toBe(true);
    expect(getButton(container, 'latest').disabled).toBe(true);
    expect(getButton(container, 'oldest').disabled).toBe(true);
    expect(onFilteredListChange).toHaveBeenLastCalledWith([items[0]]);

    act(() => submitSearch(container));
    expect(onSearchQueryChange).not.toHaveBeenCalled();
  });
});

interface ControlledHeaderProps {
  onFilteredListChange: (filteredList: ListItem[]) => void;
}

function renderControlledHeader(root: Root, { onFilteredListChange }: ControlledHeaderProps) {
  function ControlledHeader() {
    const [searchQuery, setSearchQuery] = useState('');

    return (
      <>
        <ListHeader
          originalList={items}
          filterKey='title'
          searchQuery={searchQuery}
          onFilteredListChange={onFilteredListChange}
          onSearchQueryChange={setSearchQuery}
        />
        <button type='button' onClick={() => setSearchQuery('')}>
          external-clear
        </button>
        <output data-testid='search-query'>{searchQuery}</output>
      </>
    );
  }

  act(() => root.render(<ControlledHeader />));
}

function applySearch(container: HTMLElement, searchQuery: string) {
  act(() => setInputValue(getSearchInput(container), searchQuery));
  act(() => submitSearch(container));
}

function getSearchInput(container: HTMLElement) {
  const input = container.querySelector<HTMLInputElement>('input[aria-label="search"]');
  if (!input) throw new Error('Expected search input');
  return input;
}

function getButton(container: HTMLElement, accessibleName: string) {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) =>
      candidate.getAttribute('aria-label') === accessibleName ||
      candidate.textContent?.trim() === accessibleName
  );
  if (!button) throw new Error(`Expected button: ${accessibleName}`);
  return button;
}

function setInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function submitSearch(container: HTMLElement) {
  const form = container.querySelector('form');
  if (!form) throw new Error('Expected search form');
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}
