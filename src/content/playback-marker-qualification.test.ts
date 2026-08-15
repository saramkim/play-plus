import {
  PLAYBACK_LIFECYCLES,
  PLAYBACK_ROUTE_KINDS,
  type PlaybackLifecycle,
  type PlaybackRouteKind,
} from '@utils/playback-context';
import { describe, expect, it } from 'vitest';

const QUALIFICATION_MARKER_NAMES = [
  'skip_intro_end',
  'skip_intro_start',
  'watch_next',
] as const;

type QualificationMarkerName = (typeof QUALIFICATION_MARKER_NAMES)[number];

type QualificationIdentity = Readonly<{
  contentEpoch: number;
  contentInstanceId: string;
  routeChangedAt: number;
  videoId: string | null;
  videoRevision: number;
}>;

type QualificationSubtitleIdentity = Readonly<{
  learning: string | null;
  subtitleRevision: number;
  support: string | null;
}>;

type QualificationContext = Readonly<{
  acceptanceIdentity: QualificationIdentity;
  acceptanceSubtitleIdentity: QualificationSubtitleIdentity;
  lifecycle: PlaybackLifecycle;
  mediaAttachmentRevision: number;
  mediaDurationSeconds: number;
  observedRawDurationScaleToSeconds: number | null;
  response: unknown;
  routeKind: PlaybackRouteKind;
  startIdentity: QualificationIdentity;
  startSubtitleIdentity: QualificationSubtitleIdentity;
}>;

type CandidateMarker = Readonly<{
  name: QualificationMarkerName;
  timeSeconds: number;
}>;

const BASE_IDENTITY: QualificationIdentity = {
  contentEpoch: 3,
  contentInstanceId: 'fixture-content-instance',
  routeChangedAt: 1_000,
  videoId: 'fixture-video',
  videoRevision: 7,
};

const BASE_SUBTITLE_IDENTITY: QualificationSubtitleIdentity = {
  learning: 'native:fixture-learning',
  subtitleRevision: 11,
  support: 'native:fixture-support',
};

const marker = (
  name: string,
  time: number,
  overrides: Record<string, unknown> = {}
) => ({
  force_stop: false,
  id: 'fixture-marker-id',
  metadata: 'fixture-metadata',
  name,
  time,
  type: 'CODE',
  ...overrides,
});

const playbackResponse = (cuePoints: unknown, duration: unknown = 600_000) => ({
  data: {
    raw: {
      cue_points: cuePoints,
      duration,
      text_tracks: [],
    },
  },
});

const context = (
  response: unknown,
  overrides: Partial<QualificationContext> = {}
): QualificationContext => ({
  acceptanceIdentity: BASE_IDENTITY,
  acceptanceSubtitleIdentity: BASE_SUBTITLE_IDENTITY,
  lifecycle: 'content',
  mediaAttachmentRevision: BASE_IDENTITY.videoRevision,
  mediaDurationSeconds: 600,
  observedRawDurationScaleToSeconds: 0.001,
  response,
  routeKind: 'episode',
  startIdentity: BASE_IDENTITY,
  startSubtitleIdentity: BASE_SUBTITLE_IDENTITY,
  ...overrides,
});

const characterizeStrictOptionalProjection = (qualification: QualificationContext) => {
  if (!isCurrentSupportedContent(qualification)) {
    return { accepted: false as const, introInterval: null, terminalMarkers: [] };
  }

  const raw = asRecord(asRecord(asRecord(qualification.response)?.data)?.raw);
  const duration = raw?.duration;
  const cuePoints = raw?.cue_points;
  if (
    typeof duration !== 'number' ||
    !Number.isFinite(duration) ||
    duration < 0 ||
    qualification.observedRawDurationScaleToSeconds === null ||
    !Number.isFinite(qualification.observedRawDurationScaleToSeconds) ||
    qualification.observedRawDurationScaleToSeconds <= 0 ||
    !Array.isArray(cuePoints)
  ) {
    return { accepted: true as const, introInterval: null, terminalMarkers: [] };
  }

  const rawDurationSeconds = duration * qualification.observedRawDurationScaleToSeconds;
  const parsed = cuePoints.flatMap((value) => {
    const candidate = parseCandidateMarker(value, rawDurationSeconds, qualification.mediaDurationSeconds);
    return candidate ? [candidate] : [];
  });
  if (!isNondecreasing(parsed)) {
    return { accepted: true as const, introInterval: null, terminalMarkers: [] };
  }

  const unique = parsed.filter(
    ({ name }) => parsed.filter((candidate) => candidate.name === name).length === 1
  );
  const introStart = unique.find(({ name }) => name === 'skip_intro_start');
  const introEnd = unique.find(({ name }) => name === 'skip_intro_end');
  const terminalMarkers = unique.filter(({ name }) => name === 'watch_next');
  const terminalPrecedesIntroCompletion =
    introStart !== undefined &&
    introEnd !== undefined &&
    terminalMarkers.some(
      ({ timeSeconds }) => timeSeconds <= introEnd.timeSeconds
    );
  if (terminalPrecedesIntroCompletion) {
    return { accepted: true as const, introInterval: null, terminalMarkers: [] };
  }
  const introInterval =
    introStart !== undefined &&
    introEnd !== undefined &&
    introStart.timeSeconds < introEnd.timeSeconds
      ? { endSeconds: introEnd.timeSeconds, startSeconds: introStart.timeSeconds }
      : null;

  return { accepted: true as const, introInterval, terminalMarkers };
};

const parseCandidateMarker = (
  value: unknown,
  rawDurationSeconds: number,
  mediaDurationSeconds: number
): CandidateMarker | null => {
  const candidate = asRecord(value);
  if (!candidate) return null;
  const expectedKeys = ['force_stop', 'id', 'metadata', 'name', 'time', 'type'];
  if (
    Object.keys(candidate).length !== expectedKeys.length ||
    !expectedKeys.every((key) => key in candidate) ||
    candidate.type !== 'CODE' ||
    candidate.force_stop !== false ||
    typeof candidate.id !== 'string' ||
    candidate.id.length === 0 ||
    typeof candidate.metadata !== 'string' ||
    !isQualificationMarkerName(candidate.name) ||
    typeof candidate.time !== 'number' ||
    !Number.isFinite(candidate.time) ||
    candidate.time < 0 ||
    candidate.time > rawDurationSeconds ||
    candidate.time > mediaDurationSeconds
  ) {
    return null;
  }
  return { name: candidate.name, timeSeconds: candidate.time };
};

const isCurrentSupportedContent = ({
  acceptanceIdentity,
  acceptanceSubtitleIdentity,
  lifecycle,
  mediaAttachmentRevision,
  mediaDurationSeconds,
  routeKind,
  startIdentity,
  startSubtitleIdentity,
}: QualificationContext) =>
  routeKind === 'episode' &&
  lifecycle === 'content' &&
  acceptanceIdentity.videoId !== null &&
  mediaAttachmentRevision === acceptanceIdentity.videoRevision &&
  acceptanceSubtitleIdentity.learning !== null &&
  Number.isFinite(mediaDurationSeconds) &&
  mediaDurationSeconds >= 0 &&
  Object.entries(startIdentity).every(
    ([key, value]) => acceptanceIdentity[key as keyof QualificationIdentity] === value
  ) &&
  Object.entries(startSubtitleIdentity).every(
    ([key, value]) =>
      acceptanceSubtitleIdentity[key as keyof QualificationSubtitleIdentity] === value
  );

const isNondecreasing = (markers: readonly CandidateMarker[]) =>
  markers.every(
    ({ timeSeconds }, index) => index === 0 || markers[index - 1].timeSeconds <= timeSeconds
  );

const isQualificationMarkerName = (value: unknown): value is QualificationMarkerName =>
  typeof value === 'string' &&
  QUALIFICATION_MARKER_NAMES.includes(value as QualificationMarkerName);

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

describe('playback-marker qualification-only projection', () => {
  it('keeps an unqualified movie recommendation marker out of candidate semantics', () => {
    const result = characterizeStrictOptionalProjection(
      context(
        playbackResponse([
          marker('skip_intro_start', 10),
          marker('skip_intro_end', 40),
          marker('show_recommendations', 560),
        ]),
        { routeKind: 'movie' }
      )
    );

    expect(result).toEqual({
      accepted: false,
      introInterval: null,
      terminalMarkers: [],
    });
  });

  it('characterizes the episode terminal shape independently', () => {
    const result = characterizeStrictOptionalProjection(
      context(
        playbackResponse([
          marker('skip_intro_start', 12),
          marker('skip_intro_end', 48),
          marker('watch_next', 540),
        ]),
        { routeKind: 'episode' }
      )
    );

    expect(result).toEqual({
      accepted: true,
      introInterval: { endSeconds: 48, startSeconds: 12 },
      terminalMarkers: [{ name: 'watch_next', timeSeconds: 540 }],
    });
  });

  it.each([undefined, null, [], {}, 'drifted'])('fails closed for %s cue_points', (cuePoints) => {
    const result = characterizeStrictOptionalProjection(context(playbackResponse(cuePoints)));

    expect(result).toEqual({ accepted: true, introInterval: null, terminalMarkers: [] });
  });

  it('fails closed when raw duration evidence is absent', () => {
    const result = characterizeStrictOptionalProjection(
      context({ data: { raw: { cue_points: [marker('watch_next', 500)] } } })
    );

    expect(result.terminalMarkers).toEqual([]);
  });

  it('fails closed when the raw-duration unit relationship is unproven', () => {
    const result = characterizeStrictOptionalProjection(
      context(playbackResponse([marker('watch_next', 500)]), {
        observedRawDurationScaleToSeconds: null,
      })
    );

    expect(result.terminalMarkers).toEqual([]);
  });

  it.each([null, '600000', {}, Number.NaN, Number.POSITIVE_INFINITY, -1])(
    'fails closed for %s raw duration evidence',
    (duration) => {
      const result = characterizeStrictOptionalProjection(
        context(playbackResponse([marker('watch_next', 500)], duration))
      );

      expect(result.terminalMarkers).toEqual([]);
    }
  );

  it('rejects a qualified marker beyond normalized raw duration', () => {
    const result = characterizeStrictOptionalProjection(
      context(playbackResponse([marker('watch_next', 500)], 400_000))
    );

    expect(result.terminalMarkers).toEqual([]);
  });

  it('rejects a qualified marker beyond media duration', () => {
    const result = characterizeStrictOptionalProjection(
      context(playbackResponse([marker('watch_next', 500)]), {
        mediaDurationSeconds: 400,
      })
    );

    expect(result.terminalMarkers).toEqual([]);
  });

  it('rejects malformed entries individually while preserving a valid sibling', () => {
    const result = characterizeStrictOptionalProjection(
      context(
        playbackResponse([
          marker('watch_next', 500),
          marker('skip_intro_start', Number.NaN),
          marker('skip_intro_end', -1),
          marker('skip_intro_start', Number.POSITIVE_INFINITY),
          marker('show_recommendations', 700),
          marker('watch_next', 510, { extra: true }),
          marker('watch_next', 520, { name: 'unknown-marker' }),
          marker('skip_intro_start', 20, { type: 1 }),
          marker('skip_intro_end', 30, { force_stop: 'false' }),
          marker('skip_intro_end', 32, { force_stop: true }),
          marker('show_recommendations', 530, { id: null }),
          marker('show_recommendations', 535, { metadata: null }),
          marker('show_recommendations', 540, { time: '540' }),
          {
            force_stop: false,
            id: 'fixture-marker-id',
            metadata: 'fixture-metadata',
            name: 'skip_intro_end',
            time: 40,
          },
          null,
        ])
      )
    );

    expect(result).toEqual({
      accepted: true,
      introInterval: null,
      terminalMarkers: [{ name: 'watch_next', timeSeconds: 500 }],
    });
  });

  it('withholds ambiguous duplicates instead of selecting by array position', () => {
    const result = characterizeStrictOptionalProjection(
      context(
        playbackResponse([
          marker('skip_intro_start', 10),
          marker('skip_intro_start', 11),
          marker('skip_intro_end', 40),
          marker('watch_next', 500),
          marker('watch_next', 501),
        ])
      )
    );

    expect(result).toEqual({ accepted: true, introInterval: null, terminalMarkers: [] });
  });

  it.each([
    [40, 10],
    [10, 10],
  ])('withholds reversed or equal intro intervals', (start, end) => {
      const result = characterizeStrictOptionalProjection(
        context(
          playbackResponse([
            marker('skip_intro_start', start),
            marker('skip_intro_end', end),
            marker('watch_next', 500),
          ])
        )
      );

      expect(result.introInterval).toBeNull();
  });

  it('withholds an intro interval that overlaps an ordered terminal marker', () => {
    const result = characterizeStrictOptionalProjection(
      context(
        playbackResponse([
          marker('skip_intro_start', 10),
          marker('watch_next', 20),
          marker('skip_intro_end', 40),
        ])
      )
    );

    expect(result.introInterval).toBeNull();
    expect(result.terminalMarkers).toEqual([]);
  });

  it('fails closed when a terminal marker precedes an otherwise ordered intro pair', () => {
    const result = characterizeStrictOptionalProjection(
      context(
        playbackResponse([
          marker('watch_next', 5),
          marker('skip_intro_start', 10),
          marker('skip_intro_end', 40),
        ])
      )
    );

    expect(result).toEqual({ accepted: true, introInterval: null, terminalMarkers: [] });
  });

  it('fails the optional projection closed when valid marker times are out of source order', () => {
    const result = characterizeStrictOptionalProjection(
      context(playbackResponse([marker('watch_next', 500), marker('skip_intro_start', 10)]))
    );

    expect(result).toEqual({ accepted: true, introInterval: null, terminalMarkers: [] });
  });

  it.each([
    { acceptanceIdentity: { ...BASE_IDENTITY, contentEpoch: 4 } },
    { acceptanceIdentity: { ...BASE_IDENTITY, contentInstanceId: 'replacement-instance' } },
    { acceptanceIdentity: { ...BASE_IDENTITY, routeChangedAt: 1_001 } },
    { acceptanceIdentity: { ...BASE_IDENTITY, videoId: 'replacement-video' } },
    { acceptanceIdentity: { ...BASE_IDENTITY, videoId: null } },
    { acceptanceIdentity: { ...BASE_IDENTITY, videoRevision: 8 } },
    { mediaAttachmentRevision: 8 },
    {
      acceptanceSubtitleIdentity: {
        ...BASE_SUBTITLE_IDENTITY,
        learning: 'native:replacement',
      },
    },
    { acceptanceSubtitleIdentity: { ...BASE_SUBTITLE_IDENTITY, learning: null } },
    { acceptanceSubtitleIdentity: { ...BASE_SUBTITLE_IDENTITY, support: null } },
    { acceptanceSubtitleIdentity: { ...BASE_SUBTITLE_IDENTITY, subtitleRevision: 12 } },
    { mediaDurationSeconds: Number.NaN },
  ])('rejects stale P0 or proposed subtitle context %#', (overrides) => {
    const result = characterizeStrictOptionalProjection(
      context(playbackResponse([marker('watch_next', 500)]), overrides)
    );

    expect(result).toEqual({ accepted: false, introInterval: null, terminalMarkers: [] });
  });

  it.each(PLAYBACK_LIFECYCLES.filter((lifecycle) => lifecycle !== 'content'))(
    'rejects the %s production lifecycle',
    (lifecycle) => {
      const result = characterizeStrictOptionalProjection(
        context(playbackResponse([marker('watch_next', 500)]), { lifecycle })
      );

      expect(result).toEqual({ accepted: false, introInterval: null, terminalMarkers: [] });
    }
  );

  it.each(PLAYBACK_ROUTE_KINDS.filter((routeKind) => routeKind !== 'episode'))(
    'rejects the %s route outside the selected discussion scope',
    (routeKind) => {
      const result = characterizeStrictOptionalProjection(
        context(playbackResponse([marker('watch_next', 500)]), { routeKind })
      );

      expect(result).toEqual({ accepted: false, introInterval: null, terminalMarkers: [] });
    }
  );
});
