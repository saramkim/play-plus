import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useVideoStore } from '@/content/core/store/video-store';

import { VideoManager } from './video-manager';

const createVideo = (callbackId: number) => {
  const video = document.createElement('video');
  video.requestVideoFrameCallback = vi.fn(() => callbackId);
  video.cancelVideoFrameCallback = vi.fn();
  document.body.append(video);
  return video;
};

describe('VideoManager', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    useVideoStore.setState({ currentTime: 0 });
  });

  it('cancels tracking before replacing the current video', () => {
    const manager = new VideoManager();
    const first = createVideo(0);
    const second = createVideo(2);

    manager.set(first);
    manager.set(second);

    expect(first.cancelVideoFrameCallback).toHaveBeenCalledWith(0);
    expect(manager.get()).toBe(second);
  });

  it('does not start a second frame loop for the same connected video', () => {
    const manager = new VideoManager();
    const video = createVideo(1);

    manager.set(video);
    manager.set(video);

    expect(video.requestVideoFrameCallback).toHaveBeenCalledOnce();
    expect(manager.isCurrent(video)).toBe(true);
  });

  it('clears tracking and is idempotent', () => {
    const manager = new VideoManager();
    const video = createVideo(3);
    manager.set(video);

    manager.clear();
    manager.clear();

    expect(video.cancelVideoFrameCallback).toHaveBeenCalledOnce();
    expect(manager.get()).toBeNull();
    expect(manager.isCurrent(video)).toBe(false);
  });

  it('does not consider a disconnected video current', () => {
    const manager = new VideoManager();
    const video = createVideo(4);
    manager.set(video);
    video.remove();

    expect(manager.isCurrent(video)).toBe(false);
  });

  it('tracks playback when Chrome stops delivering video frames', () => {
    const manager = new VideoManager();
    const video = createVideo(1);
    manager.set(video);

    video.currentTime = 12.25;
    video.dispatchEvent(new Event('timeupdate'));

    expect(useVideoStore.getState().currentTime).toBe(12.25);
    expect(video.requestVideoFrameCallback).toHaveBeenCalledOnce();
    manager.clear();
    video.currentTime = 13;
    video.dispatchEvent(new Event('timeupdate'));
    expect(useVideoStore.getState().currentTime).toBe(12.25);
  });

  it('ignores events and a queued frame from the replaced video', () => {
    const manager = new VideoManager();
    const first = createVideo(1);
    const second = createVideo(2);
    manager.set(first);
    const queuedFrame = vi.mocked(first.requestVideoFrameCallback).mock.calls[0][0];
    manager.set(second);
    second.currentTime = 8;
    second.dispatchEvent(new Event('timeupdate'));

    first.currentTime = 20;
    first.dispatchEvent(new Event('timeupdate'));
    queuedFrame(0, {} as VideoFrameCallbackMetadata);

    expect(useVideoStore.getState().currentTime).toBe(8);
    expect(first.requestVideoFrameCallback).toHaveBeenCalledOnce();
    manager.clear();
  });
});
