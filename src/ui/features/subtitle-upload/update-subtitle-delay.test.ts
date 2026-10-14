import { updateRegisteredSubtitle } from '@storage/registered-subtitle';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTabStore } from '@/ui/store/tab-store';

import { SubtitleDelayApplyError, updateSubtitleDelay } from './update-subtitle-delay';

vi.mock('@storage/registered-subtitle', () => ({ updateRegisteredSubtitle: vi.fn() }));
const id = 'subtitle-00000000-0000-0000-0000-000000000001';
const videoId = '123e4567-e89b-12d3-a456-426614174000';
const tab = { id: 7, active: true, url: `https://www.coupangplay.com/en/play/${videoId}/episode` } as chrome.tabs.Tab;
beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(updateRegisteredSubtitle).mockReset().mockResolvedValue({ id, title: 'Keep', language: 'en', savedAt: '2026-01-01', delay: 2 });
  Object.assign(chrome.tabs, { get: vi.fn().mockResolvedValue(tab) });
  vi.mocked(chrome.tabs.sendMessage).mockReset().mockResolvedValue({ success: true });
  useTabStore.setState({ activeTab: tab, tabInfo: { primarySubtitle: id, secondarySubtitle: null } });
});
afterEach(() => { vi.useRealTimers(); });

describe('stored delay and current playback acknowledgement', () => {
  it.each(['primarySubtitle', 'secondarySubtitle'] as const)('waits for storage then an ack for %s', async (role) => {
    useTabStore.setState({ tabInfo: { [role]: id } });
    let resolve!: () => void;
    const write = new Promise<void>((done) => { resolve = done; });
    vi.mocked(updateRegisteredSubtitle).mockImplementationOnce(async () => { await write; return { id, title: 'Keep', language: 'en', savedAt: '2026-01-01' }; });
    const pending = updateSubtitleDelay(id, 2, tab);
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    resolve();
    await expect(pending).resolves.toBe('applied');
    expect(chrome.tabs.sendMessage).toHaveBeenCalledExactlyOnceWith(7, { message: 'updateSubtitleDelay', params: { subtitleId: id, delay: 2, expectedVideoId: videoId } });
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not send when storage fails or claim that storage failed after an apply failure', async () => {
    const storageError = new Error('quota');
    vi.mocked(updateRegisteredSubtitle).mockRejectedValueOnce(storageError);
    await expect(updateSubtitleDelay(id, 2, tab)).rejects.toBe(storageError);
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
  });
  it.each([undefined, { success: false, message: 'no video' }])('preserves the saved value for invalid ack %j', async (response) => {
    vi.mocked(chrome.tabs.sendMessage).mockResolvedValueOnce(response);
    await expect(updateSubtitleDelay(id, 2, tab)).rejects.toBeInstanceOf(SubtitleDelayApplyError);
    expect(updateRegisteredSubtitle).toHaveBeenCalledExactlyOnceWith(id, { delay: 2 });
    expect(vi.getTimerCount()).toBe(0);
  });
  it('handles rejected messages and a closed tab without another storage write', async () => {
    vi.mocked(chrome.tabs.sendMessage).mockRejectedValueOnce(new Error('port closed'));
    await expect(updateSubtitleDelay(id, 2, tab)).rejects.toBeInstanceOf(SubtitleDelayApplyError);
    vi.mocked(chrome.tabs.get).mockRejectedValueOnce(new Error('tab closed'));
    await expect(updateSubtitleDelay(id, 3, tab)).rejects.toBeInstanceOf(SubtitleDelayApplyError);
    expect(updateRegisteredSubtitle).toHaveBeenCalledTimes(2);
  });
  it.each(['tab', 'video', 'selection'])('does not report applied after the %s changes during acknowledgement', async (change) => {
    vi.mocked(chrome.tabs.sendMessage).mockImplementationOnce(async () => {
      if (change === 'tab') useTabStore.setState({ activeTab: { ...tab, id: 8 } });
      if (change === 'video') vi.mocked(chrome.tabs.get).mockResolvedValue({ ...tab, url: 'https://www.coupangplay.com/' });
      if (change === 'selection') useTabStore.setState({ tabInfo: {} });
      return { success: true };
    });
    await expect(updateSubtitleDelay(id, 2, tab)).rejects.toBeInstanceOf(SubtitleDelayApplyError);
  });
  it('treats unselected and absent targets as stored only', async () => {
    useTabStore.setState({ tabInfo: {} });
    await expect(updateSubtitleDelay(id, 2, tab)).resolves.toBe('stored');
    await expect(updateSubtitleDelay(id, 2, null)).resolves.toBe('stored');
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
  });
  it('times out, allows retry and ignores late acknowledgement without accumulating writes', async () => {
    let late!: (response: { success: boolean }) => void;
    vi.mocked(chrome.tabs.sendMessage).mockImplementationOnce(() => new Promise((resolve) => { late = resolve; }));
    const first = expect(updateSubtitleDelay(id, 2, tab)).rejects.toBeInstanceOf(SubtitleDelayApplyError);
    await vi.advanceTimersByTimeAsync(5000);
    await first;
    await expect(updateSubtitleDelay(id, 2, tab)).resolves.toBe('applied');
    late({ success: true });
    await Promise.resolve();
    expect(updateRegisteredSubtitle).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});
