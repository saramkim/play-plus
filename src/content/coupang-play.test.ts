import DOMPurify from 'dompurify';

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

const VALID_VTT = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nSynthetic cue';
const createPlaybackResponse = (textTracks: readonly unknown[]) => ({
  data: { raw: { text_tracks: textTracks } },
});
const createResponse = (body: unknown) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body));

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
      {
        category: 'regular',
        cues: [{ start: 1, end: 2, text: 'Hello' }],
        language: 'en',
        physicalIdentity: 'https://cdn.example.com/en.vtt',
      },
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
      {
        category: 'regular',
        cues: [{ start: 1, end: 2, text: '안녕하세요' }],
        language: 'ko',
        physicalIdentity: 'https://cdn.example.com/ko.vtt',
      },
    ]);
  });

  it.each([
    null,
    'drifted',
    [
      {
        force_stop: false,
        metadata: null,
        name: 'skip_intro_start',
        time: 10,
        type: 'marker',
      },
      { name: 'malformed', time: Number.NaN },
    ],
  ])('keeps subtitle extraction independent from %s cue_points', async (cuePoints) => {
    const response = {
      data: {
        raw: {
          cue_points: cuePoints,
          text_tracks: [
            {
              kind: 'subtitles',
              srclang: 'en',
              src: 'https://cdn.example.com/en.vtt',
            },
          ],
        },
      },
    };
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(response)))
      .mockResolvedValueOnce(new Response('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello'));

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).resolves.toEqual([
      {
        category: 'regular',
        cues: [{ start: 1, end: 2, text: 'Hello' }],
        language: 'en',
        physicalIdentity: 'https://cdn.example.com/en.vtt',
      },
    ]);
  });

  it('rejects an invalid playback response envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({})));

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).rejects.toThrow(
      'Invalid Coupang Play playback response'
    );
  });

  it('selects one exact SDH candidate as its canonical logical language', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        createResponse(
          createPlaybackResponse([
            { kind: 'subtitles', srclang: 'ko sdh', src: 'https://cdn.example.com/ko-sdh.vtt' },
          ])
        )
      )
      .mockResolvedValueOnce(createResponse(VALID_VTT));

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).resolves.toEqual([
      {
        category: 'sdh',
        cues: [{ start: 1, end: 2, text: 'Synthetic cue' }],
        language: 'ko',
        physicalIdentity: 'https://cdn.example.com/ko-sdh.vtt',
      },
    ]);
  });

  it('excludes non-exact language and descriptor variants before body fetch', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      createResponse(
        createPlaybackResponse([
          { kind: 'subtitles', srclang: 'EN', src: 'https://cdn.example.com/case.vtt' },
          { kind: 'subtitles', srclang: 'en-US', src: 'https://cdn.example.com/region.vtt' },
          { kind: 'subtitles', srclang: 'en  sdh', src: 'https://cdn.example.com/spaces.vtt' },
          { kind: 'subtitles', srclang: 'en SDH', src: 'https://cdn.example.com/sdh-case.vtt' },
          { kind: 'subtitles', srclang: 'en cc', src: 'https://cdn.example.com/cc.vtt' },
          { kind: 'captions', srclang: 'en', src: 'https://cdn.example.com/captions.vtt' },
        ])
      )
    );

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('fetches every candidate before selecting exactly one usable regular over SDH', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        createResponse(
          createPlaybackResponse([
            { kind: 'subtitles', srclang: 'en sdh', src: 'https://cdn.example.com/en-sdh.vtt' },
            { kind: 'subtitles', srclang: 'en', src: 'https://cdn.example.com/en.vtt' },
          ])
        )
      )
      .mockResolvedValueOnce(createResponse(VALID_VTT.replace('Synthetic cue', 'SDH')))
      .mockResolvedValueOnce(createResponse(VALID_VTT.replace('Synthetic cue', 'Regular')));

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).resolves.toEqual([
      {
        category: 'regular',
        cues: [{ start: 1, end: 2, text: 'Regular' }],
        language: 'en',
        physicalIdentity: 'https://cdn.example.com/en.vtt',
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('fails a language closed for duplicate usable regular candidates without descending to SDH', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        createResponse(
          createPlaybackResponse([
            { kind: 'subtitles', srclang: 'en', src: 'https://cdn.example.com/en-1.vtt' },
            { kind: 'subtitles', srclang: 'en', src: 'https://cdn.example.com/en-2.vtt' },
            { kind: 'subtitles', srclang: 'en sdh', src: 'https://cdn.example.com/en-sdh.vtt' },
          ])
        )
      )
      .mockImplementation(() => Promise.resolve(createResponse(VALID_VTT)));

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).resolves.toEqual([]);
  });

  it('selects the sole usable regular when its duplicate fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        createResponse(
          createPlaybackResponse([
            { kind: 'subtitles', srclang: 'en', src: 'https://cdn.example.com/fails.vtt' },
            { kind: 'subtitles', srclang: 'en', src: 'https://cdn.example.com/works.vtt' },
          ])
        )
      )
      .mockRejectedValueOnce(new Error('Synthetic candidate failure'))
      .mockResolvedValueOnce(createResponse(VALID_VTT));

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).resolves.toEqual([
      expect.objectContaining({
        category: 'regular',
        language: 'en',
        physicalIdentity: 'https://cdn.example.com/works.vtt',
      }),
    ]);
  });

  it('falls back to one usable SDH after regular body failure or an invalid regular cue array', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        createResponse(
          createPlaybackResponse([
            { kind: 'subtitles', srclang: 'en', src: 'https://cdn.example.com/unreadable.vtt' },
            { kind: 'subtitles', srclang: 'en sdh', src: 'https://cdn.example.com/en-sdh.vtt' },
            { kind: 'subtitles', srclang: 'ko', src: 'https://cdn.example.com/invalid.vtt' },
            { kind: 'subtitles', srclang: 'ko sdh', src: 'https://cdn.example.com/ko-sdh.vtt' },
          ])
        )
      )
      .mockResolvedValueOnce({
        text: vi.fn().mockRejectedValue(new Error('Synthetic body failure')),
      } as unknown as Response)
      .mockResolvedValueOnce(createResponse(VALID_VTT.replace('Synthetic cue', 'English SDH')))
      .mockResolvedValueOnce(
        createResponse('WEBVTT\n\n00:00:03.000 --> 00:00:02.000\nInvalid cue')
      )
      .mockResolvedValueOnce(createResponse(VALID_VTT.replace('Synthetic cue', 'Korean SDH')));

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).resolves.toEqual([
      expect.objectContaining({ category: 'sdh', language: 'en' }),
      expect.objectContaining({ category: 'sdh', language: 'ko' }),
    ]);
  });

  it('isolates a VTT parser rejection and falls back to the usable SDH candidate', async () => {
    vi.spyOn(DOMPurify, 'sanitize').mockImplementation((value) => {
      const text = typeof value === 'string' ? value : (value.textContent ?? '');
      if (text === 'Synthetic parser failure') throw new Error('Synthetic VTT parser failure');
      return text;
    });
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        createResponse(
          createPlaybackResponse([
            { kind: 'subtitles', srclang: 'en', src: 'https://cdn.example.com/parser-fails.vtt' },
            { kind: 'subtitles', srclang: 'en sdh', src: 'https://cdn.example.com/en-sdh.vtt' },
          ])
        )
      )
      .mockResolvedValueOnce(
        createResponse(VALID_VTT.replace('Synthetic cue', 'Synthetic parser failure'))
      )
      .mockResolvedValueOnce(createResponse(VALID_VTT.replace('Synthetic cue', 'Usable SDH')));

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).resolves.toEqual([
      expect.objectContaining({
        category: 'sdh',
        cues: [{ start: 1, end: 2, text: 'Usable SDH' }],
        language: 'en',
      }),
    ]);
  });

  it('retains a usable regular candidate when its SDH sibling fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        createResponse(
          createPlaybackResponse([
            { kind: 'subtitles', srclang: 'en', src: 'https://cdn.example.com/en.vtt' },
            { kind: 'subtitles', srclang: 'en sdh', src: 'https://cdn.example.com/fails.vtt' },
          ])
        )
      )
      .mockResolvedValueOnce(createResponse(VALID_VTT))
      .mockRejectedValueOnce(new Error('Synthetic SDH fetch failure'));

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).resolves.toEqual([
      expect.objectContaining({ category: 'regular', language: 'en' }),
    ]);
  });

  it('fails a language closed for duplicate usable SDH candidates while retaining another language', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        createResponse(
          createPlaybackResponse([
            { kind: 'subtitles', srclang: 'en sdh', src: 'https://cdn.example.com/en-1.vtt' },
            { kind: 'subtitles', srclang: 'en sdh', src: 'https://cdn.example.com/en-2.vtt' },
            { kind: 'subtitles', srclang: 'ko', src: 'https://cdn.example.com/ko.vtt' },
          ])
        )
      )
      .mockImplementation(() => Promise.resolve(createResponse(VALID_VTT)));

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).resolves.toEqual([
      expect.objectContaining({ category: 'regular', language: 'ko' }),
    ]);
  });

  it('isolates malformed candidate fields while keeping the strict response envelope', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        createResponse(
          createPlaybackResponse([
            null,
            { kind: 42, srclang: 'en', src: 'https://cdn.example.com/kind.vtt' },
            { kind: 'subtitles', srclang: 42, src: 'https://cdn.example.com/language.vtt' },
            { kind: 'subtitles', srclang: 'en', src: 42 },
            { kind: 'subtitles', srclang: 'ko', src: 'https://cdn.example.com/ko.vtt' },
          ])
        )
      )
      .mockResolvedValueOnce(createResponse(VALID_VTT));

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).resolves.toEqual([
      expect.objectContaining({ language: 'ko' }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never retries a failed direct URL or falls through to another source URL', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        createResponse(
          createPlaybackResponse([
            {
              kind: 'subtitles',
              sources: [
                { src: 'https://cdn.example.com/fallback-1.vtt' },
                { src: 'https://cdn.example.com/fallback-2.vtt' },
              ],
              src: 'https://cdn.example.com/direct.vtt',
              srclang: 'en',
            },
          ])
        )
      )
      .mockRejectedValueOnce(new Error('Synthetic direct failure'));

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith('https://cdn.example.com/direct.vtt');
  });
});
