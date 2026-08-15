import { languageSchema } from '@storage/v2/schema';
import type { V2SubtitleCue } from '@storage/v2/type';
import { LANGUAGES, type Language } from '@utils/constants';
import {
  playbackContextStatusSchema,
  type PlaybackContextStatus,
} from '@utils/playback-context';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createNativeListeningSourceKey } from '@/listening/domain/source-identity';

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

const characterizeCurrentRetention = (
  tracks: readonly { lang: string; subtitleData: V2SubtitleCue[] }[]
) => {
  const cache: Partial<Record<Language, V2SubtitleCue[]>> = {};
  const acceptedLanguages: Language[] = [];
  const droppedLanguageShapes: QualificationLanguageShape[] = [];

  for (const track of tracks) {
    const language = languageSchema.safeParse(track.lang);
    if (!language.success) {
      droppedLanguageShapes.push(characterizeLanguageShape(track.lang));
      continue;
    }
    acceptedLanguages.push(language.data);
    cache[language.data] = track.subtitleData;
  }

  return {
    acceptedLanguages,
    cache,
    collisionRisk: new Set(acceptedLanguages).size !== acceptedLanguages.length,
    droppedLanguageShapes,
  };
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

const settleSiblingTrackFetches = async <T>(tasks: readonly Promise<T>[]) => {
  const results = await Promise.allSettled(tasks);
  return {
    failed: results.filter((result) => result.status === 'rejected').length,
    fulfilled: results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : [])),
  };
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

  it('fetches and parses a regular canonical direct-source track', async () => {
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
        lang: 'en',
        subtitleData: [{ end: 2, start: 1, text: 'Synthetic cue' }],
      },
    ]);
    expect(characterizeCurrentRetention(tracks)).toMatchObject({
      acceptedLanguages: ['en'],
      collisionRisk: false,
      droppedLanguageShapes: [],
    });
  });

  it('fetches an accessibility-like subtitle but exact-language validation drops it', async () => {
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

    expect(tracks).toHaveLength(1);
    expect(characterizeCurrentRetention(tracks)).toEqual({
      acceptedLanguages: [],
      cache: {},
      collisionRisk: false,
      droppedLanguageShapes: ['accessibility-like'],
    });
  });

  it('shows the language-keyed cache and native source collision for same-language tracks', async () => {
    const first = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nSynthetic first';
    const second = 'WEBVTT\n\n00:00:03.000 --> 00:00:04.000\nSynthetic second';
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        createResponse(
          createPlaybackResponse([
            { kind: 'subtitles', srclang: 'en', src: 'https://cdn.example/first.vtt' },
            { kind: 'subtitles', srclang: 'en', src: 'https://cdn.example/second.vtt' },
          ])
        )
      )
      .mockResolvedValueOnce(createResponse(first))
      .mockResolvedValueOnce(createResponse(second));

    const tracks = await coupangStrategy.fetchSubtitles('https://example.com/playback', []);
    const retention = characterizeCurrentRetention(tracks);

    expect(retention.acceptedLanguages).toEqual(['en', 'en']);
    expect(retention.collisionRisk).toBe(true);
    expect(retention.cache.en).toEqual([{ end: 4, start: 3, text: 'Synthetic second' }]);
    expect(createNativeListeningSourceKey(retention.acceptedLanguages[0])).toBe(
      createNativeListeningSourceKey(retention.acceptedLanguages[1])
    );
  });

  it('drops exact-language case and region variants after their existing fetches', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        createResponse(
          createPlaybackResponse([
            { kind: 'subtitles', srclang: 'EN', src: 'https://cdn.example/case.vtt' },
            { kind: 'subtitles', srclang: 'en-US', src: 'https://cdn.example/region.vtt' },
          ])
        )
      )
      .mockResolvedValueOnce(createResponse(VALID_VTT))
      .mockResolvedValueOnce(createResponse(VALID_VTT));

    const tracks = await coupangStrategy.fetchSubtitles('https://example.com/playback', []);

    expect(characterizeCurrentRetention(tracks)).toEqual({
      acceptedLanguages: [],
      cache: {},
      collisionRisk: false,
      droppedLanguageShapes: ['case-variant', 'region-variant'],
    });
  });

  it('excludes metadata, captions, and unknown kinds before track fetch', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      createResponse(
        createPlaybackResponse([
          { kind: 'metadata', sources: [{ src: 'https://cdn.example/metadata.vtt' }] },
          { kind: 'captions', srclang: 'ko', src: 'https://cdn.example/captions.vtt' },
          { kind: 'unknown-kind', srclang: 'en', src: 'https://cdn.example/unknown.vtt' },
        ])
      )
    );

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('ignores missing, null, and empty language before track fetch', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      createResponse(
        createPlaybackResponse([
          { kind: 'subtitles', src: 'https://cdn.example/missing.vtt' },
          { kind: 'subtitles', srclang: null, src: 'https://cdn.example/null.vtt' },
          { kind: 'subtitles', srclang: '', src: 'https://cdn.example/empty.vtt' },
        ])
      )
    );

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('rejects the strict playback envelope when a language has an invalid type', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      createResponse(
        createPlaybackResponse([
          { kind: 'subtitles', srclang: 42, src: 'https://cdn.example/invalid.vtt' },
        ])
      )
    );

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).rejects.toThrow(
      'Invalid Coupang Play playback response'
    );
  });

  it('uses sources fallback only when direct src is nullish', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        createResponse(
          createPlaybackResponse([
            {
              kind: 'subtitles',
              sources: [{ src: 'https://cdn.example/fallback.vtt' }],
              src: null,
              srclang: 'ko',
            },
          ])
        )
      )
      .mockResolvedValueOnce(createResponse(VALID_VTT));

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).resolves.toHaveLength(1);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://cdn.example/fallback.vtt');
  });

  it('prefers direct src when both direct and fallback sources are present', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        createResponse(
          createPlaybackResponse([
            {
              kind: 'subtitles',
              sources: [{ src: 'https://cdn.example/fallback.vtt' }],
              src: 'https://cdn.example/direct.vtt',
              srclang: 'ko',
            },
          ])
        )
      )
      .mockResolvedValueOnce(createResponse(VALID_VTT));

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).resolves.toHaveLength(1);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://cdn.example/direct.vtt');
  });

  it('does not use a valid sources fallback when direct src is an empty string', async () => {
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

  it('drops a subtitle track that has no usable direct or fallback URL', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      createResponse(
        createPlaybackResponse([
          { kind: 'subtitles', sources: [], src: null, srclang: 'ko' },
        ])
      )
    );

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('returns an empty parsed track and leaves its native source unavailable', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        createResponse(
          createPlaybackResponse([
            { kind: 'subtitles', srclang: 'en', src: 'https://cdn.example/empty.vtt' },
          ])
        )
      )
      .mockResolvedValueOnce(createResponse('WEBVTT\n\nmalformed'));

    const tracks = await coupangStrategy.fetchSubtitles('https://example.com/playback', []);
    const retention = characterizeCurrentRetention(tracks);

    expect(retention.cache).toEqual({ en: [] });
    expect(retention.cache.en).toHaveLength(0);
  });

  it('rejects the acquisition when reading one fetched track fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        createResponse(
          createPlaybackResponse([
            { kind: 'subtitles', srclang: 'en', src: 'https://cdn.example/unreadable.vtt' },
          ])
        )
      )
      .mockResolvedValueOnce({
        text: vi.fn().mockRejectedValue(new Error('Synthetic body read failure')),
      } as unknown as Response);

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).rejects.toThrow(
      'Synthetic body read failure'
    );
  });

  it('rejects all current acquisition results when one sibling fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        createResponse(
          createPlaybackResponse([
            { kind: 'subtitles', srclang: 'en', src: 'https://cdn.example/fails.vtt' },
            { kind: 'subtitles', srclang: 'ko', src: 'https://cdn.example/succeeds.vtt' },
          ])
        )
      )
      .mockRejectedValueOnce(new Error('Synthetic track fetch failure'))
      .mockResolvedValueOnce(createResponse(VALID_VTT));

    await expect(coupangStrategy.fetchSubtitles('https://example.com/playback', [])).rejects.toThrow(
      'Synthetic track fetch failure'
    );
  });

  it('demonstrates tests-only sibling failure isolation without choosing retry or retention policy', async () => {
    const isolated = await settleSiblingTrackFetches([
      Promise.reject(new Error('Synthetic track fetch failure')),
      Promise.resolve({ category: 'regular', parseNonEmpty: true }),
    ]);

    expect(isolated).toEqual({
      failed: 1,
      fulfilled: [{ category: 'regular', parseNonEmpty: true }],
    });
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
