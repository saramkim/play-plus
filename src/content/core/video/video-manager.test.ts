import { beforeEach, describe, expect, it, vi } from 'vitest';

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
});
