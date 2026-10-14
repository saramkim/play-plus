import { getLocalSubtitle } from '@storage/subtitle';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { videoManager } from './core/video/video-manager';
import { useSubtitleStore } from './features/subtitle/subtitle-store';
import { handleSetSubtitle, handleUpdateSubtitleDelay, initializeMessageListener } from './message-handler';

vi.mock('@storage/subtitle', () => ({ getLocalSubtitle: vi.fn() }));
vi.mock('./video-lifecycle/video-lifecycle-monitor', () => ({ VideoLifecycleMonitor: class { start() {} } }));
const id = 'subtitle-00000000-0000-0000-0000-000000000001';
const videoId = '123e4567-e89b-12d3-a456-426614174000';
const raw = [{ start: 10, end: 20, text: 'Original' }];
const params = { subtitleId: id, delay: 2, expectedVideoId: videoId } as const;
let video: HTMLVideoElement;
beforeEach(() => {
  vi.stubGlobal('location', { href: `https://www.coupangplay.com/en/play/${videoId}/episode` });
  video = document.createElement('video'); document.body.append(video);
  vi.spyOn(videoManager, 'get').mockReturnValue(video);
  vi.spyOn(videoManager, 'isCurrent').mockImplementation((v) => v === video && v.isConnected);
  vi.mocked(getLocalSubtitle).mockReset().mockResolvedValue(raw);
  useSubtitleStore.setState({ subtitleCache: {}, customSubtitleId: { primarySubtitle: id, secondarySubtitle: null } });
});
afterEach(() => { video.remove(); vi.unstubAllGlobals(); });

describe('custom subtitle delay acknowledgement', () => {
  it.each(['primarySubtitle', 'secondarySubtitle'] as const)('applies offset once to raw cues in %s, including retries', async (role) => {
    useSubtitleStore.setState({ customSubtitleId: { primarySubtitle: null, secondarySubtitle: null, [role]: id } });
    await expect(handleUpdateSubtitleDelay(params)).resolves.toEqual({ success: true });
    await handleUpdateSubtitleDelay(params);
    expect(useSubtitleStore.getState().subtitleCache[id]).toEqual([{ start: 12, end: 22, text: 'Original' }]);
    expect(raw).toEqual([{ start: 10, end: 20, text: 'Original' }]);
  });
  it('refreshes stale custom cache on reselection, while allowing the same subtitle in both roles', async () => {
    useSubtitleStore.getState().setSubtitleCache(id, [{ start: 99, end: 100, text: 'stale' }]);
    await Promise.all([
      handleSetSubtitle('setPrimarySubtitle', { subtitleId: id, delay: 3 }),
      handleSetSubtitle('setSecondarySubtitle', { subtitleId: id, delay: 3 }),
    ]);
    expect(useSubtitleStore.getState().customSubtitleId).toEqual({ primarySubtitle: id, secondarySubtitle: id });
    expect(useSubtitleStore.getState().subtitleCache[id]?.[0].start).toBe(13);
  });
  it.each(['video', 'route', 'source', 'selection'])('rejects a late read after %s changes without updating cache', async (change) => {
    let resolve!: (cues: typeof raw) => void;
    vi.mocked(getLocalSubtitle).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const result = expect(handleUpdateSubtitleDelay(params)).rejects.toThrow();
    if (change === 'video') video.remove();
    if (change === 'route') location.href = 'https://www.coupangplay.com/';
    if (change === 'source') video.src = 'https://example.test/new.mp4';
    if (change === 'selection') useSubtitleStore.getState().setCustomSubtitleId('primarySubtitle', null);
    resolve(raw); await result;
    expect(useSubtitleStore.getState().subtitleCache[id]).toBeUndefined();
  });
  it('rejects the wrong route and unselected subtitle before reading', async () => {
    await expect(handleUpdateSubtitleDelay({ ...params, expectedVideoId: 'wrong' })).rejects.toThrow();
    useSubtitleStore.setState({ customSubtitleId: { primarySubtitle: null, secondarySubtitle: null } });
    await expect(handleUpdateSubtitleDelay(params)).rejects.toThrow();
    expect(getLocalSubtitle).not.toHaveBeenCalled();
  });
  it('does not let an older different offset overwrite the latest cache', async () => {
    let resolve!: (cues: typeof raw) => void;
    vi.mocked(getLocalSubtitle).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const old = expect(handleUpdateSubtitleDelay({ ...params, delay: 4 })).rejects.toThrow();
    await handleUpdateSubtitleDelay({ ...params, delay: 5 });
    resolve(raw); await old;
    expect(useSubtitleStore.getState().subtitleCache[id]?.[0].start).toBe(15);
  });
  it('does not reselect a role after a pending selection was toggled off', async () => {
    let resolve!: (cues: typeof raw) => void;
    vi.mocked(getLocalSubtitle).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const old = expect(handleSetSubtitle('setPrimarySubtitle', { subtitleId: id, delay: 2 })).rejects.toThrow();
    await handleSetSubtitle('setPrimarySubtitle', { subtitleId: null, delay: 0 });
    resolve(raw); await old;
    expect(useSubtitleStore.getState().customSubtitleId.primarySubtitle).toBeNull();
  });
  it.each(['updateSubtitleDelay', 'setPrimarySubtitle', 'setSecondarySubtitle'])('keeps the %s response channel open and reports read rejection', async (message) => {
    vi.mocked(chrome.runtime.onMessage.addListener).mockClear();
    initializeMessageListener();
    const listener = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0][0];
    vi.mocked(getLocalSubtitle).mockRejectedValueOnce(new Error('missing body'));
    const response = vi.fn();
    expect(listener({ message, params }, {}, response)).toBe(true);
    await vi.waitFor(() => expect(response).toHaveBeenCalledExactlyOnceWith({ success: false, message: 'error_try_later' }));
  });
});
