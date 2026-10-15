import { getRegisteredSubtitles } from '@storage/registered-subtitle';
import { getLocalSubtitle } from '@storage/subtitle';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@storage/registered-subtitle', () => ({ getRegisteredSubtitles: vi.fn() }));
vi.mock('@storage/subtitle', () => ({ getLocalSubtitle: vi.fn() }));
vi.mock('./video-lifecycle/video-lifecycle-monitor', () => ({ VideoLifecycleMonitor: class { start() {} } }));

const id = 'subtitle-00000000-0000-0000-0000-000000000001';
const raw = [{ start: 10, end: 20, text: 'Uploaded cue' }];
let video: HTMLVideoElement;
let handler: typeof import('./message-handler');
let store: typeof import('./features/subtitle/subtitle-store');

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('location', { href: 'https://www.coupangplay.com/en/play/123e4567-e89b-12d3-a456-426614174000/episode' });
  video = document.createElement('video'); document.body.append(video);
  const { videoManager } = await import('./core/video/video-manager');
  vi.spyOn(videoManager, 'get').mockReturnValue(video);
  vi.spyOn(videoManager, 'isCurrent').mockImplementation((v) => v === video && v.isConnected);
  store = await import('./features/subtitle/subtitle-store');
  handler = await import('./message-handler');
  vi.mocked(getRegisteredSubtitles).mockReset().mockResolvedValue([
    { id, title: 'Test', language: 'en', savedAt: '2026-10-16', delay: 2 },
  ]);
  vi.mocked(getLocalSubtitle).mockReset().mockResolvedValue(raw);
});
afterEach(() => { video.remove(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('uploaded subtitle restoration after document reload', () => {
  it('retries a failed initial content status and stops after success', async () => {
    vi.useFakeTimers();
    const send = vi.mocked(chrome.runtime.sendMessage).mockReset();
    send.mockResolvedValueOnce({ success: false, message: 'Video changed' }).mockResolvedValueOnce({ success: true });
    const pending = handler.reportContentStatus(true);
    await vi.runAllTimersAsync();
    await pending;
    expect(send).toHaveBeenCalledTimes(2);
  });
  it('bounds retries and never retries a detached video', async () => {
    vi.useFakeTimers();
    const send = vi.mocked(chrome.runtime.sendMessage).mockReset().mockRejectedValue(new Error('Worker unavailable'));
    const pending = handler.reportContentStatus(true);
    await vi.runAllTimersAsync(); await pending;
    expect(send).toHaveBeenCalledTimes(3);
    send.mockClear(); video.remove();
    await handler.reportContentStatus(true);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('restores both roles using the current stored delay without applying it twice', async () => {
    const selection = { primarySubtitle: id, secondarySubtitle: id } as const;
    await expect(handler.handleRestoreUploadedSubtitles(selection)).resolves.toEqual({ success: true, data: selection });
    await handler.handleRestoreUploadedSubtitles(selection);
    expect(store.useSubtitleStore.getState().subtitleCache[id]).toEqual([{ start: 12, end: 22, text: 'Uploaded cue' }]);
    expect(raw[0].start).toBe(10);
    expect(getLocalSubtitle).toHaveBeenCalledTimes(2);
  });
  it('does not restore a selection explicitly cleared before the restore response arrives', async () => {
    await handler.handleSetSubtitle('setPrimarySubtitle', { subtitleId: null, delay: 0 });
    const result = await handler.handleRestoreUploadedSubtitles({ primarySubtitle: id, secondarySubtitle: null });
    expect(result).toEqual({ success: true, data: { primarySubtitle: null, secondarySubtitle: null } });
    expect(getLocalSubtitle).not.toHaveBeenCalled();
  });
  it.each(['selection', 'video', 'route'] as const)('rejects a stale body read after %s changes', async (change) => {
    let resolve!: (value: typeof raw) => void;
    vi.mocked(getLocalSubtitle).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const result = expect(handler.handleRestoreUploadedSubtitles({ primarySubtitle: id, secondarySubtitle: null })).rejects.toThrow();
    await vi.waitFor(() => expect(getLocalSubtitle).toHaveBeenCalled());
    if (change === 'selection') await handler.handleSetSubtitle('setPrimarySubtitle', { subtitleId: null, delay: 0 });
    if (change === 'video') video.remove();
    if (change === 'route') location.href = 'https://www.coupangplay.com/';
    resolve(raw); await result;
    expect(store.useSubtitleStore.getState().customSubtitleId.primarySubtitle).toBeNull();
    expect(store.useSubtitleStore.getState().subtitleCache[id]).toBeUndefined();
  });
  it('reconciles a deleted registered upload to the native subtitle selection', async () => {
    vi.mocked(getRegisteredSubtitles).mockResolvedValue([]);
    await expect(handler.handleRestoreUploadedSubtitles({ primarySubtitle: id, secondarySubtitle: null })).resolves.toEqual({
      success: true, data: { primarySubtitle: null, secondarySubtitle: null },
    });
    expect(getLocalSubtitle).not.toHaveBeenCalled();
  });
  it('keeps the response channel open for asynchronous restoration', async () => {
    vi.mocked(chrome.runtime.onMessage.addListener).mockClear();
    handler.initializeMessageListener();
    const listener = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0][0];
    const response = vi.fn();
    expect(listener({ message: 'restoreUploadedSubtitles', params: { primarySubtitle: id, secondarySubtitle: null } }, {}, response)).toBe(true);
    await vi.waitFor(() => expect(response).toHaveBeenCalledWith({ success: true, data: { primarySubtitle: id, secondarySubtitle: null } }));
  });
});
