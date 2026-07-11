import { describe, expect, it, vi } from 'vitest';

import { createTabLifecycleDependencies, handleTabCompleted } from './tab-lifecycle';

const VIDEO_URL = 'https://www.coupangplay.com/play/123e4567-e89b-12d3-a456-426614174000';

const createDependencies = () => ({
  ...createTabLifecycleDependencies,
  setActiveTab: vi.fn(),
  updateTabInfo: vi.fn(),
  checkContentConnection: vi.fn(),
  sendMessageToTab: vi.fn(),
  takePendingSubtitleRequest: vi.fn(),
  sendSubtitleRequest: vi.fn(),
  takeViewAction: vi.fn(),
});

describe('handleTabCompleted', () => {
  it('marks a video as not detected and stops when detection fails', async () => {
    const dependencies = createDependencies();
    dependencies.sendMessageToTab
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, message: 'not found' });

    await handleTabCompleted(7, { id: 7, active: true, url: VIDEO_URL } as chrome.tabs.Tab, dependencies);

    expect(dependencies.setActiveTab).toHaveBeenCalledOnce();
    expect(dependencies.updateTabInfo).toHaveBeenLastCalledWith(7, {
      connectionStatus: 'connected',
      videoStatus: 'not_detected',
    });
    expect(dependencies.takePendingSubtitleRequest).not.toHaveBeenCalled();
    expect(dependencies.takeViewAction).not.toHaveBeenCalled();
  });

  it('delivers pending subtitles and the newest queued playback action after detection', async () => {
    const dependencies = createDependencies();
    const pendingRequest = { url: 'https://example.com/playback', headers: [] };
    dependencies.sendMessageToTab.mockResolvedValue({ success: true });
    dependencies.takePendingSubtitleRequest.mockResolvedValue(pendingRequest);
    dependencies.takeViewAction.mockResolvedValue({ url: VIDEO_URL, videoId: null, startTime: 42 });

    await handleTabCompleted(7, { id: 7, active: false, url: VIDEO_URL } as chrome.tabs.Tab, dependencies);

    expect(dependencies.sendSubtitleRequest).toHaveBeenCalledWith(7, pendingRequest);
    expect(dependencies.takeViewAction).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', VIDEO_URL);
    expect(dependencies.sendMessageToTab).toHaveBeenLastCalledWith(7, 'playVideo', { startTime: 42 });
  });
});
