import { beforeEach, describe, expect, it, vi } from 'vitest';

import { onMessage, sendMessage, sendMessageToTab } from './index';

beforeEach(() => {
  vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ success: true });
  vi.mocked(chrome.tabs.sendMessage).mockResolvedValue({ success: true });
});

describe('message transport', () => {
  it('preserves falsy runtime and tab message payloads', async () => {
    await sendMessage('playVideo', { startTime: 0 });
    await sendMessageToTab(7, 'playVideo', { startTime: 0 });

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ message: 'playVideo', params: { startTime: 0 } });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(7, { message: 'playVideo', params: { startTime: 0 } });
  });

  it('omits params for messages without payloads', async () => {
    await sendMessage('resetElement');
    await sendMessageToTab(7, 'resetElement');

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ message: 'resetElement' });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(7, { message: 'resetElement' });
  });

  it('forwards the keepalive return and removes the registered listener', () => {
    const callback = vi.fn(() => true as const);
    const registration = onMessage(callback);
    const listener = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0]?.[0];

    expect(listener).toBeDefined();
    expect(listener?.(
      { message: 'contentStatus', params: { hasVideo: true, isVideoUrl: true } },
      {},
      vi.fn()
    )).toBe(true);

    registration.remove();

    expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalledWith(listener);
  });
});
