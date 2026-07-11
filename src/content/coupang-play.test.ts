import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { coupangStrategy } from './coupang-play';
import playbackResponse from './fixtures/playback-response.json';

const addPlayer = () => {
  const player = document.createElement('div');
  player.id = 'playerWrapper';
  document.body.append(player);
  return player;
};

const addPlausibleVideo = (parent: Element) => {
  const video = document.createElement('video');
  video.src = 'https://cdn.example.com/video.mp4';
  parent.append(video);
  return video;
};

describe('coupangStrategy DOM adapter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns an immediately present plausible video after the swap window', async () => {
    const video = addPlausibleVideo(addPlayer());
    const result = coupangStrategy.detectVideo({ swapWindowMs: 100, timeoutMs: 1000 });

    await vi.advanceTimersByTimeAsync(100);

    await expect(result).resolves.toBe(video);
  });

  it('prefers a plausible replacement inserted during the swap window', async () => {
    const player = addPlayer();
    player.append(document.createElement('video'));
    const result = coupangStrategy.detectVideo({ swapWindowMs: 100, timeoutMs: 1000 });
    const replacement = addPlausibleVideo(player);

    await vi.runAllTicks();

    await expect(result).resolves.toBe(replacement);
  });

  it('keeps observing for a plausible video after the swap window', async () => {
    const player = addPlayer();
    const result = coupangStrategy.detectVideo({ swapWindowMs: 100, timeoutMs: 1000 });

    await vi.advanceTimersByTimeAsync(500);
    const lateVideo = addPlausibleVideo(player);
    await vi.runAllTicks();

    await expect(result).resolves.toBe(lateVideo);
  });

  it('ignores videos outside the player and returns null at the timeout', async () => {
    addPlayer();
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    const result = coupangStrategy.detectVideo({ swapWindowMs: 100, timeoutMs: 1000 });
    addPlausibleVideo(document.body);

    await vi.advanceTimersByTimeAsync(1000);

    await expect(result).resolves.toBeNull();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('returns null and cleans up its observer when no video appears', async () => {
    addPlayer();
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    const result = coupangStrategy.detectVideo({ swapWindowMs: 100, timeoutMs: 1000 });

    await vi.advanceTimersByTimeAsync(1000);

    await expect(result).resolves.toBeNull();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('uses the centralized player and progress selectors', () => {
    const player = addPlayer();
    const progress = document.createElement('div');
    progress.className = 'slider';
    document.body.append(progress);

    expect(coupangStrategy.getVideoPlayer()).toBe(player);
    expect(coupangStrategy.getProgressBarContainer()).toBe(progress);
  });
});

describe('coupangStrategy playback response adapter', () => {
  afterEach(() => vi.restoreAllMocks());

  it('extracts subtitle tracks from a valid playback response', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(playbackResponse)))
      .mockResolvedValueOnce(new Response('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello'));

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).resolves.toEqual([
      { lang: 'en', subtitleData: [{ start: 1, end: 2, text: 'Hello' }] },
    ]);
  });

  it.each([{}, { data: { raw: { text_tracks: [{ kind: 'subtitles', srclang: 3, src: null }] } } }])(
    'rejects an invalid playback response',
    async (response) => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(response)));

      await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).rejects.toThrow(
        'Invalid Coupang Play playback response'
      );
    }
  );
});
