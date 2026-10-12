import { updateTabInfo } from '@storage/tab';
import { sendMessageToTab } from '@utils/message';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { takePendingSubtitleRequest, takeViewAction } from './pending-actions';

vi.mock('@storage/tab', () => ({ updateTabInfo: vi.fn() }));
vi.mock('@utils/message', () => ({ onMessage: vi.fn(), sendMessageToTab: vi.fn() }));
vi.mock('./pending-actions', () => ({
  enqueueViewAction: vi.fn(),
  savePendingSubtitleRequest: vi.fn(),
  takePendingSubtitleRequest: vi.fn(),
  takeViewAction: vi.fn(),
}));

const VIDEO_URL = 'https://www.coupangplay.com/play/123e4567-e89b-12d3-a456-426614174000';
const onUpdated = vi.fn();

beforeEach(async () => {
  vi.resetModules();
  onUpdated.mockClear();
  vi.stubGlobal('chrome', {
    ...chrome,
    runtime: {
      ...chrome.runtime,
      onInstalled: { addListener: vi.fn() },
      getPlatformInfo: vi.fn(),
    },
    tabs: {
      ...chrome.tabs,
      onActivated: { addListener: vi.fn() },
      onUpdated: { addListener: onUpdated },
    },
    webRequest: { onSendHeaders: { addListener: vi.fn() } },
  });
  vi.mocked(updateTabInfo).mockReset().mockResolvedValue(undefined);
  vi.mocked(sendMessageToTab).mockReset();
  vi.mocked(takePendingSubtitleRequest).mockResolvedValue({ url: 'https://example.com/subtitles', headers: [] });
  vi.mocked(takeViewAction).mockResolvedValue({ url: VIDEO_URL, videoId: null, startTime: 42 });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await import('./index');
});

afterEach(() => vi.unstubAllGlobals());

describe('connection status persistence', () => {
  it.each([true, false])('continues tab processing after status write failure (ping success: %s)', async (connected) => {
    const storageError = new Error('session write failed');
    vi.mocked(updateTabInfo)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(storageError)
      .mockResolvedValue(undefined);
    if (connected) {
      const response = { success: true as const, data: { hasVideo: true } };
      vi.mocked(sendMessageToTab).mockResolvedValueOnce(response);
    } else {
      vi.mocked(sendMessageToTab).mockRejectedValueOnce(new Error('No receiver'));
    }
    vi.mocked(sendMessageToTab).mockResolvedValue({ success: true });
    const listener = onUpdated.mock.calls[0][0];

    await expect(listener(7, { status: 'complete' }, { id: 7, active: false, url: VIDEO_URL })).resolves.toBeUndefined();

    expect(updateTabInfo).toHaveBeenCalledTimes(2);
    expect(updateTabInfo).toHaveBeenLastCalledWith(7, {
      connectionStatus: connected ? 'connected' : 'disconnected',
      videoStatus: connected ? 'detected' : 'not_detected',
    });
    expect(console.error).toHaveBeenCalledWith('Error saving content connection status:', storageError);
    expect(sendMessageToTab).toHaveBeenCalledWith(7, 'resetElement');
    expect(sendMessageToTab).toHaveBeenCalledWith(7, 'detectVideo');
    expect(sendMessageToTab).toHaveBeenCalledWith(7, 'fetchVideoMetadata', {
      url: 'https://example.com/subtitles', headers: [],
    });
    expect(sendMessageToTab).toHaveBeenLastCalledWith(7, 'playVideo', { startTime: 42 });
  });
});
