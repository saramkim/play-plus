import { act } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { useListeningMissionActiveStore } from '@/content/features/listening-session/mission-active-store';
import { PlaybackSpeedDisplay } from '@/content/features/playback-speed/playback-speed-display';
import { usePlaybackSpeedStore } from '@/content/features/playback-speed/playback-speed-store';

describe('PlaybackSpeedDisplay mission suppression', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));

  beforeEach(() => {
    useListeningMissionActiveStore.getState().setActive(false);
    usePlaybackSpeedStore.getState().resetSpeed();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  afterAll(() => vi.unstubAllGlobals());

  it('is visible before, hidden during, and restored after mission ownership', () => {
    act(() => root.render(<PlaybackSpeedDisplay />));
    act(() => usePlaybackSpeedStore.getState().increaseSpeed());
    expect(container.textContent).toBe('1.1x');

    act(() => useListeningMissionActiveStore.getState().setActive(true));
    expect(container.textContent).toBe('');

    act(() => useListeningMissionActiveStore.getState().setActive(false));
    expect(container.textContent).toBe('1.1x');
  });
});
