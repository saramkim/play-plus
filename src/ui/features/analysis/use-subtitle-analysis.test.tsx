import { act } from 'react';

import { getLocalSubtitle } from '@storage/subtitle';
import { createRoot, Root } from 'react-dom/client';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTabStore } from '@/ui/store/tab-store';

import { useSubtitleAnalysis } from './use-subtitle-analysis';

vi.mock('@storage/subtitle', () => ({ getLocalSubtitle: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/ui/features/subtitle/use-saved-subtitle', () => ({ useSavedSubtitle: () => ({ subtitles: [] }) }));
vi.mock('@/ui/features/subtitle-upload/use-uploaded-subtitles', () => {
  const subtitles = [{ id: 'subtitle-00000000-0000-0000-0000-000000000001', delay: 2 }];
  return { useUploadedSubtitles: () => ({ subtitles }) };
});
vi.mock('@/ui/store/page-store', () => ({ usePageParams: () => ({ id: 'subtitle-00000000-0000-0000-0000-000000000001' }) }));

let root: Root;
let container: HTMLDivElement;
let mounted: boolean;
let analysis: ReturnType<typeof useSubtitleAnalysis>;
function Analysis({ videoId = null }: { videoId?: string | null }) {
  analysis = useSubtitleAnalysis(videoId);
  const { subtitles } = analysis;
  return <div>{JSON.stringify(subtitles)}</div>;
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  useTabStore.setState({ activeTab: null, tabInfo: null });
  vi.mocked(toast.error).mockClear();
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container); mounted = true;
});
afterEach(async () => { if (mounted) await act(async () => root.unmount()); container.remove(); });
describe('analysis subtitle read errors', () => {
  it('reports a missing body without an unhandled rejection', async () => {
    vi.mocked(getLocalSubtitle).mockRejectedValueOnce(new Error('missing'));
    await act(async () => root.render(<Analysis />));
    expect(container.textContent).toBe('[]');
    expect(toast.error).toHaveBeenCalledExactlyOnceWith('error_try_later');
  });
  it('does not report a stale read error after leaving analysis', async () => {
    let reject!: (error: Error) => void;
    vi.mocked(getLocalSubtitle).mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
    await act(async () => root.render(<Analysis />));
    await act(async () => root.unmount()); mounted = false;
    await act(async () => reject(new Error('late')));
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe('native analysis video identity', () => {
  it('hides stale rows/options synchronously on URL change and exposes only matching native data', async () => {
    const cues = [{ start: 1, end: 2, text: '<b>English</b>' }];
    vi.mocked(getLocalSubtitle).mockResolvedValue([]);
    useTabStore.setState({ tabInfo: { nativeVideoId: 'A', en: cues, ko: null } });
    await act(async () => root.render(<Analysis videoId='A' />));
    await act(async () => analysis.setSubtitleId('en'));
    expect(container.textContent).toContain('English');
    expect(container.textContent).not.toContain('<b>');
    expect(analysis.defaultSubtitleOptions.map(({ id }) => id)).toEqual(['en']);
    await act(async () => root.render(<Analysis videoId='B' />));
    expect(container.textContent).toBe('[]');
    expect(analysis.defaultSubtitleOptions).toEqual([]);
    await act(async () => useTabStore.setState({ tabInfo: { nativeVideoId: 'B', en: null, ko: [{ start: 3, end: 4, text: '현재' }] } }));
    await act(async () => analysis.setSubtitleId('ko'));
    expect(container.textContent).toContain('현재');
    await act(async () => useTabStore.setState({ tabInfo: { nativeVideoId: 'A', en: cues, ko: cues } }));
    expect(container.textContent).toBe('[]');
    expect(analysis.defaultSubtitleOptions).toEqual([]);
  });
  it('does not interpret legacy unscoped native data as current, while custom data remains available', async () => {
    const custom = [{ start: 1, end: 2, text: 'uploaded' }];
    vi.mocked(getLocalSubtitle).mockResolvedValue(custom);
    useTabStore.setState({ tabInfo: { en: custom } });
    await act(async () => root.render(<Analysis videoId='A' />));
    expect(container.textContent).toContain('uploaded');
    expect(analysis.defaultSubtitleOptions).toEqual([]);
    await act(async () => analysis.setSubtitleId('en'));
    expect(container.textContent).toBe('[]');
  });
});
