import { act } from 'react';

import { DEFAULT_V2_SYNC_STORAGE } from '@storage/v2/default';
import { createRoot, Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { useListeningMissionActiveStore } from '@/content/features/listening-session/mission-active-store';
import { useSubtitleStore } from '@/content/features/subtitle/subtitle-store';
import { useVideoControlStore } from '@/content/features/video/video-controller';

import { Controller } from './controller';

describe('Controller', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));

  beforeEach(() => {
    useListeningMissionActiveStore.getState().setActive(false);
    useVideoControlStore.getState().reset();
    useVideoControlStore.getState().setSettings({
      playbackSpeed: structuredClone(DEFAULT_V2_SYNC_STORAGE.playbackSpeed),
      shortcuts: {
        ...structuredClone(DEFAULT_V2_SYNC_STORAGE.shortcuts),
        enabled: false,
      },
    });
    useSubtitleStore.getState().setSettings({
      learningProfile: structuredClone(DEFAULT_V2_SYNC_STORAGE.learningProfile),
      subtitleDisplay: structuredClone(DEFAULT_V2_SYNC_STORAGE.subtitleDisplay),
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    useVideoControlStore.getState().reset();
    container.remove();
  });

  afterAll(() => vi.unstubAllGlobals());

  it('always renders previous, next, and repeat controls when expanded', () => {
    act(() => root.render(<Controller />));

    const expandButton = container.querySelector<HTMLButtonElement>(
      'button[title="v2_show_learning_controls"]'
    );
    expect(expandButton).not.toBeNull();

    act(() => expandButton?.click());

    expect(
      container.querySelector('button[title="v2_previous_learning_cue"]')
    ).not.toBeNull();
    expect(
      container.querySelector('button[title="v2_next_learning_cue"]')
    ).not.toBeNull();
    expect(
      container.querySelector('button[title="v2_repeat_current_learning_cue"]')
    ).not.toBeNull();
  });

  it('removes every on-video Controller action while a mission owns media', () => {
    act(() => root.render(<Controller />));
    expect(container.querySelector('button')).not.toBeNull();

    act(() => useListeningMissionActiveStore.getState().setActive(true));
    expect(container.querySelector('button')).toBeNull();

    act(() => useListeningMissionActiveStore.getState().setActive(false));
    expect(container.querySelector('button')).not.toBeNull();
  });
});
