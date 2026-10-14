import { act } from 'react';

import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTabStore } from '@/ui/store/tab-store';

import { SubtitleAnalysisPage } from './subtitle-analysis-page';

const mocks = vi.hoisted(() => ({
  play: vi.fn(), save: vi.fn(), scroll: vi.fn(), offset: vi.fn(), readVideo: vi.fn(),
  state: { subtitleId: 'en', activeIndex: 2 },
  windowed: false,
  subtitles: [
    { start: 1, end: 2, text: 'First line' },
    { start: 7, end: 8, text: 'Hello\n안녕하세요' },
    { start: 20, end: 22, text: 'hello again' },
  ],
}));
vi.mock('@/ui/features/analysis/use-subtitle-analysis', () => ({ useSubtitleAnalysis: (videoId: string | null) => {
  mocks.readVideo(videoId);
  return ({
  ...mocks.state, subtitles: mocks.subtitles, defaultSubtitleOptions: [],
  setSubtitleId: vi.fn(), handlePlayVideo: mocks.play, handleToggleSubtitle: mocks.save,
  isSubtitleSaved: () => false,
}); } }));
vi.mock('@/ui/features/subtitle-upload/uploaded-subtitle-select', () => ({ UploadedSubtitleSelect: () => null }));
vi.mock('@/ui/features/subtitle-upload/use-uploaded-subtitles', () => {
  const subtitles: never[] = [];
  return { useUploadedSubtitles: () => ({ subtitles }) };
});
vi.mock('@tanstack/react-virtual', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-virtual')>();
  return { ...actual, useVirtualizer: ({ count, getItemKey, rangeExtractor }: {
  count: number; getItemKey: (index: number) => number;
  rangeExtractor: typeof actual.defaultRangeExtractor;
}) => ({
  getTotalSize: () => count * 41,
  getVirtualItems: () => (mocks.windowed
    ? rangeExtractor({ startIndex: 0, endIndex: 0, overscan: 0, count })
    : Array.from({ length: count }, (_, index) => index))
    .map((index) => ({ index, key: getItemKey(index), start: index * 41 })),
  measureElement: vi.fn(), scrollToIndex: mocks.scroll, scrollToOffset: mocks.offset,
}) }; });

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
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.assign(chrome.tabs, {
    get: vi.fn(async () => ({ ...useTabStore.getState().activeTab })),
    onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
  });
  mocks.play.mockClear(); mocks.save.mockClear(); mocks.scroll.mockClear(); mocks.offset.mockClear();
  mocks.state.subtitleId = 'en'; mocks.state.activeIndex = 2;
  mocks.windowed = false;
  useTabStore.setState({ activeTab: { id: 1, url: 'https://www.coupangplay.com/play/00000000-0000-0000-0000-000000000001' } as chrome.tabs.Tab,
    tabInfo: { nativeVideoId: '00000000-0000-0000-0000-000000000001', ko: [{ start: 6, end: 10, text: '보조만' }] } });
  vi.mocked(chrome.i18n.getMessage).mockImplementation((key, args) => `${key}${Array.isArray(args) && args.length ? ':' + args.join('/') : ''}`);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<SubtitleAnalysisPage />));
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe('analysis body search', () => {
  it('adds read-only overlap while keeping search, follow and actions primary-only', () => {
    const select = container.querySelector('select')!;
    expect(select.value).toBe(''); expect(container.querySelector('[data-companion-text]')).toBeNull();
    search('hello');
    act(() => { select.value = 'ko'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(container.querySelector('input')!.value).toBe('hello');
    expect(container.textContent).toContain('analysis_follow_search');
    expect(rows()[0].querySelector('[data-companion-text]')?.textContent).toBe('보조만');
    expect(rows()[1].querySelector('[data-companion-text]')).toBeNull();
    act(() => rows()[0].querySelector('[data-subtitle-play]')!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(mocks.play).toHaveBeenLastCalledWith(7);
    act(() => rows()[0].querySelectorAll('button')[1].click());
    expect(mocks.save).toHaveBeenLastCalledWith(mocks.subtitles[1]);
    search('보조만'); expect(rows()).toHaveLength(0);
    search(''); expect(container.textContent).toContain('analysis_follow_paused');
    act(() => { select.value = ''; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(container.textContent).toContain('analysis_follow_paused');
  });

  it.each(['source', 'tab', 'video'])('resets companion selection on %s change', async (change) => {
    const select = container.querySelector('select')!;
    act(() => { select.value = 'ko'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(select.value).toBe('ko');
    if (change === 'source') { mocks.state.subtitleId = 'custom'; render(); }
    if (change === 'tab') await act(async () => useTabStore.setState({ activeTab: { ...useTabStore.getState().activeTab!, id: 2 } }));
    if (change === 'video') {
      const listener = vi.mocked(chrome.tabs.onUpdated.addListener).mock.calls.at(-1)![0];
      act(() => listener(1, { url: 'https://www.coupangplay.com/play/00000000-0000-0000-0000-000000000002' }, {} as chrome.tabs.Tab));
    }
    expect(container.querySelector('select')!.value).toBe('');
    expect(container.querySelector('[data-companion-text]')).toBeNull();
  });
  it('reads the live tab when mounted after a missed SPA event, hiding native identity until resolved', async () => {
    act(() => root.render(null)); mocks.readVideo.mockClear();
    let resolve!: (tab: chrome.tabs.Tab) => void;
    vi.mocked(chrome.tabs.get).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    render();
    expect(mocks.readVideo.mock.calls.every(([id]) => id === null)).toBe(true);
    await act(async () => resolve({ id: 1, url: 'https://www.coupangplay.com/play/00000000-0000-0000-0000-000000000002' } as chrome.tabs.Tab));
    expect(mocks.readVideo).toHaveBeenLastCalledWith('00000000-0000-0000-0000-000000000002');
  });

  it('does not let a delayed initial tab read overwrite a newer URL-only event', async () => {
    act(() => root.render(null));
    let resolve!: (tab: chrome.tabs.Tab) => void;
    vi.mocked(chrome.tabs.get).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    render();
    const listener = vi.mocked(chrome.tabs.onUpdated.addListener).mock.calls.at(-1)![0];
    act(() => listener(1, { url: 'https://www.coupangplay.com/play/00000000-0000-0000-0000-000000000002' }, {} as chrome.tabs.Tab));
    await act(async () => resolve(useTabStore.getState().activeTab!));
    expect(mocks.readVideo).toHaveBeenLastCalledWith('00000000-0000-0000-0000-000000000002');
  });

  it('keeps native identity hidden after a failed read and ignores a previous tab read', async () => {
    act(() => root.render(null));
    let resolve!: (tab: chrome.tabs.Tab) => void;
    vi.mocked(chrome.tabs.get).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    render();
    vi.mocked(chrome.tabs.get).mockRejectedValueOnce(new Error('tab closed'));
    await act(async () => useTabStore.setState({ activeTab: { id: 2, url: 'https://www.coupangplay.com/play/00000000-0000-0000-0000-000000000003' } as chrome.tabs.Tab }));
    await act(async () => resolve({ id: 1, url: 'https://www.coupangplay.com/play/00000000-0000-0000-0000-000000000001' } as chrome.tabs.Tab));
    expect(mocks.readVideo).toHaveBeenLastCalledWith(null);
  });
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

  it('resets search on source, tab and video changes but retains it for ordinary updates', async () => {
    search('hello'); mocks.state.activeIndex = 0; render();
    expect(container.querySelector('input')!.value).toBe('hello');
    mocks.state.subtitleId = 'ko'; render();
    expect(container.querySelector('input')!.value).toBe('');
    search('hello');
    await act(async () => useTabStore.setState({ activeTab: { id: 2 } as chrome.tabs.Tab }));
    expect(container.querySelector('input')!.value).toBe('');
    search('hello');
    await act(async () => useTabStore.setState({ activeTab: { id: 2, url: 'https://www.coupangplay.com/play/00000000-0000-0000-0000-000000000002' } as chrome.tabs.Tab }));
    expect(container.querySelector('input')!.value).toBe('');
  });
});

describe('analysis keyboard navigation', () => {
  it('keeps an offscreen navigation target mounted and focused while measured range changes', () => {
    mocks.windowed = true; render();
    expect(rows()).toHaveLength(1);
    press(rows()[0].querySelector<HTMLButtonElement>('[data-subtitle-play]')!, 'End');
    const target = container.querySelector<HTMLButtonElement>('[data-index="2"] [data-subtitle-play]')!;
    expect(document.activeElement).toBe(target);
    render();
    expect(document.activeElement).toBe(target);
    act(() => target.click());
    expect(mocks.play).toHaveBeenLastCalledWith(20);
    search('First');
    expect(rows()).toHaveLength(1);
    expect(container.querySelector('[data-index="2"]')).toBeNull();
  });
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
