import { languageSchema } from '@storage/v2/schema';
import { LANGUAGES, type Language } from '@utils/constants';
import {
  playbackContextStatusSchema,
  type PlaybackContextStatus,
} from '@utils/playback-context';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { coupangStrategy } from './coupang-play';

type QualificationDescriptor = Readonly<{
  default?: unknown;
  kind?: unknown;
  label?: unknown;
  mime_type?: unknown;
  sources?: unknown;
  src?: unknown;
  srclang?: unknown;
}>;

type QualificationLanguageShape =
  | 'canonical'
  | 'case-variant'
  | 'region-variant'
  | 'accessibility-like'
  | 'unknown'
  | 'missing-or-invalid';

type QualificationTrackShape = Readonly<{
  category: 'subtitle' | 'metadata' | 'other' | 'invalid';
  hasDefault: boolean;
  hasLabel: boolean;
  hasMimeType: boolean;
  languageShape: QualificationLanguageShape;
  urlShape: 'direct' | 'sources-fallback' | 'both' | 'missing-or-invalid';
}>;

const CANONICAL_LANGUAGE_KEYS = Object.keys(LANGUAGES) as Language[];

const characterizeDescriptor = (descriptor: QualificationDescriptor): QualificationTrackShape => ({
  category:
    descriptor.kind === 'subtitles'
      ? 'subtitle'
      : descriptor.kind === 'metadata'
        ? 'metadata'
        : typeof descriptor.kind === 'string'
          ? 'other'
          : 'invalid',
  hasDefault: Object.prototype.hasOwnProperty.call(descriptor, 'default'),
  hasLabel: Object.prototype.hasOwnProperty.call(descriptor, 'label'),
  hasMimeType: Object.prototype.hasOwnProperty.call(descriptor, 'mime_type'),
  languageShape: characterizeLanguageShape(descriptor.srclang),
  urlShape: characterizeUrlShape(descriptor),
});

const characterizeLanguageShape = (value: unknown): QualificationLanguageShape => {
  if (typeof value !== 'string' || value.trim().length === 0) return 'missing-or-invalid';
  if (languageSchema.safeParse(value).success) return 'canonical';
  if (/(?:^|[\s_-])(?:sdh|cc)(?:$|[\s_-])/i.test(value)) return 'accessibility-like';
  if (CANONICAL_LANGUAGE_KEYS.some((language) => language.toLowerCase() === value.toLowerCase())) {
    return 'case-variant';
  }
  const [base, region, ...rest] = value.split('-');
  if (
    rest.length === 0 &&
    region !== undefined &&
    /^[a-z]{2,3}$/i.test(base) &&
    /^(?:[a-z]{2}|\d{3})$/i.test(region) &&
    CANONICAL_LANGUAGE_KEYS.some((language) => language.toLowerCase() === base.toLowerCase())
  ) {
    return 'region-variant';
  }
  return 'unknown';
};

const characterizeUrlShape = ({ sources, src }: QualificationDescriptor): QualificationTrackShape['urlShape'] => {
  const hasDirect = typeof src === 'string' && src.length > 0;
  const hasFallback =
    Array.isArray(sources) &&
    sources.some(
      (source) =>
        typeof source === 'object' &&
        source !== null &&
        'src' in source &&
        typeof source.src === 'string' &&
        source.src.length > 0
    );
  if (hasDirect && hasFallback) return 'both';
  if (hasDirect) return 'direct';
  if (hasFallback) return 'sources-fallback';
  return 'missing-or-invalid';
};

const isObservationBoundToCurrentP0AndSubtitle = (
  start: PlaybackContextStatus,
  acceptance: PlaybackContextStatus
) => {
  const parsedStart = playbackContextStatusSchema.safeParse(start);
  const parsedAcceptance = playbackContextStatusSchema.safeParse(acceptance);
  if (!parsedStart.success || !parsedAcceptance.success) return false;

  const left = parsedStart.data;
  const right = parsedAcceptance.data;
  return (
    (left.routeKind === 'movie' || left.routeKind === 'episode') &&
    left.routeKind === right.routeKind &&
    left.lifecycle === 'content' &&
    right.lifecycle === 'content' &&
    left.learningAvailable &&
    right.learningAvailable &&
    left.contentEpoch === right.contentEpoch &&
    left.contentInstanceId === right.contentInstanceId &&
    left.routeChangedAt === right.routeChangedAt &&
    left.videoId !== null &&
    left.videoId === right.videoId &&
    left.videoRevision === right.videoRevision &&
    left.mediaAttachmentRevision === right.mediaAttachmentRevision &&
    left.subtitleIdentity.learning !== null &&
    left.subtitleIdentity.learning === right.subtitleIdentity.learning &&
    left.subtitleIdentity.support === right.subtitleIdentity.support &&
    left.subtitleIdentity.subtitleRevision === right.subtitleIdentity.subtitleRevision
  );
};

const createPlaybackResponse = (textTracks: readonly unknown[]) => ({
  data: { raw: { text_tracks: textTracks } },
});

const createResponse = (body: unknown) => new Response(typeof body === 'string' ? body : JSON.stringify(body));

const VALID_VTT = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nSynthetic cue';

const P0_STATUS: PlaybackContextStatus = {
  contentEpoch: 4,
  contentInstanceId: 'qualification-instance',
  learningAvailable: true,
  lifecycle: 'content',
  mediaAttachmentRevision: 3,
  missionResumeRequired: false,
  routeChangedAt: 100,
  routeKind: 'episode',
  subtitleIdentity: {
    learning: 'native:en',
    subtitleRevision: 8,
    support: 'native:ko',
  },
  videoId: '00000000-0000-4000-8000-000000000001',
  videoRevision: 3,
};

describe('native subtitle variant qualification: descriptor shapes', () => {
  it.each([
    {
      descriptor: { kind: 'subtitles', srclang: 'en', src: 'https://cdn.example/direct.vtt' },
      expected: {
        category: 'subtitle',
        hasDefault: false,
        hasLabel: false,
        hasMimeType: false,
        languageShape: 'canonical',
        urlShape: 'direct',
      },
      name: 'regular canonical direct source',
    },
    {
      descriptor: {
        default: false,
        kind: 'subtitles',
        label: 'Synthetic accessibility descriptor',
        mime_type: 'text/vtt',
        sources: [{ src: 'https://cdn.example/fallback.vtt' }],
        srclang: 'ko sdh',
      },
      expected: {
        category: 'subtitle',
        hasDefault: true,
        hasLabel: true,
        hasMimeType: true,
        languageShape: 'accessibility-like',
        urlShape: 'sources-fallback',
      },
      name: 'accessibility-like source fallback',
    },
    {
      descriptor: {
        kind: 'metadata',
        label: 'Synthetic thumbnails',
        sources: [{ src: 'https://cdn.example/metadata.vtt' }],
      },
      expected: {
        category: 'metadata',
        hasDefault: false,
        hasLabel: true,
        hasMimeType: false,
        languageShape: 'missing-or-invalid',
        urlShape: 'sources-fallback',
      },
      name: 'metadata source',
    },
    {
      descriptor: {
        kind: 'subtitles',
        sources: [{ src: 'https://cdn.example/fallback.vtt' }],
        src: 'https://cdn.example/direct.vtt',
        srclang: 'EN',
      },
      expected: {
        category: 'subtitle',
        hasDefault: false,
        hasLabel: false,
        hasMimeType: false,
        languageShape: 'case-variant',
        urlShape: 'both',
      },
      name: 'case variant with both URL fields',
    },
    {
      descriptor: { kind: 'subtitles', srclang: 'en-US' },
      expected: {
        category: 'subtitle',
        hasDefault: false,
        hasLabel: false,
        hasMimeType: false,
        languageShape: 'region-variant',
        urlShape: 'missing-or-invalid',
      },
      name: 'non-canonical region variant without URL',
    },
    {
      descriptor: { kind: 'unknown-kind', srclang: 'x-unknown' },
      expected: {
        category: 'other',
        hasDefault: false,
        hasLabel: false,
        hasMimeType: false,
        languageShape: 'unknown',
        urlShape: 'missing-or-invalid',
      },
      name: 'unknown descriptor',
    },
  ])('records only sanitized shape for $name', ({ descriptor, expected }) => {
    expect(characterizeDescriptor(descriptor)).toEqual(expected);
  });

  it.each([undefined, null, '', '   ', 42])('classifies missing or invalid language without retaining it', (value) => {
    expect(characterizeLanguageShape(value)).toBe('missing-or-invalid');
  });

  it('keeps an exact canonical region key distinct from an unapproved region variant', () => {
    expect(characterizeLanguageShape('zh-CN')).toBe('canonical');
    expect(characterizeLanguageShape('en-US')).toBe('region-variant');
  });
});

describe('native subtitle variant qualification: current production path', () => {
  afterEach(() => vi.restoreAllMocks());

  it('fails the acquisition closed when the top-level playback envelope is invalid', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(createResponse({ data: { raw: { text_tracks: 'not-an-array' } } }));

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).rejects.toThrow(
      'Invalid Coupang Play playback response'
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('classifies an exact canonical language as regular and retains its physical identity', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        createResponse(
          createPlaybackResponse([
            { kind: 'subtitles', srclang: 'en', src: 'https://cdn.example/direct.vtt' },
          ])
        )
      )
      .mockResolvedValueOnce(createResponse(VALID_VTT));

    const tracks = await coupangStrategy.fetchSubtitles('https://example.com/playback', []);

    expect(tracks).toEqual([
      {
        category: 'regular',
        cues: [{ end: 2, start: 1, text: 'Synthetic cue' }],
        language: 'en',
        physicalIdentity: 'https://cdn.example/direct.vtt',
      },
    ]);
  });

  it('classifies only the exact canonical language plus lowercase sdh suffix as SDH', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        createResponse(
          createPlaybackResponse([
            { kind: 'subtitles', srclang: 'ko sdh', src: 'https://cdn.example/accessibility.vtt' },
          ])
        )
      )
      .mockResolvedValueOnce(createResponse(VALID_VTT));

    const tracks = await coupangStrategy.fetchSubtitles('https://example.com/playback', []);

    expect(tracks).toEqual([
      {
        category: 'sdh',
        cues: [{ end: 2, start: 1, text: 'Synthetic cue' }],
        language: 'ko',
        physicalIdentity: 'https://cdn.example/accessibility.vtt',
      },
    ]);
  });

  it('excludes every non-exact language spelling and non-subtitle kind before track fetch', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      createResponse(
        createPlaybackResponse([
          { kind: 'subtitles', srclang: 'EN', src: 'https://cdn.example/case.vtt' },
          { kind: 'subtitles', srclang: 'en-US', src: 'https://cdn.example/region.vtt' },
          { kind: 'subtitles', srclang: 'en SDH', src: 'https://cdn.example/uppercase-sdh.vtt' },
          { kind: 'subtitles', srclang: 'en sdh ', src: 'https://cdn.example/trailing-space.vtt' },
          { kind: 'subtitles', srclang: 'en cc', src: 'https://cdn.example/cc.vtt' },
          { kind: 'metadata', sources: [{ src: 'https://cdn.example/metadata.vtt' }] },
          { kind: 'captions', srclang: 'ko', src: 'https://cdn.example/captions.vtt' },
          { kind: 'unknown-kind', srclang: 'en', src: 'https://cdn.example/unknown.vtt' },
        ])
      )
    );

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('isolates malformed descriptors while retaining a valid sibling', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      createResponse(
        createPlaybackResponse([
          null,
          42,
          { kind: 'subtitles', srclang: 42, src: 'https://cdn.example/invalid-language.vtt' },
          { kind: 'subtitles', srclang: 'en', src: 'https://cdn.example/valid.vtt' },
        ])
      )
    ).mockResolvedValueOnce(createResponse(VALID_VTT));

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).resolves.toEqual([
      {
        category: 'regular',
        cues: [{ end: 2, start: 1, text: 'Synthetic cue' }],
        language: 'en',
        physicalIdentity: 'https://cdn.example/valid.vtt',
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses exactly direct src or the first sources entry without trying later alternatives', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        createResponse(
          createPlaybackResponse([
            {
              kind: 'subtitles',
              sources: [{ src: 'https://cdn.example/ignored.vtt' }],
              src: 'https://cdn.example/direct.vtt',
              srclang: 'en',
            },
            {
              kind: 'subtitles',
              sources: [
                { src: 'https://cdn.example/first.vtt' },
                { src: 'https://cdn.example/second.vtt' },
              ],
              src: null,
              srclang: 'ko',
            },
          ])
        )
      )
      .mockResolvedValueOnce(createResponse(VALID_VTT))
      .mockResolvedValueOnce(createResponse(VALID_VTT));

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).resolves.toHaveLength(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://cdn.example/direct.vtt');
    expect(fetchMock.mock.calls[2]?.[0]).toBe('https://cdn.example/first.vtt');
    expect(fetchMock).not.toHaveBeenCalledWith('https://cdn.example/ignored.vtt');
    expect(fetchMock).not.toHaveBeenCalledWith('https://cdn.example/second.vtt');
  });

  it('does not fall back when direct src is present but empty', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      createResponse(
        createPlaybackResponse([
          {
            kind: 'subtitles',
            sources: [{ src: 'https://cdn.example/fallback.vtt' }],
            src: '',
            srclang: 'ko',
          },
        ])
      )
    );

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('settles fetch and body-read failures locally and keeps a usable sibling language', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        createResponse(
          createPlaybackResponse([
            { kind: 'subtitles', srclang: 'en', src: 'https://cdn.example/fails.vtt' },
            { kind: 'subtitles', srclang: 'ko', src: 'https://cdn.example/unreadable.vtt' },
            { kind: 'subtitles', srclang: 'ja', src: 'https://cdn.example/succeeds.vtt' },
          ])
        )
      )
      .mockRejectedValueOnce(new Error('Synthetic track fetch failure'))
      .mockResolvedValueOnce({
        text: vi.fn().mockRejectedValue(new Error('Synthetic body read failure')),
      } as unknown as Response)
      .mockResolvedValueOnce(createResponse(VALID_VTT));

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).resolves.toEqual([
      {
        category: 'regular',
        cues: [{ end: 2, start: 1, text: 'Synthetic cue' }],
        language: 'ja',
        physicalIdentity: 'https://cdn.example/succeeds.vtt',
      },
    ]);
  });

  it('prefers one usable regular track over SDH and falls back when regular is unusable', async () => {
    const regular = 'WEBVTT\n\n00:00:03.000 --> 00:00:04.000\nSynthetic regular';
    const sdh = 'WEBVTT\n\n00:00:05.000 --> 00:00:06.000\nSynthetic SDH';
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        createResponse(
          createPlaybackResponse([
            { kind: 'subtitles', srclang: 'en sdh', src: 'https://cdn.example/en-sdh.vtt' },
            { kind: 'subtitles', srclang: 'en', src: 'https://cdn.example/en-regular.vtt' },
            { kind: 'subtitles', srclang: 'ko', src: 'https://cdn.example/ko-empty.vtt' },
            { kind: 'subtitles', srclang: 'ko sdh', src: 'https://cdn.example/ko-sdh.vtt' },
          ])
        )
      )
      .mockResolvedValueOnce(createResponse(sdh))
      .mockResolvedValueOnce(createResponse(regular))
      .mockResolvedValueOnce(createResponse('WEBVTT\n\nmalformed'))
      .mockResolvedValueOnce(createResponse(sdh));

    const tracks = await coupangStrategy.fetchSubtitles('https://example.com/playback', []);

    expect(tracks).toMatchObject([
      {
        category: 'regular',
        cues: [{ end: 4, start: 3, text: 'Synthetic regular' }],
        language: 'en',
      },
      {
        category: 'sdh',
        cues: [{ end: 6, start: 5, text: 'Synthetic SDH' }],
        language: 'ko',
      },
    ]);
  });

  it('fails closed for duplicate usable regular or SDH candidates per language', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        createResponse(
          createPlaybackResponse([
            { kind: 'subtitles', srclang: 'en', src: 'https://cdn.example/en-first.vtt' },
            { kind: 'subtitles', srclang: 'en', src: 'https://cdn.example/en-second.vtt' },
            { kind: 'subtitles', srclang: 'en sdh', src: 'https://cdn.example/en-sdh.vtt' },
            { kind: 'subtitles', srclang: 'ko sdh', src: 'https://cdn.example/ko-first.vtt' },
            { kind: 'subtitles', srclang: 'ko sdh', src: 'https://cdn.example/ko-second.vtt' },
          ])
        )
      )
      .mockImplementation(() => Promise.resolve(createResponse(VALID_VTT)));

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).resolves.toEqual([]);
  });

  it('counts only usable candidates when deciding whether a regular track is unique', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        createResponse(
          createPlaybackResponse([
            { kind: 'subtitles', srclang: 'en', src: 'https://cdn.example/en-fails.vtt' },
            { kind: 'subtitles', srclang: 'en', src: 'https://cdn.example/en-works.vtt' },
          ])
        )
      )
      .mockRejectedValueOnce(new Error('Synthetic track fetch failure'))
      .mockResolvedValueOnce(createResponse(VALID_VTT));

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).resolves.toMatchObject([
      {
        category: 'regular',
        language: 'en',
        physicalIdentity: 'https://cdn.example/en-works.vtt',
      },
    ]);
  });
});

describe('native subtitle variant qualification: P0 and source binding', () => {
  it('accepts only an unchanged supported content observation with the same source revision', () => {
    expect(isObservationBoundToCurrentP0AndSubtitle(P0_STATUS, structuredClone(P0_STATUS))).toBe(true);
  });

  it.each([
    ['content epoch', { contentEpoch: P0_STATUS.contentEpoch + 1 }],
    ['content instance', { contentInstanceId: 'replacement-instance' }],
    ['route change time', { routeChangedAt: P0_STATUS.routeChangedAt + 1 }],
    ['video identity', { videoId: '00000000-0000-4000-8000-000000000002' }],
    [
      'media attachment',
      {
        mediaAttachmentRevision: P0_STATUS.mediaAttachmentRevision + 1,
        videoRevision: P0_STATUS.videoRevision + 1,
      },
    ],
    ['route kind', { routeKind: 'movie' as const }],
    ['non-content lifecycle', { learningAvailable: false, lifecycle: 'advertisement' as const }],
    [
      'learning source',
      {
        subtitleIdentity: { ...P0_STATUS.subtitleIdentity, learning: 'native:ko' },
      },
    ],
    [
      'support source',
      {
        subtitleIdentity: { ...P0_STATUS.subtitleIdentity, support: null },
      },
    ],
    [
      'subtitle revision',
      {
        subtitleIdentity: {
          ...P0_STATUS.subtitleIdentity,
          subtitleRevision: P0_STATUS.subtitleIdentity.subtitleRevision + 1,
        },
      },
    ],
  ])('rejects an observation after a stale %s', (_name, changes) => {
    const acceptance = { ...structuredClone(P0_STATUS), ...changes } as PlaybackContextStatus;
    expect(isObservationBoundToCurrentP0AndSubtitle(P0_STATUS, acceptance)).toBe(false);
  });

  it.each(['waiting', 'placeholder', 'advertisement', 'transitioning'] as const)(
    'rejects %s lifecycle at both observation boundaries',
    (lifecycle) => {
      const status = { ...structuredClone(P0_STATUS), learningAvailable: false, lifecycle };
      expect(isObservationBoundToCurrentP0AndSubtitle(status, status)).toBe(false);
    }
  );

  it.each(['trailer', 'channel', 'highlight', 'unknown'] as const)(
    'rejects unsupported %s route kind at both observation boundaries',
    (routeKind) => {
      const status = { ...structuredClone(P0_STATUS), learningAvailable: false, routeKind };
      expect(isObservationBoundToCurrentP0AndSubtitle(status, status)).toBe(false);
    }
  );

  it('rejects a malformed media attachment revision even when both snapshots match', () => {
    const malformed = { ...structuredClone(P0_STATUS), mediaAttachmentRevision: 9 };
    expect(isObservationBoundToCurrentP0AndSubtitle(malformed, malformed)).toBe(false);
  });
});
