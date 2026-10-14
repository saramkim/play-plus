import { act } from 'react';

import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTabStore } from '@/ui/store/tab-store';

import { SubtitleAnalysisPage } from './subtitle-analysis-page';

const mocks = vi.hoisted(() => ({
  play: vi.fn(), save: vi.fn(), scroll: vi.fn(), offset: vi.fn(),
  state: { subtitleId: 'en', activeIndex: 2 },
  subtitles: [
    { start: 1, end: 2, text: 'First line' },
    { start: 7, end: 8, text: 'Hello\n안녕하세요' },
    { start: 20, end: 22, text: 'hello again' },
  ],
}));
vi.mock('@/ui/features/analysis/use-subtitle-analysis', () => ({ useSubtitleAnalysis: () => ({
  ...mocks.state, subtitles: mocks.subtitles, defaultSubtitleOptions: [],
  setSubtitleId: vi.fn(), handlePlayVideo: mocks.play, handleToggleSubtitle: mocks.save,
  isSubtitleSaved: () => false,
}) }));
vi.mock('@/ui/features/subtitle-upload/uploaded-subtitle-select', () => ({ UploadedSubtitleSelect: () => null }));
vi.mock('@tanstack/react-virtual', () => ({ useVirtualizer: ({ count, getItemKey }: {
  count: number; getItemKey: (index: number) => number;
}) => ({
  getTotalSize: () => count * 41,
  getVirtualItems: () => Array.from({ length: count }, (_, index) => ({ index, key: getItemKey(index), start: index * 41 })),
  measureElement: vi.fn(), scrollToIndex: mocks.scroll, scrollToOffset: mocks.offset,
}) }));

let root: Root;
let container: HTMLDivElement;
const render = () => act(() => root.render(<SubtitleAnalysisPage />));
const search = (value: string) => act(() => {
  const input = container.querySelector('input')!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
const rows = () => Array.from(container.querySelectorAll<HTMLElement>('[data-index]'));
const isActive = (row: HTMLElement) => !!row.querySelector('[aria-current="true"]');
const press = (element: HTMLElement, key: string) => act(() => {
  element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
});
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.assign(chrome.tabs, { onUpdated: { addListener: vi.fn(), removeListener: vi.fn() } });
  mocks.play.mockClear(); mocks.save.mockClear(); mocks.scroll.mockClear(); mocks.offset.mockClear();
  mocks.state.subtitleId = 'en'; mocks.state.activeIndex = 2;
  useTabStore.setState({ activeTab: { id: 1, url: 'https://www.coupangplay.com/play/00000000-0000-0000-0000-000000000001' } as chrome.tabs.Tab });
  vi.mocked(chrome.i18n.getMessage).mockImplementation((key, args) => `${key}${Array.isArray(args) && args.length ? ':' + args.join('/') : ''}`);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container); render();
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe('analysis body search', () => {
  it('resets on the active tab URL event without a completed load and removes the listener', () => {
    search('hello'); mocks.scroll.mockClear();
    const listener = vi.mocked(chrome.tabs.onUpdated.addListener).mock.calls.at(-1)![0];
    const nextUrl = 'https://www.coupangplay.com/play/00000000-0000-0000-0000-000000000002';
    act(() => listener(2, { url: nextUrl }, {} as chrome.tabs.Tab));
    expect(container.querySelector('input')!.value).toBe('hello');
    act(() => listener(1, { title: 'updated title' }, {} as chrome.tabs.Tab));
    expect(container.querySelector('input')!.value).toBe('hello');
    act(() => listener(1, { url: nextUrl }, {} as chrome.tabs.Tab));
    expect(container.querySelector('input')!.value).toBe('');
    expect(rows()).toHaveLength(3);
    expect(mocks.scroll).toHaveBeenCalled();
    expect(container.querySelector('[aria-label="auto_scroll"]')).toBeNull();
    act(() => root.render(null));
    expect(chrome.tabs.onUpdated.removeListener).toHaveBeenCalledWith(listener);
  });

  it('treats whitespace as no search and preserves duplicate cue identity', () => {
    search('   ');
    expect(rows()).toHaveLength(3);
    expect(container.querySelector('[aria-label="auto_scroll"]')).toBeNull();
    const original = structuredClone(mocks.subtitles);
    try {
      mocks.subtitles[0] = { start: 7, end: 8, text: 'Hello\n안녕하세요' };
      render(); search('hello');
      expect(rows()).toHaveLength(3);
      expect(rows().filter(isActive)).toEqual([rows()[2]]);
      act(() => rows()[1].querySelectorAll('button')[1].click());
      expect(mocks.save).toHaveBeenCalledWith(mocks.subtitles[1]);
    } finally {
      mocks.subtitles.splice(0, mocks.subtitles.length, ...original);
    }
  });

  it('filters without reordering or changing original cue actions and active identity', () => {
    const original = structuredClone(mocks.subtitles);
    search('  HELLO  ');
    expect(rows()).toHaveLength(2);
    expect(rows()[0].textContent).toContain('안녕하세요');
    expect(isActive(rows()[1])).toBe(true);
    expect(container.querySelector('[role=status]')?.textContent).toBe('subtitle_search_count:2/3');
    act(() => rows()[1].querySelector('button')!.click());
    expect(mocks.play).toHaveBeenCalledWith(20);
    act(() => rows()[0].querySelectorAll('button')[1].click());
    expect(mocks.save).toHaveBeenCalledWith(mocks.subtitles[1]);
    expect(mocks.subtitles).toEqual(original);
    search('안녕'); expect(rows()).toHaveLength(1);
    search('missing'); expect(rows()).toHaveLength(0);
    expect(container.textContent).toContain('subtitle_search_empty');
  });

  it('keeps follow paused after clear, restores input focus and resumes only explicitly', () => {
    expect(mocks.scroll).toHaveBeenCalled();
    expect(mocks.offset).not.toHaveBeenCalled();
    search('hello'); mocks.scroll.mockClear();
    mocks.state.activeIndex = 1; render();
    expect(mocks.scroll).not.toHaveBeenCalled();
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="clear_search"]')!.click());
    expect(container.querySelector('input')!.value).toBe('');
    expect(document.activeElement).toBe(container.querySelector('input'));
    expect(rows()).toHaveLength(3);
    expect(mocks.scroll).not.toHaveBeenCalled();
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="auto_scroll"]')!.click());
    expect(mocks.scroll).toHaveBeenCalled();
  });

  it('resets search on source, tab and video changes but retains it for ordinary updates', () => {
    search('hello'); mocks.state.activeIndex = 0; render();
    expect(container.querySelector('input')!.value).toBe('hello');
    mocks.state.subtitleId = 'ko'; render();
    expect(container.querySelector('input')!.value).toBe('');
    search('hello');
    act(() => useTabStore.setState({ activeTab: { id: 2 } as chrome.tabs.Tab }));
    expect(container.querySelector('input')!.value).toBe('');
    search('hello');
    act(() => useTabStore.setState({ activeTab: { id: 2, url: 'https://www.coupangplay.com/play/00000000-0000-0000-0000-000000000002' } as chrome.tabs.Tab }));
    expect(container.querySelector('input')!.value).toBe('');
  });
});

describe('analysis keyboard navigation', () => {
  it('navigates only the list, clamps endpoints and keeps save separate from playback', () => {
    const first = rows()[0].querySelector<HTMLButtonElement>('[data-subtitle-play]')!;
    act(() => first.focus());
    press(first, 'End');
    expect(document.activeElement).toBe(rows()[2].querySelector('[data-subtitle-play]'));
    expect(mocks.scroll).toHaveBeenLastCalledWith(2, { align: 'auto' });
    press(document.activeElement as HTMLElement, 'ArrowDown');
    expect(document.activeElement).toBe(rows()[2].querySelector('[data-subtitle-play]'));
    press(document.activeElement as HTMLElement, 'ArrowUp');
    expect(document.activeElement).toBe(rows()[1].querySelector('[data-subtitle-play]'));
    press(document.activeElement as HTMLElement, 'Home');
    expect(document.activeElement).toBe(first);
    expect(mocks.play).not.toHaveBeenCalled();
    act(() => rows()[0].querySelectorAll('button')[1].click());
    expect(mocks.save).toHaveBeenCalledExactlyOnceWith(mocks.subtitles[0]);
    expect(mocks.play).not.toHaveBeenCalled();
    act(() => first.click());
    expect(mocks.play).toHaveBeenCalledExactlyOnceWith(1);
    mocks.scroll.mockClear();
    press(container.querySelector('input')!, 'End');
    expect(mocks.scroll).not.toHaveBeenCalled();
    expect(container.querySelector('button button')).toBeNull();
  });

  it('uses filtered order and keeps following paused after navigation or user scrolling', () => {
    search('hello');
    const first = rows()[0].querySelector<HTMLButtonElement>('[data-subtitle-play]')!;
    press(first, 'End');
    act(() => (document.activeElement as HTMLButtonElement).click());
    expect(mocks.play).toHaveBeenCalledExactlyOnceWith(20);
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="clear_search"]')!.click());
    mocks.scroll.mockClear(); mocks.state.activeIndex = 1; render();
    expect(mocks.scroll).not.toHaveBeenCalled();
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="auto_scroll"]')!.click());
    const list = container.querySelector('.overflow-y-auto')!;
    act(() => list.dispatchEvent(new Event('scroll', { bubbles: true })));
    expect(container.textContent).toContain('analysis_following');
    act(() => list.dispatchEvent(new Event('wheel', { bubbles: true })));
    expect(container.textContent).toContain('analysis_follow_paused');
  });
});
