import { act } from 'react';

import { getLocalSubtitle } from '@storage/subtitle';
import { SubtitleMetadata } from '@storage/type';
import { createRoot, Root } from 'react-dom/client';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTabStore } from '@/ui/store/tab-store';

import { findCompanionCues, useAnalysisCompanion } from './use-analysis-companion';

const uploads = vi.hoisted(() => ({ items: [] as SubtitleMetadata[] }));
vi.mock('@storage/subtitle', () => ({ getLocalSubtitle: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/ui/features/subtitle-upload/use-uploaded-subtitles', () => ({ useUploadedSubtitles: () => ({ subtitles: uploads.items }) }));
const first = 'subtitle-00000000-0000-0000-0000-000000000001';
const second = 'subtitle-00000000-0000-0000-0000-000000000002';
const cues = [{ start: 1, end: 3, text: '<b>companion</b>' }];
let result: ReturnType<typeof useAnalysisCompanion>;
let root: Root;
let host: HTMLDivElement;
function Harness({ primary = 'en', video = 'A' }: { primary?: string; video?: string }) {
  result = useAnalysisCompanion(primary, video);
  return <div>{JSON.stringify(result.cues)}</div>;
}
const render = (primary = 'en', video = 'A') => act(async () => root.render(<Harness primary={primary} video={video} />));
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  uploads.items = ([first, second] as const).map((id) => ({ id, title: id, language: 'ko', savedAt: '', delay: 2 }));
  useTabStore.setState({ tabInfo: { nativeVideoId: 'A', en: cues, ko: cues } });
  vi.mocked(getLocalSubtitle).mockReset().mockResolvedValue(cues);
  vi.mocked(toast.error).mockClear();
  vi.mocked(chrome.storage.local.onChanged.addListener).mockClear();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('companion sources', () => {
  it('defaults to none, excludes primary and never writes settings or sources', async () => {
    await render();
    expect(result.selectedId).toBe(''); expect(result.cues).toEqual([]);
    expect(result.options.map(({ id }) => id)).toEqual(['ko', first, second]);
    await act(async () => result.setSelectedId('en'));
    expect(result.selectedId).toBe('');
    await act(async () => result.setSelectedId('ko'));
    expect(result.cues).toEqual([{ start: 1, end: 3, text: 'companion' }]);
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });
  it('gates native identity and clears unavailable selections rather than restoring them later', async () => {
    await render(); await act(async () => result.setSelectedId('ko'));
    await act(async () => useTabStore.setState({ tabInfo: { nativeVideoId: 'B', ko: cues } }));
    expect(result.selectedId).toBe(''); expect(result.cues).toEqual([]);
    await act(async () => useTabStore.setState({ tabInfo: { nativeVideoId: 'A', ko: cues } }));
    expect(result.cues).toEqual([]);
  });
  it('applies stored delay without mutation and rejects late reads after a source switch', async () => {
    const original = structuredClone(cues);
    let finish!: (value: typeof cues) => void;
    vi.mocked(getLocalSubtitle).mockImplementationOnce(() => new Promise((done) => { finish = done; }));
    await render(); await act(async () => result.setSelectedId(first));
    expect(result.cues).toEqual([]);
    await act(async () => result.setSelectedId(second));
    expect(result.cues).toEqual([{ start: 3, end: 5, text: 'companion' }]);
    await act(async () => finish([{ start: 0, end: 1, text: 'stale' }]));
    expect(host.textContent).not.toContain('stale'); expect(cues).toEqual(original);
    uploads.items = uploads.items.map((item) => ({ ...item, delay: -1 }));
    await render(); expect(result.cues[0].start).toBe(0);
  });
  it('hides deleted metadata and does not revive its old selection on re-registration', async () => {
    await render(); await act(async () => result.setSelectedId(first));
    const previous = uploads.items; uploads.items = [];
    await render(); expect(result.cues).toEqual([]); expect(result.selectedId).toBe('');
    uploads.items = previous; await render(); expect(result.cues).toEqual([]);
  });
  it('clears a removed body immediately and rejects an older in-flight reload', async () => {
    await render(); await act(async () => result.setSelectedId(first));
    const listener = vi.mocked(chrome.storage.local.onChanged.addListener).mock.calls.at(-1)![0];
    let finish!: (value: typeof cues) => void;
    vi.mocked(getLocalSubtitle).mockImplementationOnce(() => new Promise((done) => { finish = done; }));
    await act(async () => listener({ [first]: { newValue: cues } }));
    expect(result.cues).toEqual([]);
    vi.mocked(getLocalSubtitle).mockRejectedValueOnce(new Error('missing'));
    await act(async () => listener({ [first]: { oldValue: cues } }));
    await act(async () => finish(cues));
    expect(result.cues).toEqual([]);
    expect(toast.error).toHaveBeenCalledExactlyOnceWith('error_try_later');
  });
  it('ignores a read rejection after unmount', async () => {
    let reject!: (reason: Error) => void;
    vi.mocked(getLocalSubtitle).mockImplementationOnce(() => new Promise((_done, fail) => { reject = fail; }));
    await render(); await act(async () => result.setSelectedId(first));
    await act(async () => root.render(null));
    await act(async () => reject(new Error('late')));
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe('positive temporal overlap', () => {
  it('preserves source order for 1:N and N:1, excluding touches, zero lengths and gaps', () => {
    const support = [
      { start: 3, end: 7, text: 'later first in source' },
      { start: 0, end: 5, text: 'long overlap' },
      { start: 2, end: 2, text: 'zero' },
      { start: 4, end: 6, text: 'boundary' },
    ];
    expect(findCompanionCues({ start: 1, end: 4, text: 'primary' }, support)).toEqual([support[0], support[1]]);
    expect(findCompanionCues({ start: 5, end: 6, text: 'primary 2' }, support)).toEqual([support[0], support[3]]);
    expect(findCompanionCues({ start: 8, end: 9, text: 'gap' }, support)).toEqual([]);
    expect(findCompanionCues({ start: 2, end: 2, text: 'zero primary' }, support)).toEqual([]);
  });
});
