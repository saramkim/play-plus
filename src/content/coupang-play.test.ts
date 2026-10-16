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

  it('waits for content when a short direct-source advertisement is replaced', async () => {
    const player = addPlayer();
    const advertisement = addPlausibleVideo(player);
    Object.defineProperty(advertisement, 'duration', { configurable: true, value: 15 });
    const result = coupangStrategy.detectVideo({ swapWindowMs: 100, timeoutMs: 3000 });

    await vi.advanceTimersByTimeAsync(1500);
    advertisement.remove();
    const content = addPlausibleVideo(player);
    content.src = 'blob:https://www.coupangplay.com/content';
    Object.defineProperty(content, 'duration', { configurable: true, value: 700 });
    await vi.runAllTicks();

    await expect(result).resolves.toBe(content);
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
      { lang: 'en', result: { status: 'success', subtitleData: [{ start: 1, end: 2, text: 'Hello' }] } },
    ]);
  });

  it('ignores non-subtitle tracks and falls back to sources when src is absent', async () => {
    const response = {
      data: {
        raw: {
          text_tracks: [
            { kind: 'metadata', label: 'chapters' },
            {
              kind: 'subtitles',
              srclang: 'ko',
              src: null,
              sources: [{ src: 'https://cdn.example.com/ko.vtt' }],
            },
          ],
        },
      },
    };
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(response)))
      .mockResolvedValueOnce(new Response('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n안녕하세요'));

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).resolves.toEqual([
      { lang: 'ko', result: { status: 'success', subtitleData: [{ start: 1, end: 2, text: '안녕하세요' }] } },
    ]);
  });

  it('rejects an invalid playback response envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({})));

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).rejects.toThrow(
      'Invalid Coupang Play playback response'
    );
  });

  it.each(['http', 'empty', 'invalid timing', 'network', 'malformed descriptor'])('isolates %s failure without losing healthy tracks or duplicate order', async (failure) => {
    const tracks: unknown[] = [null, { kind: 'subtitles', srclang: 'en', src: 'https://example.test/first' },
      { kind: 'subtitles', srclang: 'ko', src: 'https://example.test/ko' },
      { kind: 'subtitles', srclang: 'en', src: 'https://example.test/second' }];
    if (failure === 'malformed descriptor') tracks[1] = { kind: 'subtitles', srclang: 'en', src: 42 };
    const valid = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHealthy';
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (input === 'https://example.test/metadata') return new Response(JSON.stringify({ data: { raw: { text_tracks: tracks } } }));
      if (input !== 'https://example.test/first') return new Response(valid);
      if (failure === 'network') throw new Error('network');
      if (failure === 'http') return new Response(valid, { status: 503 });
      if (failure === 'invalid timing') return new Response('WEBVTT\n\n00:00:02.000 --> 00:00:01.000\nInvalid');
      return new Response('WEBVTT\n');
    });
    const result = await coupangStrategy.fetchSubtitles('https://example.test/metadata', []);
    expect(result.map(({ lang, result }) => [lang, result.status])).toEqual([['en', 'failed'], ['ko', 'success'], ['en', 'success']]);
  });

  it('preserves raw language, kind and first-source URL selection without alternate fallback', async () => {
    const tracks = [
      { kind: 'captions', srclang: 'en', src: 'ignored' },
      { kind: 'subtitles', srclang: 'en', src: '', sources: [{ src: 'ignored' }] },
      { kind: 'subtitles', srclang: 'en sdh', sources: [{ src: 'first' }, { src: 'never-fallback' }] },
    ];
    const fetcher = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { raw: { text_tracks: tracks } } })))
      .mockResolvedValueOnce(new Response('', { status: 404 }));
    await expect(coupangStrategy.fetchSubtitles('metadata', [])).resolves.toEqual([{ lang: 'en sdh', result: { status: 'failed' } }]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenLastCalledWith('first');
  });

  it('rejects failed metadata HTTP responses even when their body looks valid', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(playbackResponse), { status: 503 }));
    await expect(coupangStrategy.fetchSubtitles('metadata', [])).rejects.toThrow('metadata request failed');
  });

  it.each(['first', 'middle', 'last'])('keeps healthy cues when a reversed-time cue is %s in a track', async (position) => {
    const blocks = ['00:00:01.000 --> 00:00:02.000\nFirst', '00:00:05.000 --> 00:00:06.000\nLast'];
    blocks.splice(['first', 'middle', 'last'].indexOf(position), 0, '00:00:04.000 --> 00:00:03.000\nInvalid');
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(playbackResponse)))
      .mockResolvedValueOnce(new Response(`WEBVTT\n\n${blocks.join('\n\n')}`));
    await expect(coupangStrategy.fetchSubtitles('metadata', [])).resolves.toEqual([
      { lang: 'en', result: { status: 'success', subtitleData: [
        { start: 1, end: 2, text: 'First' }, { start: 5, end: 6, text: 'Last' },
      ] } },
    ]);
  });
});
