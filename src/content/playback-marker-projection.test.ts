import { describe, expect, it } from 'vitest';

import { extractWatchNextFenceSeconds } from './coupang-play';

const marker = (name: string, time: number, overrides: Record<string, unknown> = {}) => ({
  force_stop: false,
  id: 'fixture-id',
  metadata: 'fixture-metadata',
  name,
  time,
  type: 'CODE',
  ...overrides,
});

const response = (cuePoints: unknown, duration: unknown = 600_000) => ({
  data: { raw: { cue_points: cuePoints, duration, text_tracks: [] } },
});

describe('strict episode watch-next marker projection', () => {
  it('accepts one strict marker with an ordered strict intro pair', () => {
    expect(
      extractWatchNextFenceSeconds(
        response([
          marker('skip_intro_start', 10),
          marker('skip_intro_end', 40),
          marker('watch_next', 540),
        ]),
        600
      )
    ).toBe(540);
  });

  it.each([
    undefined,
    null,
    {},
    [],
  ])('fails closed for an unavailable cue-point array: %s', (cuePoints) => {
    expect(extractWatchNextFenceSeconds(response(cuePoints), 600)).toBeNull();
  });

  it('fails closed when raw duration is missing', () => {
    expect(
      extractWatchNextFenceSeconds(
        { data: { raw: { cue_points: [marker('watch_next', 500)], text_tracks: [] } } },
        600
      )
    ).toBeNull();
  });

  it.each([null, '600000', Number.NaN, Number.POSITIVE_INFINITY, -1])(
    'fails closed for invalid raw duration: %s',
    (duration) => {
      expect(
        extractWatchNextFenceSeconds(response([marker('watch_next', 500)], duration), 600)
      ).toBeNull();
    }
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, 400])(
    'fails closed for invalid or insufficient media duration: %s',
    (mediaDurationSeconds) => {
      expect(
        extractWatchNextFenceSeconds(
          response([marker('watch_next', 500)]),
          mediaDurationSeconds
        )
      ).toBeNull();
    }
  );

  it('applies the qualified 0.001 raw-duration scale', () => {
    expect(
      extractWatchNextFenceSeconds(response([marker('watch_next', 500)], 499_999), 600)
    ).toBeNull();
  });

  it.each([
    [marker('watch_next', 500), marker('watch_next', 510)],
    [marker('watch_next', 500), { name: 'watch_next' }],
  ])('fails closed for a second raw watch-next name even when malformed', (...cuePoints) => {
    expect(extractWatchNextFenceSeconds(response(cuePoints), 600)).toBeNull();
  });

  it.each([
    marker('watch_next', 500, { extra: true }),
    marker('watch_next', 500, { force_stop: true }),
    marker('watch_next', 500, { id: '' }),
    marker('watch_next', 500, { metadata: null }),
    marker('watch_next', 500, { time: Number.NaN }),
    marker('watch_next', 500, { type: 'OTHER' }),
  ])('rejects a malformed selected marker: %#', (watchNext) => {
    expect(extractWatchNextFenceSeconds(response([watchNext]), 600)).toBeNull();
  });

  it('isolates malformed and unknown siblings', () => {
    expect(
      extractWatchNextFenceSeconds(
        response([
          null,
          marker('skip_intro_start', 10, { type: 'OTHER' }),
          marker('unknown', 20),
          marker('watch_next', 500),
          { name: 'skip_intro_end' },
        ]),
        600
      )
    ).toBe(500);
  });

  it('allows one strict intro endpoint but rejects strict duplicate ambiguity', () => {
    expect(
      extractWatchNextFenceSeconds(
        response([marker('skip_intro_start', 10), marker('watch_next', 500)]),
        600
      )
    ).toBe(500);
    expect(
      extractWatchNextFenceSeconds(
        response([
          marker('skip_intro_start', 10),
          marker('skip_intro_start', 11),
          marker('watch_next', 500),
        ]),
        600
      )
    ).toBeNull();
  });

  it.each([
    [marker('skip_intro_end', 40), marker('skip_intro_start', 10), marker('watch_next', 500)],
    [marker('skip_intro_start', 10), marker('watch_next', 500), marker('skip_intro_end', 40)],
    [marker('skip_intro_start', 40), marker('skip_intro_end', 40), marker('watch_next', 500)],
    [marker('skip_intro_start', 10), marker('skip_intro_end', 500), marker('watch_next', 500)],
  ])('rejects inconsistent strict intro order or time', (...cuePoints) => {
    expect(extractWatchNextFenceSeconds(response(cuePoints), 600)).toBeNull();
  });
});
