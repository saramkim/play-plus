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

  it('sends typed OpenSubtitles runtime messages', async () => {
    await sendMessage('searchOpenSubtitles', { query: 'Example', language: 'en' });
    await sendMessage('downloadOpenSubtitle', { fileId: 11, language: 'en' });

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      message: 'searchOpenSubtitles',
      params: { query: 'Example', language: 'en' },
    });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      message: 'downloadOpenSubtitle',
      params: { fileId: 11, language: 'en' },
    });
  });

  it('preserves the direct listening boundary and sends only progress facts to background', async () => {
    const identity = {
      contentInstanceId: 'content-listening',
      routeChangedAt: 1_000,
      videoId: 'video-listening',
      videoRevision: 2,
    };
    const segmentKey = `segment-v1-${'a'.repeat(64)}` as const;
    const result = {
      videoId: 'video-listening',
      learningSourceKey: 'native:en' as const,
      segmenterVersion: 1 as const,
      practicedAt: '2026-08-09T00:00:00.000Z',
      bestCombo: 0,
      items: [
        {
          segmentKey,
          achievedState: 'attempted' as const,
          submittedAttemptIncrement: 0,
        },
      ],
    };

    await sendMessageToTab(7, 'getListeningCatalog');
    await sendMessageToTab(7, 'beginListeningSession', {
      expectedIdentity: identity,
      expectedSubtitleRevision: 3,
      segmentKeys: [segmentKey],
    });
    await sendMessageToTab(7, 'heartbeatListeningSession', {
      sessionId: 'session-listening',
      expectedIdentity: identity,
      expectedSubtitleRevision: 3,
    });
    await sendMessageToTab(7, 'playListeningSegment', {
      sessionId: 'session-listening',
      segmentKey,
      rate: 0.75,
    });
    await sendMessageToTab(7, 'saveListeningSegment', {
      sessionId: 'session-listening',
      segmentKey,
    });
    await sendMessageToTab(7, 'endListeningSession', {
      sessionId: 'session-listening',
      mode: 'restore-start',
    });
    await sendMessage('getListeningProgress');
    await sendMessage('recordListeningMissionResult', { result });
    await sendMessage('clearListeningVideoProgress', { videoId: 'video-listening' });
    await sendMessage('clearAllListeningProgress');

    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(7, {
      message: 'getListeningCatalog',
    });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(7, {
      message: 'beginListeningSession',
      params: {
        expectedIdentity: identity,
        expectedSubtitleRevision: 3,
        segmentKeys: [segmentKey],
      },
    });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(7, {
      message: 'playListeningSegment',
      params: { sessionId: 'session-listening', segmentKey, rate: 0.75 },
    });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      message: 'recordListeningMissionResult',
      params: { result },
    });
    expect(JSON.stringify(vi.mocked(chrome.runtime.sendMessage).mock.calls)).not.toMatch(
      /answer|draft|text|url/i
    );
  });

  it('forwards the keepalive return and removes the registered listener', () => {
    const callback = vi.fn(() => true as const);
    const registration = onMessage(callback);
    const listener = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0]?.[0];

    expect(listener).toBeDefined();
    expect(listener?.(
      {
        message: 'contentStatus',
        params: {
          contentInstanceId: 'content-1',
          hasVideo: true,
          isVideoUrl: true,
          routeChangedAt: 1_000,
          videoId: '123e4567-e89b-12d3-a456-426614174000',
          videoRevision: 1,
        },
      },
      {},
      vi.fn()
    )).toBe(true);

    registration.remove();

    expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalledWith(listener);
  });
});
