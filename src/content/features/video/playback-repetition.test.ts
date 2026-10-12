import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';


import { useToastStore } from '@/content/core/store/toast-store';
import { useListeningMissionActiveStore } from '@/content/features/listening-session/mission-active-store';
import { useSubtitleStore } from '@/content/features/subtitle/subtitle-store';
import { getControlledMedia, isMediaIntervalAllowed } from '@/content/features/video/media-controls';
import { PlaybackRepetition, useRepetitionStore } from '@/content/features/video/playback-repetition';
import { usePlaybackContextStore } from '@/content/playback-context/playback-context-store';
import { DEFAULT_V2_SYNC_STORAGE } from '@/storage/v2/default';

vi.mock('@/content/features/video/media-controls', () => ({
  getControlledMedia: vi.fn(), isMediaIntervalAllowed: vi.fn(),
}));

describe('playback ownership and repetition', () => {
  let repeat: PlaybackRepetition;
  let video: HTMLVideoElement;
  let currentTime: number;
  let paused: boolean;
  let asyncSeek: boolean;
  let seeking: boolean;
  beforeEach(() => {
    vi.useFakeTimers();
    useListeningMissionActiveStore.getState().setActive(false);
    useSubtitleStore.getState().clearCaches();
    useRepetitionStore.setState({ mode: null, start: null, end: null });
    currentTime = 5;
    paused = false;
    asyncSeek = false;
    seeking = false;
    video = document.createElement('video');
    Object.defineProperties(video, {
      currentTime: { get: () => currentTime, set: (value) => {
        currentTime = value;
        if (asyncSeek) {
          seeking = true;
          setTimeout(() => { video.dispatchEvent(new Event('seeking')); seeking = false; video.dispatchEvent(new Event('seeked')); }, 40);
        }
        else { video.dispatchEvent(new Event('seeking')); video.dispatchEvent(new Event('seeked')); }
      } },
      seeking: { get: () => seeking },
      paused: { get: () => paused }, duration: { value: 100 },
    });
    video.play = vi.fn(async () => { paused = false; });
    video.pause = vi.fn(() => { paused = true; });
    vi.mocked(getControlledMedia).mockReturnValue({ video, status: {
      contentInstanceId: 'test', contentEpoch: 1, videoRevision: 1, mediaAttachmentRevision: 1,
      videoId: 'test', routeChangedAt: 1, routeKind: 'movie', lifecycle: 'content',
      learningAvailable: false, missionResumeRequired: false,
      subtitleIdentity: { learning: null, support: null, subtitleRevision: 0 },
    }, fence: {} } as ReturnType<typeof getControlledMedia>);
    vi.mocked(isMediaIntervalAllowed).mockImplementation((start, end) => start >= 0 && end > start && end <= 100);
    repeat = new PlaybackRepetition();
  });
  afterEach(() => { repeat.stop(); vi.useRealTimers(); });

  it('loops across repeated ends, respects pause and keeps valid endpoint edits active', () => {
    expect(repeat.start('ab', 5, 15)).toBe(true);
    for (let cycle = 0; cycle < 3; cycle += 1) {
      currentTime = 15.02; vi.advanceTimersByTime(25); expect(currentTime).toBe(5);
    }
    paused = true; currentTime = 15.02; vi.advanceTimersByTime(25);
    expect(currentTime).toBe(15.02);
    expect(repeat.setPoint('end', 20)).toBe(true);
    expect(useRepetitionStore.getState()).toMatchObject({ mode: 'ab', end: 20 });
    expect(repeat.setPoint('start', 22)).toBe(false);
    expect(useRepetitionStore.getState()).toMatchObject({ mode: 'ab', start: 5, end: 20 });
    expect(repeat.setPoint('start', 17)).toBe(true);
    expect(currentTime).toBe(17);
    expect(paused).toBe(true);
    vi.advanceTimersByTime(25);
    expect(useRepetitionStore.getState().mode).toBe('ab');
  });

  it('pauses once at the exact endpoint and never pauses after a valid replacement seek', () => {
    repeat.start('once', 5, 7);
    currentTime = 7.2; vi.advanceTimersByTime(25);
    expect(video.pause).toHaveBeenCalledOnce(); expect(currentTime).toBe(7);
    repeat.start('once', 5, 7); repeat.navigate(30);
    currentTime = 35; vi.advanceTimersByTime(50);
    expect(video.pause).toHaveBeenCalledOnce();
  });

  it('retargets cue loops, keeps A/B targets, and cancels outside seeks only', () => {
    repeat.start('cue', 5, 7); repeat.navigate(10, { start: 10, end: 12 });
    expect(useRepetitionStore.getState()).toMatchObject({ mode: 'cue', start: 10, end: 12 });
    repeat.start('ab', 0, 20); repeat.navigate(10, { start: 10, end: 12 });
    expect(useRepetitionStore.getState()).toMatchObject({ mode: 'ab', start: 0, end: 20 });
    video.currentTime = 15; expect(useRepetitionStore.getState().mode).toBe('ab');
    video.currentTime = 25; expect(useRepetitionStore.getState().mode).toBeNull();
  });

  it('preserves work through visibility and speed changes but clears it immediately for mission ownership', () => {
    repeat.start('ab', 5, 15);
    useSubtitleStore.getState().setSettings(structuredClone(DEFAULT_V2_SYNC_STORAGE));
    video.playbackRate = 1.5; vi.advanceTimersByTime(25);
    expect(useRepetitionStore.getState().mode).toBe('ab');
    useListeningMissionActiveStore.getState().setActive(true);
    useListeningMissionActiveStore.getState().setActive(false);
    expect(useRepetitionStore.getState()).toEqual({ mode: null, start: null, end: null });
  });

  it('clears pending endpoints and timers on attachment/source invalidation', () => {
    repeat.setPoint('start', 5);
    expect(useRepetitionStore.getState()).toMatchObject({ start: 5, end: 15 });
    vi.mocked(getControlledMedia).mockReturnValue(null);
    usePlaybackContextStore.setState({ status: null });
    expect(useRepetitionStore.getState()).toEqual({ mode: null, start: null, end: null });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects an invalid replacement before touching the existing loop', () => {
    repeat.start('cue', 5, 7);
    expect(repeat.start('ab', 90, 110)).toBe(false);
    expect(useRepetitionStore.getState()).toMatchObject({ mode: 'cue', start: 5, end: 7 });
  });
  it('restarts a naturally ended loop, but completes once and releases execution observers', () => {
    Object.defineProperty(video, 'ended', { get: () => currentTime === 100 });
    repeat.start('ab', 90, 100);
    currentTime = 100; paused = true; vi.advanceTimersByTime(25);
    expect(currentTime).toBe(90);
    expect(video.play).toHaveBeenCalledTimes(2);
    expect(useRepetitionStore.getState().mode).toBe('ab');
    repeat.start('ab', 90, 100);
    expect(vi.getTimerCount()).toBe(0);
    repeat.start('once', 90, 100);
    currentTime = 100; paused = true; vi.advanceTimersByTime(25);
    expect(useRepetitionStore.getState().mode).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans up a rejected play and reports it without affecting a newer operation', async () => {
    useToastStore.getState().clearToasts();
    let reject: (error: Error) => void = () => {};
    video.play = vi.fn(() => new Promise<void>((_resolve, rejectPlay) => { reject = rejectPlay; }));
    repeat.start('once', 5, 7);
    reject(new Error('denied')); await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0);
    expect(useToastStore.getState().toasts.at(-1)?.message).toBe('v2_playback_failed');
    repeat.start('once', 5, 7); const oldReject = reject;
    video.play = vi.fn(async () => {});
    repeat.start('ab', 10, 20); oldReject(new Error('late')); await Promise.resolve();
    expect(useRepetitionStore.getState().mode).toBe('ab');
  });

  it.each([false, true])('keeps valid edits outside the current position with pause=%s', (isPaused) => {
    repeat.start('ab', 5, 20); paused = isPaused; currentTime = 6;
    repeat.setPoint('start', 10); expect(currentTime).toBe(10); expect(paused).toBe(isPaused);
    currentTime = 18; repeat.setPoint('end', 15);
    vi.advanceTimersByTime(25);
    expect(currentTime).toBe(10); expect(paused).toBe(isPaused);
    expect(useRepetitionStore.getState().mode).toBe('ab');
  });

  it('keeps ownership until asynchronous seeking events finish and cancels a later user seek', () => {
    asyncSeek = true;
    repeat.start('once', 10, 12);
    vi.advanceTimersByTime(25);
    expect(useRepetitionStore.getState().mode).toBe('once');
    vi.advanceTimersByTime(20);
    expect(useRepetitionStore.getState().mode).toBe('once');
    video.currentTime = 30;
    vi.advanceTimersByTime(40);
    expect(useRepetitionStore.getState().mode).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('hands a pending identical seek to the newest once operation', () => {
    asyncSeek = true;
    repeat.start('once', 10, 12);
    repeat.start('once', 10, 12);
    vi.advanceTimersByTime(45);
    expect(useRepetitionStore.getState().mode).toBe('once');
    currentTime = 12; vi.advanceTimersByTime(25);
    expect(video.pause).toHaveBeenCalledOnce();
    expect(useRepetitionStore.getState().mode).toBeNull();
    vi.advanceTimersByTime(50);
    repeat.start('once', 10, 12); vi.advanceTimersByTime(45);
    video.currentTime = 30; vi.advanceTimersByTime(45);
    expect(useRepetitionStore.getState().mode).toBeNull();
  });

});
