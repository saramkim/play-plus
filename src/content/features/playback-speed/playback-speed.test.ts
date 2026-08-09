import { beforeEach, describe, expect, it, vi } from 'vitest';

import { videoManager } from '@/content/core/video/video-manager';
import { useListeningMissionActiveStore } from '@/content/features/listening-session/mission-active-store';

import { PlaybackSpeedController } from './playback-speed';
import { usePlaybackSpeedStore } from './playback-speed-store';

describe('canonical playback speed controller', () => {
  beforeEach(() => {
    useListeningMissionActiveStore.getState().setActive(false);
    usePlaybackSpeedStore.getState().resetSpeed();
  });

  it('keeps construction inert and owns one subscription per relevant store', () => {
    const unsubscribeMission = vi.fn();
    const unsubscribeSpeed = vi.fn();
    const subscribeMission = vi
      .spyOn(useListeningMissionActiveStore, 'subscribe')
      .mockReturnValue(unsubscribeMission);
    const subscribeSpeed = vi
      .spyOn(usePlaybackSpeedStore, 'subscribe')
      .mockReturnValue(unsubscribeSpeed);
    vi.spyOn(videoManager, 'get').mockReturnValue(null);
    const controller = new PlaybackSpeedController();

    expect(subscribeMission).not.toHaveBeenCalled();
    expect(subscribeSpeed).not.toHaveBeenCalled();
    controller.start();
    controller.start();
    expect(subscribeMission).toHaveBeenCalledOnce();
    expect(subscribeSpeed).toHaveBeenCalledOnce();

    controller.stop();
    controller.stop();
    expect(unsubscribeMission).toHaveBeenCalledOnce();
    expect(unsubscribeSpeed).toHaveBeenCalledOnce();
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

  it('defers store and reset speed writes during a slow mission clip and resyncs on release', () => {
    const video = document.createElement('video');
    vi.spyOn(videoManager, 'get').mockReturnValue(video);
    usePlaybackSpeedStore.setState({ currentSpeed: 1.5 });
    const controller = new PlaybackSpeedController();
    controller.start();
    expect(video.playbackRate).toBe(1.5);

    useListeningMissionActiveStore.getState().setActive(true);
    video.playbackRate = 0.75;
    usePlaybackSpeedStore.setState({ currentSpeed: 1.8 });
    expect(video.playbackRate).toBe(0.75);

    usePlaybackSpeedStore.getState().resetSpeed();
    expect(usePlaybackSpeedStore.getState().currentSpeed).toBe(1);
    expect(video.playbackRate).toBe(0.75);

    video.playbackRate = 1.5;
    useListeningMissionActiveStore.getState().setActive(false);
    expect(usePlaybackSpeedStore.getState().currentSpeed).toBe(1.5);
    expect(video.playbackRate).toBe(1.5);
    controller.stop();
  });
});
