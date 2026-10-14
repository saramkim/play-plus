import { TabInfo, updateTabInfo } from '@storage/tab';
import { NativeSubtitleBatch } from '@utils/native-subtitles';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { invalidateNativeSubtitles, persistNativeSubtitles } from './native-subtitles';

const A = '123e4567-e89b-12d3-a456-426614174000';
const B = '123e4567-e89b-12d3-a456-426614174001';
const cues = (text: string) => [{ start: 1, end: 2, text }];
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
};
const batch = (videoId = A, requestId = 1): NativeSubtitleBatch => ({
  videoId, requestId, en: { status: 'success', subtitleData: cues('English') }, ko: { status: 'failed' },
});
let info: TabInfo;
let route: string;
let getGate: ReturnType<typeof deferred> | undefined;
let setGate: ReturnType<typeof deferred> | undefined;
beforeEach(() => {
  info = { nativeVideoId: A, en: cues('old English'), ko: cues('기존'), connectionStatus: 'connected' };
  route = A; getGate = undefined; setGate = undefined;
  vi.stubGlobal('chrome', {
    ...chrome,
    tabs: { ...chrome.tabs, get: vi.fn(async () => ({ url: `https://www.coupangplay.com/play/${route}` })) },
  });
  vi.mocked(chrome.storage.session.get).mockImplementation(((_key: string, callback: (data: object) => void) => {
    const snapshot = { tab_7: { ...info } };
    const gate = getGate; getGate = undefined;
    if (gate) void gate.promise.then(() => callback(snapshot));
    else callback(snapshot);
  }) as typeof chrome.storage.session.get);
  vi.mocked(chrome.storage.session.set).mockReset().mockImplementation(async (values) => {
    const gate = setGate; setGate = undefined;
    if (gate) await gate.promise;
    info = (values as Record<string, TabInfo>).tab_7;
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('native subtitle session persistence', () => {
  it('writes both languages together, retaining failed same-video data and other fields', async () => {
    await persistNativeSubtitles(7, batch());
    expect(info).toMatchObject({ nativeVideoId: A, nativeRequestId: 1, en: cues('English'), ko: cues('기존'), connectionStatus: 'connected' });
    expect(chrome.storage.session.set).toHaveBeenCalledOnce();
  });
  it('never carries the previous video language into a new video', async () => {
    route = B;
    await persistNativeSubtitles(7, batch(B));
    expect(info).toMatchObject({ nativeVideoId: B, en: cues('English'), ko: null });
  });
  it('clears an absent language and reports all-failed acquisition as failure', async () => {
    await persistNativeSubtitles(7, { ...batch(), ko: { status: 'absent' } });
    expect(info.ko).toBeNull();
    await expect(persistNativeSubtitles(7, { ...batch(A, 2), en: { status: 'failed' } })).rejects.toThrow('acquisition failed');
    expect(info.en).toEqual(cues('English'));
  });
  it('rejects late A after B is saved and older same-video requests', async () => {
    route = B;
    await persistNativeSubtitles(7, batch(B, 3));
    const saved = { ...info };
    await expect(persistNativeSubtitles(7, batch(A, 1))).rejects.toThrow('Stale');
    await expect(persistNativeSubtitles(7, batch(B, 2))).rejects.toThrow('Stale');
    expect(info).toEqual(saved);
  });
  it('checks the actual URL after a deferred read, before starting a write', async () => {
    getGate = deferred(); const gate = getGate;
    const pending = expect(persistNativeSubtitles(7, batch())).rejects.toThrow('Stale');
    await vi.waitFor(() => expect(getGate).toBeUndefined());
    route = B; gate.resolve(); await pending;
    expect(chrome.storage.session.set).not.toHaveBeenCalled();
  });
  it('invalidates A when the route changes during an already-started write', async () => {
    setGate = deferred(); const gate = setGate;
    const pending = expect(persistNativeSubtitles(7, batch())).rejects.toThrow('Video changed');
    await vi.waitFor(() => expect(chrome.storage.session.set).toHaveBeenCalledOnce());
    route = B;
    const invalidated = invalidateNativeSubtitles(7);
    gate.resolve(); await Promise.all([pending, invalidated]);
    expect(info).toMatchObject({ nativeVideoId: B, en: null, ko: null, connectionStatus: 'connected' });
  });
  it('preserves B when a new batch follows a delayed A write and URL invalidation', async () => {
    setGate = deferred(); const gate = setGate;
    const old = expect(persistNativeSubtitles(7, batch())).rejects.toThrow('Video changed');
    await vi.waitFor(() => expect(chrome.storage.session.set).toHaveBeenCalledOnce());
    route = B;
    const invalidated = invalidateNativeSubtitles(7);
    const next = persistNativeSubtitles(7, batch(B, 2));
    gate.resolve(); await Promise.all([old, invalidated, next]);
    expect(info).toMatchObject({ nativeVideoId: B, nativeRequestId: 2, en: cues('English'), ko: null });
  });
  it.each(['get', 'set'])('serializes status and native writes during a delayed storage.%s', async (operation) => {
    const gate = deferred();
    if (operation === 'get') getGate = gate; else setGate = gate;
    const status = updateTabInfo(7, { videoStatus: 'detected' });
    await vi.waitFor(() => expect(operation === 'get' ? getGate : setGate).toBeUndefined());
    const native = persistNativeSubtitles(7, batch());
    const connection = updateTabInfo(7, { connectionStatus: 'disconnected' });
    gate.resolve(); await Promise.all([status, native, connection]);
    expect(info).toMatchObject({ videoStatus: 'detected', connectionStatus: 'disconnected', en: cues('English'), ko: cues('기존') });
  });
  it('recovers the queue after a failed write without acknowledging success', async () => {
    vi.mocked(chrome.storage.session.set).mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(persistNativeSubtitles(7, batch())).rejects.toThrow('storage unavailable');
    await persistNativeSubtitles(7, batch(A, 2));
    expect(info.nativeRequestId).toBe(2);
  });
});
