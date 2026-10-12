import { act } from 'react';

import { DEFAULT_V2_SYNC_STORAGE } from '@storage/v2/default';
import { createRoot, Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { videoManager } from '@/content/core/video/video-manager';
import { useListeningMissionActiveStore } from '@/content/features/listening-session/mission-active-store';
import { useSubtitleStore } from '@/content/features/subtitle/subtitle-store';
import { playbackRepetition, useRepetitionStore } from '@/content/features/video/playback-repetition';
import { useVideoControlStore } from '@/content/features/video/video-controller';
import { usePlaybackContextStore } from '@/content/playback-context/playback-context-store';

import { Controller } from './controller';

vi.mock('@utils/coupang-play', () => ({ getCoupangPlayVideoId: () => 'video-test' }));

describe('Controller', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));

  beforeEach(() => {
    useRepetitionStore.setState({ mode: null, start: null, end: null });
    useListeningMissionActiveStore.getState().setActive(false);
    usePlaybackContextStore.setState({ status: SUPPORTED_PLAYBACK_CONTEXT });
    useVideoControlStore.getState().reset();
    useVideoControlStore.getState().setSettings({
      playbackSpeed: structuredClone(DEFAULT_V2_SYNC_STORAGE.playbackSpeed),
      shortcuts: {
        ...structuredClone(DEFAULT_V2_SYNC_STORAGE.shortcuts),
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
    playbackRepetition.stop();
    useVideoControlStore.getState().reset();
    container.remove();
  });

  afterAll(() => vi.unstubAllGlobals());

  it('always renders previous, next, and repeat controls when expanded', () => {
    act(() => root.render(<Controller />));

    const expandButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="v2_show_learning_controls"]'
    );
    expect(expandButton).not.toBeNull();

    act(() => expandButton?.click());

    expect(
      container.querySelector('button[aria-label="v2_primary_previous"]')
    ).not.toBeNull();
    expect(
      container.querySelector('button[aria-label="v2_primary_next"]')
    ).not.toBeNull();
    expect(
      container.querySelector('button[aria-label="v2_repeat_current_learning_cue"]')
    ).not.toBeNull();
  });

  it('keeps endpoint typing as a draft and commits valid edits without stopping the loop', () => {
    useRepetitionStore.setState({ mode: 'ab', start: 13, end: 23 });
    const setPoint = vi.spyOn(playbackRepetition, 'setPoint').mockImplementation((point, value) => {
      if (value <= 13) return false;
      useRepetitionStore.setState({ [point]: value });
      return true;
    });
    act(() => root.render(<Controller />));
    act(() => container.querySelector<HTMLButtonElement>('button')!.click());
    let input = container.querySelectorAll<HTMLInputElement>('input')[1];
    const typeValue = (value: string) => act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => input.focus());
    typeValue(''); typeValue('2'); typeValue('25');
    expect(input.value).toBe('25');
    expect(setPoint).not.toHaveBeenCalled();
    expect(useRepetitionStore.getState()).toEqual({ mode: 'ab', start: 13, end: 23 });
    const platformKey = vi.fn();
    document.addEventListener('keydown', platformKey);
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(platformKey).not.toHaveBeenCalled();
    document.removeEventListener('keydown', platformKey);
    expect(setPoint).toHaveBeenLastCalledWith('end', 25);
    expect(useRepetitionStore.getState()).toEqual({ mode: 'ab', start: 13, end: 25 });
    input = container.querySelectorAll<HTMLInputElement>('input')[1];
    act(() => input.focus()); typeValue('2'); act(() => input.blur());
    expect(input.value).toBe('25');
    expect(container.querySelector('[role=alert]')).not.toBeNull();
    expect(useRepetitionStore.getState().mode).toBe('ab');
    setPoint.mockRestore();
  });

  it.each(['blur', 'Enter'])('discards a stale endpoint draft before %s and accepts a new-context edit', (commit) => {
    const video = document.createElement('video');
    Object.defineProperty(video, 'duration', { value: 100 });
    video.play = vi.fn(async () => undefined);
    const getVideo = vi.spyOn(videoManager, 'get').mockReturnValue(video);
    const isCurrent = vi.spyOn(videoManager, 'isCurrent').mockReturnValue(true);
    expect(playbackRepetition.start('ab', 13, 23)).toBe(true);
    const setPoint = vi.spyOn(playbackRepetition, 'setPoint');
    act(() => root.render(<Controller />));
    act(() => container.querySelector<HTMLButtonElement>('button')!.click());
    const input = container.querySelectorAll<HTMLInputElement>('input')[1];
    act(() => {
      input.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '25');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => {
      usePlaybackContextStore.setState({ status: { ...SUPPORTED_PLAYBACK_CONTEXT,
        subtitleIdentity: { ...SUPPORTED_PLAYBACK_CONTEXT.subtitleIdentity, subtitleRevision: 2 },
      } });
    });
    act(() => input.dispatchEvent(commit === 'blur' ? new FocusEvent('focusout', { bubbles: true })
      : new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(setPoint).not.toHaveBeenCalled();
    expect(container.querySelectorAll<HTMLInputElement>('input')[1].value).toBe('');
    expect(useRepetitionStore.getState()).toEqual({ mode: null, start: null, end: null });
    const freshInput = container.querySelectorAll<HTMLInputElement>('input')[1];
    act(() => {
      freshInput.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(freshInput, '35');
      freshInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => freshInput.blur());
    expect(setPoint).toHaveBeenCalledWith('end', 35);
    expect(useRepetitionStore.getState()).toEqual({ mode: null, start: 25, end: 35 });
    setPoint.mockRestore();
    getVideo.mockRestore(); isCurrent.mockRestore();
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

const SUPPORTED_PLAYBACK_CONTEXT = {
  contentEpoch: 1,
  contentInstanceId: 'content-test',
  learningAvailable: true,
  lifecycle: 'content',
  mediaAttachmentRevision: 1,
  missionResumeRequired: false,
  routeChangedAt: 1,
  routeKind: 'episode',
  subtitleIdentity: { learning: 'native:en', subtitleRevision: 1, support: null },
  videoId: 'video-test',
  videoRevision: 1,
} as const;
