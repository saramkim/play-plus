import { describe, expect, it, vi } from 'vitest';

import { createViewVideoHandler, ViewVideoDependencies } from './view-video';

type ViewVideoTab = Awaited<ReturnType<ViewVideoDependencies['queryTabs']>>[number];

const createDependencies = (tabs: ViewVideoTab[]): ViewVideoDependencies => ({
  activateTab: vi.fn(async () => {}),
  createTab: vi.fn(async () => {}),
  enqueueViewAction: vi.fn(async () => {}),
  getVideoId: (url) => url?.split('/').pop() ?? null,
  playVideo: vi.fn(async () => {}),
  queryTabs: vi.fn(async () => tabs),
});

describe('view video handler', () => {
  it('activates a completed matching tab and awaits playback', async () => {
    const dependencies = createDependencies([
      { id: 0, url: 'https://example.com/video/one', active: true, status: 'complete' },
    ]);
    const handleViewVideo = createViewVideoHandler(dependencies);

    await handleViewVideo({ url: 'https://example.com/video/one', startTime: 12 });

    expect(dependencies.activateTab).toHaveBeenCalledWith(0);
    expect(dependencies.playVideo).toHaveBeenCalledWith(0, 12);
    expect(dependencies.enqueueViewAction).not.toHaveBeenCalled();
  });

  it('queues playback for a matching tab that is still loading', async () => {
    const dependencies = createDependencies([
      { id: 3, url: 'https://example.com/video/one', active: false, status: 'loading' },
    ]);
    const handleViewVideo = createViewVideoHandler(dependencies);

    await handleViewVideo({ url: 'https://example.com/video/one', startTime: 7 });

    expect(dependencies.activateTab).toHaveBeenCalledWith(3);
    expect(dependencies.playVideo).not.toHaveBeenCalled();
    expect(dependencies.enqueueViewAction).toHaveBeenCalledWith({
      url: 'https://example.com/video/one',
      startTime: 7,
      videoId: 'one',
    });
  });

  it('opens a new tab before queuing playback when no tab matches', async () => {
    const dependencies = createDependencies([]);
    const handleViewVideo = createViewVideoHandler(dependencies);

    await handleViewVideo({ url: 'https://example.com/video/one', startTime: 5 });

    expect(dependencies.createTab).toHaveBeenCalledWith('https://example.com/video/one');
    expect(dependencies.enqueueViewAction).toHaveBeenCalledWith({
      url: 'https://example.com/video/one',
      startTime: 5,
      videoId: 'one',
    });
  });
});
