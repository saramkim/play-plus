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
function Analysis() {
  const { subtitles } = useSubtitleAnalysis();
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
