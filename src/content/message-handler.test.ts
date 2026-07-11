import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createVideoLifecycleHandler } from './message-handler';
import { VideoLifecycleEvent } from './video-lifecycle/video-lifecycle-monitor';

const contentEvent = (video: HTMLVideoElement): VideoLifecycleEvent => ({
  state: 'content',
  video,
  videoId: '123e4567-e89b-12d3-a456-426614174000',
  delayed: false,
});

const createDependencies = () => {
  let currentVideo: HTMLVideoElement | null = null;
  return {
    dependencies: {
      getVideo: () => currentVideo,
      isCurrentVideo: (video: HTMLVideoElement) => currentVideo === video && video.isConnected,
      setVideo: vi.fn((video: HTMLVideoElement) => {
        currentVideo = video;
      }),
      clearVideo: vi.fn(() => {
        currentVideo = null;
      }),
      setupContainer: vi.fn(),
      resetElements: vi.fn(),
      resetLoop: vi.fn(),
      setCurrentTime: vi.fn(),
      setDetectionStatus: vi.fn(),
      reportContentStatus: vi.fn(),
    },
    getCurrentVideo: () => currentVideo,
  };
};

describe('createVideoLifecycleHandler', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('attaches a content video and reports detection', () => {
    const { dependencies, getCurrentVideo } = createDependencies();
    const handle = createVideoLifecycleHandler(dependencies);
    const video = document.createElement('video');
    document.body.append(video);

    handle(contentEvent(video));

    expect(getCurrentVideo()).toBe(video);
    expect(dependencies.setupContainer).toHaveBeenCalledOnce();
    expect(dependencies.setDetectionStatus).toHaveBeenLastCalledWith('detected');
    expect(dependencies.reportContentStatus).toHaveBeenLastCalledWith(true);
  });

  it('does not reinitialize the same connected content video', () => {
    const { dependencies } = createDependencies();
    const handle = createVideoLifecycleHandler(dependencies);
    const video = document.createElement('video');
    document.body.append(video);

    handle(contentEvent(video));
    handle(contentEvent(video));

    expect(dependencies.setVideo).toHaveBeenCalledOnce();
    expect(dependencies.setupContainer).toHaveBeenCalledOnce();
  });

  it.each(['advertisement', 'placeholder', 'waiting', 'transitioning'] as const)(
    'clears content and reports detecting for %s',
    (state) => {
      const { dependencies, getCurrentVideo } = createDependencies();
      const handle = createVideoLifecycleHandler(dependencies);
      const video = document.createElement('video');
      document.body.append(video);
      handle(contentEvent(video));

      handle({ state, video: state === 'advertisement' ? video : null, videoId: null, delayed: false });

      expect(getCurrentVideo()).toBeNull();
      expect(dependencies.clearVideo).toHaveBeenCalledOnce();
      expect(dependencies.resetElements).toHaveBeenCalledOnce();
      expect(dependencies.resetLoop).toHaveBeenCalledOnce();
      expect(dependencies.setDetectionStatus).toHaveBeenLastCalledWith('detecting');
      expect(dependencies.reportContentStatus).toHaveBeenLastCalledWith(false);
    }
  );

  it('reports failed after delayed detection without clearing twice', () => {
    const { dependencies } = createDependencies();
    const handle = createVideoLifecycleHandler(dependencies);

    handle({ state: 'waiting', video: null, videoId: null, delayed: false });
    handle({ state: 'waiting', video: null, videoId: null, delayed: true });

    expect(dependencies.clearVideo).not.toHaveBeenCalled();
    expect(dependencies.setDetectionStatus).toHaveBeenLastCalledWith('failed');
  });
});
