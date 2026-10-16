import { TabInfo } from '@storage/tab';
import { sendMessage } from '@utils/message';
import { NativeSubtitleBatch } from '@utils/native-subtitles';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { persistNativeSubtitles } from '@/background/native-subtitles';

import { videoManager } from './core/video/video-manager';
import { coupangStrategy } from './coupang-play';
import { useSubtitleStore } from './features/subtitle/subtitle-store';
import { handleFetchVideoMetadata, invalidateNativeSubtitles } from './native-subtitles';
import { VideoLifecycleMonitor } from './video-lifecycle/video-lifecycle-monitor';

vi.mock('@utils/message', () => ({ sendMessage: vi.fn() }));
const A = '123e4567-e89b-12d3-a456-426614174000';
const B = '123e4567-e89b-12d3-a456-426614174001';
const customId = 'subtitle-00000000-0000-0000-0000-000000000001';
const cues = (text: string) => [{ start: 1, end: 2, text }];
const tracks = [{ lang: 'en', result: { status: 'success' as const, subtitleData: cues('English') } },
  { lang: 'ko', result: { status: 'failed' as const } }];
const params = { url: 'https://example.test/metadata', headers: [] };
const route = (id: string) => { location.href = `https://www.coupangplay.com/play/${id}`; };
beforeEach(() => {
  vi.stubGlobal('location', { href: '' }); route(A);
  invalidateNativeSubtitles(null); invalidateNativeSubtitles(A);
  useSubtitleStore.setState({ subtitleCache: { en: cues('old'), ko: cues('기존'), [customId]: cues('custom') } });
  vi.spyOn(videoManager, 'get').mockReturnValue(null);
  vi.spyOn(coupangStrategy, 'fetchSubtitles').mockResolvedValue(tracks);
  vi.mocked(sendMessage).mockReset().mockResolvedValue({ success: true });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.innerHTML = ''; });

describe('native acquisition isolation', () => {
  it('allows startup without a video, keeps same-video failed data and publishes one batch', async () => {
    await expect(handleFetchVideoMetadata(params)).resolves.toEqual({ success: true });
    expect(useSubtitleStore.getState().subtitleCache).toEqual({ en: cues('English'), ko: cues('기존'), [customId]: cues('custom') });
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith('updateSubtitles', expect.objectContaining({ videoId: A, en: tracks[0].result, ko: tracks[1].result }));
  });
  it('invalidates only native caches on a route transition, preserving custom roles/settings', async () => {
    const before = useSubtitleStore.getState();
    route(B); invalidateNativeSubtitles(B);
    expect(useSubtitleStore.getState().subtitleCache).toEqual({ [customId]: cues('custom') });
    await handleFetchVideoMetadata(params);
    expect(useSubtitleStore.getState().subtitleCache).toEqual({ en: cues('English'), [customId]: cues('custom') });
    expect(useSubtitleStore.getState().customSubtitleId).toBe(before.customSubtitleId);
    expect(useSubtitleStore.getState().subtitleSettings).toBe(before.subtitleSettings);
  });
  it('clears absent languages and preserves first duplicate priority even if it failed', async () => {
    vi.mocked(coupangStrategy.fetchSubtitles).mockResolvedValueOnce([
      { lang: 'en', result: { status: 'failed' } }, tracks[0],
    ]);
    await handleFetchVideoMetadata(params);
    expect(useSubtitleStore.getState().subtitleCache).toEqual({ en: cues('old'), [customId]: cues('custom') });
    expect(sendMessage).toHaveBeenLastCalledWith('updateSubtitles', expect.objectContaining({ en: { status: 'failed' }, ko: { status: 'absent' } }));
  });
  it.each(['video source', 'video replacement'])('keeps same-title subtitles when %s changes during acquisition', async (change) => {
    useSubtitleStore.setState({ subtitleCache: {} });
    let tabInfo: TabInfo = {};
    vi.stubGlobal('chrome', {
      ...chrome,
      tabs: { ...chrome.tabs, get: vi.fn(async () => ({ url: location.href })) },
      storage: {
        ...chrome.storage,
        session: {
          ...chrome.storage.session,
          get: vi.fn((_key: string, callback: (data: object) => void) => callback({ tab_7: tabInfo })),
          set: vi.fn(async (values: { tab_7: TabInfo }) => { tabInfo = values.tab_7; }),
        },
      },
    });
    vi.mocked(sendMessage).mockImplementationOnce(async (...args: unknown[]) => {
      await persistNativeSubtitles(7, args[1] as NativeSubtitleBatch);
      return { success: true as const };
    });
    const video = document.createElement('video'); document.body.append(video);
    vi.mocked(videoManager.get).mockReturnValue(video);
    vi.spyOn(videoManager, 'isCurrent').mockImplementation((candidate) => candidate === video && video.isConnected);
    let finish!: (value: typeof tracks) => void;
    vi.mocked(coupangStrategy.fetchSubtitles).mockImplementationOnce(() => new Promise((done) => { finish = done; }));
    const pending = handleFetchVideoMetadata(params);
    if (change === 'video source') video.src = 'https://example.test/same-title-new-source.mp4';
    else video.remove();
    finish([tracks[0], { lang: 'ko', result: { status: 'success', subtitleData: cues('한국어') } }]);
    await expect(pending).resolves.toEqual({ success: true });
    expect(useSubtitleStore.getState().subtitleCache).toEqual({ en: cues('English'), ko: cues('한국어') });
    expect(tabInfo).toMatchObject({ nativeVideoId: A, en: cues('English'), ko: cues('한국어') });
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith('updateSubtitles', expect.objectContaining({
      videoId: A,
      en: { status: 'success', subtitleData: cues('English') },
      ko: { status: 'success', subtitleData: cues('한국어') },
    }));
  });
  it.each(['route', 'newer request'])('rejects a delayed request after %s changes', async (change) => {
    const video = document.createElement('video'); document.body.append(video);
    vi.mocked(videoManager.get).mockReturnValue(video);
    vi.spyOn(videoManager, 'isCurrent').mockImplementation((candidate) => candidate === video && video.isConnected);
    let finish!: (value: typeof tracks) => void;
    vi.mocked(coupangStrategy.fetchSubtitles).mockImplementationOnce(() => new Promise((done) => { finish = done; }));
    const pending = expect(handleFetchVideoMetadata(params)).rejects.toThrow('target changed');
    if (change === 'route') { route(B); invalidateNativeSubtitles(B); }
    if (change === 'newer request') await handleFetchVideoMetadata(params);
    const before = useSubtitleStore.getState().subtitleCache;
    finish(tracks); await pending;
    expect(useSubtitleStore.getState().subtitleCache).toBe(before);
    expect(sendMessage).toHaveBeenCalledTimes(change === 'newer request' ? 1 : 0);
  });
  it('does not turn a persistence/all-failed rejection into a success acknowledgement', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce({ success: false, message: 'Native subtitle acquisition failed' });
    await expect(handleFetchVideoMetadata(params)).resolves.toEqual({ success: false, message: 'Native subtitle acquisition failed' });
  });

  it('does not invalidate a new episode request with the lifecycle monitor\'s previous route', async () => {
    document.body.innerHTML = '<div id="playerWrapper"><video data-cy="main-video"></video></div>';
    const video = document.querySelector('video')!;
    video.src = 'blob:https://www.coupangplay.com/old';
    const monitor = new VideoLifecycleMonitor();
    monitor.start((event) => invalidateNativeSubtitles(event.videoId));
    let finish!: (value: typeof tracks) => void;
    vi.mocked(coupangStrategy.fetchSubtitles).mockImplementationOnce(() => new Promise((done) => { finish = done; }));
    try {
      // The page changes URL before its new player signals reach the isolated world.
      route(B);
      const pending = handleFetchVideoMetadata(params);
      video.src = 'blob:https://www.coupangplay.com/new';
      monitor.refresh();
      finish([tracks[0], { lang: 'ko', result: { status: 'success', subtitleData: cues('한국어') } }]);
      await expect(pending).resolves.toEqual({ success: true });
      expect(useSubtitleStore.getState().subtitleCache).toMatchObject({ en: cues('English'), ko: cues('한국어') });
      expect(sendMessage).toHaveBeenCalledExactlyOnceWith('updateSubtitles', expect.objectContaining({ videoId: B }));
    } finally { monitor.stop(); }
  });
});

describe('v1 SDH fallback through the real metadata adapter', () => {
  const valid = (text: string) => `WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n${text}`;
  const track = (lang: string, src: unknown = lang) => ({ kind: 'subtitles', srclang: lang, src });
  const acquire = async (descriptors: unknown[]) => {
    vi.mocked(coupangStrategy.fetchSubtitles).mockRestore();
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (input === params.url) return new Response(JSON.stringify({ data: { raw: { text_tracks: descriptors } } }));
      if (input === 'fail') return new Response('', { status: 503 });
      return new Response(valid(String(input)));
    });
    await handleFetchVideoMetadata(params);
    return fetcher;
  };

  it.each(['en', 'ko'] as const)('uses exact %s SDH only when regular is absent', async (language) => {
    await acquire([track(`${language} sdh`)]);
    expect(useSubtitleStore.getState().subtitleCache[language]).toEqual(cues(`${language} sdh`));
    expect(sendMessage).toHaveBeenLastCalledWith('updateSubtitles', expect.objectContaining({
      [language]: { status: 'success', subtitleData: cues(`${language} sdh`) },
    }));
  });

  it.each(['en', 'ko'] as const)('preserves first %s regular over earlier SDH and later duplicates', async (language) => {
    await acquire([track(`${language} sdh`), track(language, 'regular'), track(language, 'duplicate')]);
    expect(useSubtitleStore.getState().subtitleCache[language]).toEqual(cues('regular'));
  });

  it.each(['fail', 42])('does not fall through a failed/malformed regular (%s) to SDH', async (source) => {
    await acquire([track('en sdh'), track('en', source), track('en', 'later')]);
    expect(useSubtitleStore.getState().subtitleCache.en).toEqual(cues('old'));
    expect(sendMessage).toHaveBeenLastCalledWith('updateSubtitles', expect.objectContaining({ en: { status: 'failed' } }));
  });

  it.each([null, undefined, ''])('retains missing URL exclusion (%s) before SDH selection', async (source) => {
    await acquire([{ kind: 'subtitles', srclang: 'en', src: source }, track('en sdh')]);
    expect(useSubtitleStore.getState().subtitleCache.en).toEqual(cues('en sdh'));
  });

  it('keeps failed first SDH rather than later duplicate or alternate URL, and does not inherit across videos', async () => {
    route(B); invalidateNativeSubtitles(B);
    vi.mocked(sendMessage).mockResolvedValueOnce({ success: false, message: 'Native subtitle acquisition failed' });
    const fetcher = await acquire([
      { ...track('en sdh', 'fail'), sources: [{ src: 'alternate' }] }, track('en sdh', 'later'),
    ]);
    expect(useSubtitleStore.getState().subtitleCache.en).toBeUndefined();
    expect(sendMessage).toHaveBeenLastCalledWith('updateSubtitles', expect.objectContaining({ en: { status: 'failed' } }));
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([params.url, 'fail', 'later']);
  });

  it('preserves same-video good cache when selected SDH fails', async () => {
    await acquire([track('ko sdh', 'fail')]);
    expect(useSubtitleStore.getState().subtitleCache.ko).toEqual(cues('기존'));
  });

  it('does not normalize labels, broaden kind, or change the empty-src policy', async () => {
    const fetcher = await acquire([
      { ...track('en sdh'), kind: 'captions' }, track('EN sdh'), track('en SDH'), track('en-sdh'), track('ko sdh '),
      { ...track('ko', ''), sources: [{ src: 'alternate' }] }, track('ko sdh'),
    ]);
    expect(useSubtitleStore.getState().subtitleCache.en).toBeUndefined();
    expect(useSubtitleStore.getState().subtitleCache.ko).toEqual(cues('ko sdh'));
    expect(fetcher.mock.calls.some(([url]) => url === 'alternate')).toBe(false);
  });

  it('rejects delayed SDH results after a video change', async () => {
    let finish!: (value: Awaited<ReturnType<typeof coupangStrategy.fetchSubtitles>>) => void;
    vi.mocked(coupangStrategy.fetchSubtitles).mockImplementationOnce(() => new Promise((done) => { finish = done; }));
    const pending = expect(handleFetchVideoMetadata(params)).rejects.toThrow('target changed');
    route(B); invalidateNativeSubtitles(B);
    finish([{ lang: 'en sdh', result: { status: 'success', subtitleData: cues('stale SDH') } }]);
    await pending;
    expect(sendMessage).not.toHaveBeenCalled();
    expect(useSubtitleStore.getState().subtitleCache.en).toBeUndefined();
  });
});
