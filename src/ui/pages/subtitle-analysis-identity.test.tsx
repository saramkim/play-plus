import { act } from 'react';

import { sendMessageToTab } from '@utils/message';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

import { useTabStore } from '@/ui/store/tab-store';

import { SubtitleAnalysisPage } from './subtitle-analysis-page';

vi.mock('@utils/message', () => ({ sendMessageToTab: vi.fn(), onMessage: () => ({ remove: vi.fn() }) }));
vi.mock('@/ui/store/page-store', () => ({ usePageParams: () => ({ id: 'en' }) }));
vi.mock('@/ui/features/subtitle/use-saved-subtitle', () => ({ useSavedSubtitle: () => ({ subtitles: [] }) }));
vi.mock('@/ui/features/subtitle-upload/use-uploaded-subtitles', () => {
  const subtitles: never[] = [];
  return { useUploadedSubtitles: () => ({ subtitles }) };
});
vi.mock('@/ui/features/subtitle-upload/uploaded-subtitle-select', () => ({ UploadedSubtitleSelect: () => null }));
vi.mock('@tanstack/react-virtual', () => ({ useVirtualizer: ({ count }: { count: number }) => ({
  getTotalSize: () => count * 61,
  getVirtualItems: () => Array.from({ length: count }, (_, index) => ({ index, key: index, start: index * 61 })),
  measureElement: vi.fn(), scrollToIndex: vi.fn(), scrollToOffset: vi.fn(),
}) }));

it('shows current B on late Analysis entry with cached URL A and no post-mount URL event, never displaying A', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const A = '00000000-0000-0000-0000-000000000001';
  const B = '00000000-0000-0000-0000-000000000002';
  let resolve!: (tab: chrome.tabs.Tab) => void;
  Object.assign(chrome.tabs, {
    get: vi.fn(() => new Promise<chrome.tabs.Tab>((done) => { resolve = done; })),
    onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
  });
  const timeResponse = { success: true as const, data: 0 };
  vi.mocked(sendMessageToTab).mockResolvedValue(timeResponse);
  useTabStore.setState({
    activeTab: { id: 7, url: `https://www.coupangplay.com/play/${A}` } as chrome.tabs.Tab,
    tabInfo: { nativeVideoId: B, en: [{ start: 1, end: 2, text: 'current B' }] },
  });
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<SubtitleAnalysisPage />));
    expect(container.textContent).not.toContain('current B');
    expect(chrome.tabs.get).toHaveBeenCalledExactlyOnceWith(7);
    await act(async () => resolve({ id: 7, url: `https://www.coupangplay.com/play/${B}` } as chrome.tabs.Tab));
    expect(container.textContent).toContain('current B');
    await act(async () => useTabStore.setState({ tabInfo: { nativeVideoId: A, en: [{ start: 1, end: 2, text: 'stale A' }] } }));
    expect(container.textContent).not.toContain('stale A');
    expect(container.querySelector('[data-subtitle-play]')).toBeNull();
  } finally {
    await act(async () => root.unmount()); container.remove();
  }
});
