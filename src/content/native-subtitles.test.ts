import { sendMessage } from '@utils/message';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { videoManager } from './core/video/video-manager';
import { coupangStrategy } from './coupang-play';
import { useSubtitleStore } from './features/subtitle/subtitle-store';
import { handleFetchVideoMetadata, invalidateNativeSubtitles } from './native-subtitles';

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
  it.each(['route', 'newer request', 'video source', 'video replacement'])('rejects a delayed request after %s changes', async (change) => {
    const video = document.createElement('video'); document.body.append(video);
    vi.mocked(videoManager.get).mockReturnValue(video);
    vi.spyOn(videoManager, 'isCurrent').mockImplementation((candidate) => candidate === video && video.isConnected);
    let finish!: (value: typeof tracks) => void;
    vi.mocked(coupangStrategy.fetchSubtitles).mockImplementationOnce(() => new Promise((done) => { finish = done; }));
    const pending = expect(handleFetchVideoMetadata(params)).rejects.toThrow('target changed');
    if (change === 'route') { route(B); invalidateNativeSubtitles(B); }
    if (change === 'newer request') await handleFetchVideoMetadata(params);
    if (change === 'video source') video.src = 'https://example.test/new.mp4';
    if (change === 'video replacement') video.remove();
    const before = useSubtitleStore.getState().subtitleCache;
    finish(tracks); await pending;
    expect(useSubtitleStore.getState().subtitleCache).toBe(before);
    expect(sendMessage).toHaveBeenCalledTimes(change === 'newer request' ? 1 : 0);
  });
  it('does not turn a persistence/all-failed rejection into a success acknowledgement', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce({ success: false, message: 'Native subtitle acquisition failed' });
    await expect(handleFetchVideoMetadata(params)).resolves.toEqual({ success: false, message: 'Native subtitle acquisition failed' });
  });
});
