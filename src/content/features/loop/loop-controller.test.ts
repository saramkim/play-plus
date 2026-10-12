import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useVideoStore } from '@/content/core/store/video-store';
import { videoManager } from '@/content/core/video/video-manager';
import { useSubtitleStore } from '@/content/features/subtitle/subtitle-store';

import { LoopController } from './loop-controller';
import { LoopMarker } from './loop-marker';
import { useLoopStore } from './loop-store';

const defaultGetPrimarySubtitle = useSubtitleStore.getState().getPrimarySubtitle;

const createVideo = () =>
  ({
    currentTime: 3,
    duration: 30,
    pause: vi.fn(),
    play: vi.fn(async () => {}),
  }) as unknown as HTMLVideoElement;

beforeEach(() => {
  useLoopStore.getState().reset();
  useVideoStore.setState({ currentTime: 0 });
});

afterEach(() => {
  useLoopStore.getState().reset();
  useSubtitleStore.setState({ getPrimarySubtitle: defaultGetPrimarySubtitle });
});

describe('loop interaction cleanup', () => {
  it('releases the active loop subscription during reset', () => {
    const video = createVideo();
    const unsubscribe = vi.fn();
    vi.spyOn(videoManager, 'get').mockReturnValue(video);
    vi.spyOn(useVideoStore, 'subscribe').mockReturnValue(unsubscribe);
    const controller = new LoopController();

    controller.toggleLoop();
    controller.resetLoop();
    controller.resetLoop();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('releases one-shot subtitle playback during reset', () => {
    const video = createVideo();
    const unsubscribe = vi.fn();
    vi.spyOn(videoManager, 'get').mockReturnValue(video);
    vi.spyOn(useVideoStore, 'subscribe').mockReturnValue(unsubscribe);
    useSubtitleStore.setState({
      getPrimarySubtitle: () => [{ start: 1, end: 2, text: 'subtitle' }],
    });
    useVideoStore.setState({ currentTime: 1.5 });
    const controller = new LoopController();

    controller.playCurrentSubtitleOnce();
    controller.resetLoop();
    controller.resetLoop();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('releases document listeners when a video disappears during marker drag', () => {
    const container = document.createElement('div');
    const removeEventListener = vi.spyOn(document, 'removeEventListener');
    vi.spyOn(videoManager, 'get').mockReturnValue(null);
    new LoopMarker('test-marker', 'A', container, vi.fn());
    const marker = container.querySelector<HTMLElement>('#test-marker');

    marker?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    document.dispatchEvent(new MouseEvent('mouseup'));

    expect(removeEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
  });
});
