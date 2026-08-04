import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { elementStore } from '@/content/core/store/element-store';
import { usePlaybackSpeedStore } from '@/content/features/playback-speed/playback-speed-store';

describe('canonical content element store', () => {
  beforeEach(() => {
    elementStore.removeContainers();
    document.body.replaceChildren();
  });

  afterEach(() => {
    elementStore.removeContainers();
  });

  it('owns exactly one learning and one support subtitle element', () => {
    const container = elementStore.getSubtitleContainer();

    expect(Array.from(container.children).map((element) => (element as HTMLElement).dataset.subtitleRole)).toEqual([
      'learning',
      'support',
    ]);
    expect(elementStore.getSubtitleElement('learning')).not.toBe(elementStore.getSubtitleElement('support'));
  });

  it('attaches only the system and video roots to their canonical hosts', () => {
    const player = document.createElement('div');
    player.id = 'playerWrapper';
    document.body.appendChild(player);

    elementStore.setupSystemContainer();
    elementStore.setupContainer();

    expect(elementStore.getSystemRoot().parentElement).toBe(document.body);
    expect(elementStore.getVideoRoot().parentElement).toBe(player);
    expect(document.querySelector('#pp-loop-marker-container')).toBeNull();
  });

  it('resets subtitle text and playback speed', () => {
    elementStore.getSubtitleElement('learning').textContent = 'Learning';
    elementStore.getSubtitleElement('support').textContent = 'Support';
    usePlaybackSpeedStore.setState({ currentSpeed: 1.5 });

    elementStore.reset();

    expect(elementStore.getSubtitleElement('learning').textContent).toBe('');
    expect(elementStore.getSubtitleElement('support').textContent).toBe('');
    expect(usePlaybackSpeedStore.getState().currentSpeed).toBe(1);
  });
});
