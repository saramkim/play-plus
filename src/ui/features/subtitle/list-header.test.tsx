import { act } from 'react';

import { SubtitleMetadata } from '@storage/type';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ListHeader } from './list-header';

let container: HTMLDivElement;
let root: Root;
const onFilteredListChange = vi.fn();
const items: SubtitleMetadata[] = [
  { id: 'subtitle-00000000-0000-0000-0000-000000000001', title: 'Alpha', language: 'en', savedAt: '2020-01-01' },
  { id: 'subtitle-00000000-0000-0000-0000-000000000002', title: 'Beta', language: 'en', savedAt: '2021-01-01' },
];
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  onFilteredListChange.mockReset();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<ListHeader originalList={items} filterKey='title' onFilteredListChange={onFilteredListChange} />));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const submit = () => act(() => {
  container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
});

describe('list search and sort', () => {
  it('searches only on submit and clears the input, filter and old submission together', () => {
    const input = container.querySelector('input')!;
    expect(input.getAttribute('aria-label')).toBe('search_term');
    act(() => {
      input.value = '  ALPHA  ';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onFilteredListChange).toHaveBeenLastCalledWith([items[1], items[0]]);
    submit();
    expect(onFilteredListChange).toHaveBeenLastCalledWith([items[0]]);
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="clear_search"]')!.click());
    expect(input.value).toBe('');
    expect(document.activeElement).toBe(input);
    expect(onFilteredListChange).toHaveBeenLastCalledWith([items[1], items[0]]);
    submit();
    expect(onFilteredListChange).toHaveBeenLastCalledWith([items[1], items[0]]);
  });

  it('exposes the selected order and never mutates the source array', () => {
    const original = structuredClone(items);
    const buttons = Array.from(container.querySelectorAll('button'));
    const latest = buttons.find(button => button.textContent === 'latest')!;
    const oldest = buttons.find(button => button.textContent === 'oldest')!;
    expect(latest.getAttribute('aria-pressed')).toBe('true');
    expect(oldest.getAttribute('aria-pressed')).toBe('false');
    act(() => oldest.click());
    expect(onFilteredListChange).toHaveBeenLastCalledWith(items);
    expect(oldest.getAttribute('aria-pressed')).toBe('true');
    expect(latest.getAttribute('aria-pressed')).toBe('false');
    act(() => latest.click());
    expect(onFilteredListChange).toHaveBeenLastCalledWith([items[1], items[0]]);
    expect(items).toEqual(original);
  });
});

