import { beforeEach, describe, expect, it, vi } from 'vitest';

import { videoManager } from '@/content/core/video/video-manager';

import { PlaybackSpeedController } from './playback-speed';
import { usePlaybackSpeedStore } from './playback-speed-store';

describe('canonical playback speed controller', () => {
  beforeEach(() => {
    usePlaybackSpeedStore.getState().resetSpeed();
  });

  it('keeps construction inert and owns one store subscription', () => {
    const unsubscribe = vi.fn();
    const subscribe = vi.spyOn(usePlaybackSpeedStore, 'subscribe').mockReturnValue(unsubscribe);
    vi.spyOn(videoManager, 'get').mockReturnValue(null);
    const controller = new PlaybackSpeedController();

    expect(subscribe).not.toHaveBeenCalled();
    controller.start();
    controller.start();
    expect(subscribe).toHaveBeenCalledOnce();

    controller.stop();
    controller.stop();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('applies the current speed on start and follows later speed changes', () => {
    const video = document.createElement('video');
    vi.spyOn(videoManager, 'get').mockReturnValue(video);
    usePlaybackSpeedStore.setState({ currentSpeed: 1.5 });
    const controller = new PlaybackSpeedController();

    controller.start();
    expect(video.playbackRate).toBe(1.5);

    usePlaybackSpeedStore.getState().increaseSpeed();
    expect(video.playbackRate).toBe(1.6);
    controller.stop();

    usePlaybackSpeedStore.getState().decreaseSpeed();
    expect(video.playbackRate).toBe(1.6);
  });

  it('tolerates speed changes when no video is available', () => {
    vi.spyOn(videoManager, 'get').mockReturnValue(null);
    const controller = new PlaybackSpeedController();
    controller.start();

    expect(() => usePlaybackSpeedStore.getState().increaseSpeed()).not.toThrow();

    controller.stop();
  });
});
