import { describe, expect, it, vi } from 'vitest';

import { PlaybackSpeedController } from './playback-speed';
import { usePlaybackSpeedStore } from './playback-speed-store';

describe('PlaybackSpeedController lifecycle', () => {
  it('keeps construction inert and owns one store subscription', () => {
    const unsubscribe = vi.fn();
    const subscribe = vi.spyOn(usePlaybackSpeedStore, 'subscribe').mockReturnValue(unsubscribe);

    const controller = new PlaybackSpeedController();
    expect(subscribe).not.toHaveBeenCalled();

    controller.start();
    controller.start();
    expect(subscribe).toHaveBeenCalledOnce();

    controller.stop();
    controller.stop();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
