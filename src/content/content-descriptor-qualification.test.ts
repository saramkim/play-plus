import { getCoupangPlayVideoId } from '@utils/coupang-play';
import type { ContentVideoIdentity } from '@utils/message/type';
import {
  getCoupangPlayRouteKindSignal,
  playbackContextStatusSchema,
  type PlaybackContextStatus,
  type PlaybackLifecycle,
  type PlaybackRouteKind,
} from '@utils/playback-context';
import { describe, expect, it } from 'vitest';

// Tests-only evidence model for Issue #83. It does not import a production
// acquisition path and does not establish product support for metadata.
const VIDEO_ID = '123e4567-e89b-12d3-a456-426614174000';
const OTHER_VIDEO_ID = '123e4567-e89b-12d3-a456-426614174001';
const ORIGIN = 'https://www.coupangplay.com';
const MAX_ATTEMPTS = 8;
const MAX_RESPONSE_BYTES = 1024 * 1024;

type QualificationContext = Readonly<{
  identity: ContentVideoIdentity;
  playbackContext: PlaybackContextStatus;
  url: string;
}>;

type TextField =
  | { status: 'value'; value: string }
  | { status: 'empty' | 'invalid' | 'missing' | 'null' | 'wrong-type' };

type ScalarField =
  | { status: 'number'; value: number }
  | { status: 'string'; value: string }
  | { status: 'invalid' | 'missing' | 'not-applicable' | 'null' | 'wrong-type' };

type DescriptorProjection = Readonly<{
  episode: ScalarField;
  releaseYear: ScalarField;
  season: ScalarField;
  title: TextField;
}>;

type ActiveTabSnapshot = Readonly<{
  id: number;
  url: string;
}>;

type RequestPlan = Readonly<{
  init: Readonly<{
    credentials: 'include';
    method: 'GET';
    redirect: 'manual';
  }>;
  url: string;
}>;

type TerminalInput =
  | { kind: 'aborted' | 'offline' | 'timeout' }
  | { json: string; kind: 'response' };

type AttemptSettlement = Readonly<{
  acceptedDescriptor: DescriptorProjection | null;
  retryScheduled: false;
  status: string;
}>;

type ProjectionResult =
  | { status: 'ready'; descriptor: DescriptorProjection }
  | {
      status:
        | 'malformed'
        | 'response-identity-missing'
        | 'response-identity-mismatch'
        | 'response-identity-null'
        | 'response-identity-wrong-type'
        | 'response-kind-missing'
        | 'response-kind-mismatch'
        | 'response-kind-null'
        | 'response-kind-unrecognized'
        | 'response-kind-wrong-type';
    };

const BASE_STATUS: PlaybackContextStatus = {
  contentEpoch: 4,
  contentInstanceId: 'synthetic-content-instance',
  learningAvailable: false,
  lifecycle: 'content',
  mediaAttachmentRevision: 3,
  missionResumeRequired: false,
  routeChangedAt: 100,
  routeKind: 'movie',
  subtitleIdentity: {
    learning: null,
    subtitleRevision: 2,
    support: null,
  },
  videoId: VIDEO_ID,
  videoRevision: 3,
};

const toIdentity = (status: PlaybackContextStatus): ContentVideoIdentity => ({
  contentEpoch: status.contentEpoch,
  contentInstanceId: status.contentInstanceId,
  routeChangedAt: status.routeChangedAt,
  videoId: status.videoId,
  videoRevision: status.videoRevision,
});

const createContext = (
  patch: Partial<PlaybackContextStatus> = {},
  url = `${ORIGIN}/en/play/${VIDEO_ID}/movie`
): QualificationContext => {
  const playbackContext = { ...BASE_STATUS, ...patch };
  return {
    identity: toIdentity(playbackContext),
    playbackContext,
    url,
  };
};

const isSameIdentity = (left: ContentVideoIdentity, right: ContentVideoIdentity) =>
  left.contentEpoch === right.contentEpoch &&
  left.contentInstanceId === right.contentInstanceId &&
  left.routeChangedAt === right.routeChangedAt &&
  left.videoId === right.videoId &&
  left.videoRevision === right.videoRevision;

const isEligible = (context: QualificationContext, expected: ContentVideoIdentity) => {
  const parsed = playbackContextStatusSchema.safeParse(context.playbackContext);
  if (!parsed.success) return false;
  const status = parsed.data;
  return (
    isSameIdentity(context.identity, expected) &&
    status.contentEpoch === context.identity.contentEpoch &&
    status.contentInstanceId === context.identity.contentInstanceId &&
    status.routeChangedAt === context.identity.routeChangedAt &&
    status.videoId === context.identity.videoId &&
    status.videoRevision === context.identity.videoRevision &&
    status.mediaAttachmentRevision === context.identity.videoRevision &&
    status.lifecycle === 'content' &&
    (status.routeKind === 'movie' || status.routeKind === 'episode') &&
    context.identity.videoId !== null &&
    getCoupangPlayVideoId(context.url) === context.identity.videoId &&
    getCoupangPlayRouteKindSignal(context.url) === status.routeKind
  );
};

const createTarget = (context: QualificationContext) => {
  if (!isEligible(context, context.identity) || context.identity.videoId === null) return null;
  let route: URL;
  try {
    route = new URL(context.url);
  } catch {
    return null;
  }
  if (route.origin !== ORIGIN) return null;
  const locale = route.pathname.startsWith('/en/play/')
    ? 'en'
    : route.pathname.startsWith('/play/')
      ? 'ko'
      : null;
  if (locale === null) return null;
  const target = new URL(
    `/api-discover/v1/discover/titles/${context.identity.videoId}`,
    ORIGIN
  );
  target.searchParams.set('locale', locale);
  return target;
};

const createRequestPlan = (context: QualificationContext): RequestPlan | null => {
  const target = createTarget(context);
  if (target === null) return null;
  return {
    init: {
      credentials: 'include',
      method: 'GET',
      redirect: 'manual',
    },
    url: target.href,
  };
};

const isExactActiveTab = (expected: ActiveTabSnapshot, current: ActiveTabSnapshot) =>
  expected.id === current.id && expected.url === current.url;

const isRequestAdmitted = (
  context: QualificationContext,
  expectedIdentity: ContentVideoIdentity,
  expectedTab: ActiveTabSnapshot,
  currentTab: ActiveTabSnapshot
) =>
  expectedTab.url === context.url &&
  isExactActiveTab(expectedTab, currentTab) &&
  isEligible(context, expectedIdentity);

const isAcceptanceCurrent = (start: QualificationContext, end: QualificationContext) =>
  start.url === end.url &&
  isSameIdentity(start.identity, end.identity) &&
  start.playbackContext.lifecycle === end.playbackContext.lifecycle &&
  start.playbackContext.routeKind === end.playbackContext.routeKind &&
  start.playbackContext.mediaAttachmentRevision ===
    end.playbackContext.mediaAttachmentRevision;

const projectDescriptor = (
  value: unknown,
  routeKind: 'episode' | 'movie',
  expectedVideoId: string
): ProjectionResult => {
  if (!isRecord(value)) return { status: 'malformed' };
  if (!('id' in value)) return { status: 'response-identity-missing' };
  if (value.id === null) return { status: 'response-identity-null' };
  if (typeof value.id !== 'string') return { status: 'response-identity-wrong-type' };
  if (value.id !== expectedVideoId) return { status: 'response-identity-mismatch' };
  if (!('as' in value)) return { status: 'response-kind-missing' };
  if (value.as === null) return { status: 'response-kind-null' };
  if (typeof value.as !== 'string') return { status: 'response-kind-wrong-type' };
  const kind = value.as === 'MOVIE' ? 'movie' : value.as === 'EPISODE' ? 'episode' : null;
  if (kind === null) return { status: 'response-kind-unrecognized' };
  if (kind !== routeKind) return { status: 'response-kind-mismatch' };

  return {
    status: 'ready',
    descriptor: {
      episode: kind === 'episode' ? readScalar(value, 'episode') : { status: 'not-applicable' },
      releaseYear: isRecord(value.meta)
        ? readScalar(value.meta, 'releaseYear')
        : value.meta === null
          ? { status: 'null' }
          : value.meta === undefined
            ? { status: 'missing' }
            : { status: 'wrong-type' },
      season: kind === 'episode' ? readScalar(value, 'season') : { status: 'not-applicable' },
      title: readText(value, 'title'),
    },
  };
};

const readText = (record: Record<string, unknown>, key: string): TextField => {
  if (!(key in record)) return { status: 'missing' };
  const value = record[key];
  if (value === null) return { status: 'null' };
  if (typeof value !== 'string') return { status: 'wrong-type' };
  if (value.trim().length === 0) return { status: 'empty' };
  if (value.length > 512) return { status: 'invalid' };
  return { status: 'value', value };
};

const readScalar = (record: Record<string, unknown>, key: string): ScalarField => {
  if (!(key in record)) return { status: 'missing' };
  const value = record[key];
  if (value === null) return { status: 'null' };
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0
      ? { status: 'number', value }
      : { status: 'invalid' };
  }
  if (typeof value === 'string') {
    return value.length > 0 && value.length <= 32
      ? { status: 'string', value }
      : { status: 'invalid' };
  }
  return { status: 'wrong-type' };
};

const countBoundedBytes = (chunkSizes: readonly number[]) => {
  let total = 0;
  for (const size of chunkSizes) {
    total += size;
    if (total > MAX_RESPONSE_BYTES) return { status: 'too-large' as const, total };
  }
  return { status: 'ready' as const, total };
};

const classifyResponseBoundary = ({
  ok,
  redirected,
  responseUrl,
  status,
  target,
  type,
}: {
  ok: boolean;
  redirected: boolean;
  responseUrl: string;
  status: number;
  target: URL;
  type: ResponseType;
}) => {
  if (
    redirected ||
    type === 'opaqueredirect' ||
    (status >= 300 && status < 400) ||
    responseUrl !== target.href
  ) {
    return 'boundary-error' as const;
  }
  return ok ? ('ready' as const) : ('http-error' as const);
};

class AttemptGate {
  attemptsStarted = 0;
  pending = false;
  private controller: AbortController | null = null;
  private stale = false;

  get drifted() {
    return this.stale;
  }

  get signal() {
    return this.controller?.signal ?? null;
  }

  start(eligible: boolean) {
    if (this.pending) return 'busy' as const;
    if (!eligible) return 'unsupported' as const;
    if (this.attemptsStarted >= MAX_ATTEMPTS) return 'limit-reached' as const;
    this.attemptsStarted += 1;
    this.controller = new AbortController();
    this.pending = true;
    this.stale = false;
    return 'started' as const;
  }

  abortForDrift() {
    if (!this.pending) return false;
    this.stale = true;
    this.controller?.abort();
    return true;
  }

  abortPending() {
    if (!this.pending) return false;
    this.controller?.abort();
    return true;
  }

  finish() {
    this.controller = null;
    this.pending = false;
    this.stale = false;
  }
}

const settleAttempt = ({
  currentTab,
  endContext,
  expectedTab,
  gate,
  startContext,
  terminal,
}: {
  currentTab: ActiveTabSnapshot;
  endContext: QualificationContext;
  expectedTab: ActiveTabSnapshot;
  gate: AttemptGate;
  startContext: QualificationContext;
  terminal: TerminalInput;
}): AttemptSettlement => {
  if (!gate.pending) {
    return {
      acceptedDescriptor: null,
      retryScheduled: false,
      status: 'late-ignored',
    };
  }

  const acceptanceDrifted =
    !isExactActiveTab(expectedTab, currentTab) ||
    !isAcceptanceCurrent(startContext, endContext);
  if (acceptanceDrifted) gate.abortForDrift();

  let acceptedDescriptor: DescriptorProjection | null = null;
  let status: string;
  if (gate.drifted) {
    status = 'stale';
  } else if (terminal.kind === 'offline' || terminal.kind === 'timeout') {
    if (terminal.kind === 'timeout') gate.abortPending();
    status = 'network-error';
  } else if (terminal.kind === 'aborted') {
    gate.abortPending();
    status = 'aborted';
  } else if (terminal.kind !== 'response') {
    status = 'aborted';
  } else {
    let parsed: unknown;
    try {
      parsed = JSON.parse(terminal.json) as unknown;
    } catch {
      parsed = undefined;
    }
    if (parsed === undefined) {
      status = 'malformed';
    } else {
      const routeKind = startContext.playbackContext.routeKind;
      const expectedVideoId = startContext.identity.videoId;
      if (
        expectedVideoId === null ||
        (routeKind !== 'movie' && routeKind !== 'episode')
      ) {
        status = 'stale';
      } else {
        const projection = projectDescriptor(parsed, routeKind, expectedVideoId);
        status = projection.status;
        if (projection.status === 'ready') acceptedDescriptor = projection.descriptor;
      }
    }
  }

  gate.finish();
  return {
    acceptedDescriptor,
    retryScheduled: false,
    status,
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

describe('P3 tests-only content descriptor qualification evidence model', () => {
  it('constructs one exact English same-origin detail target from the current route ID', () => {
    const target = createTarget(createContext());

    expect(target?.origin).toBe(ORIGIN);
    expect(target?.pathname).toBe(`/api-discover/v1/discover/titles/${VIDEO_ID}`);
    expect([...target?.searchParams.entries() ?? []]).toEqual([['locale', 'en']]);
  });

  it('constructs only the allowed Korean locale query for a synthetic Korean route', () => {
    const target = createTarget(
      createContext({}, `${ORIGIN}/play/${VIDEO_ID}/movie`)
    );

    expect([...target?.searchParams.entries() ?? []]).toEqual([['locale', 'ko']]);
  });

  it('models the admitted request as GET with browser credentials and no body or headers', () => {
    const plan = createRequestPlan(createContext());

    expect(plan).not.toBeNull();
    if (plan === null) return;
    expect(plan.init).toEqual({
      credentials: 'include',
      method: 'GET',
      redirect: 'manual',
    });
    expect('body' in plan.init).toBe(false);
    expect('headers' in plan.init).toBe(false);
  });

  it.each([
    ['tab ID', { id: 18, url: `${ORIGIN}/en/play/${VIDEO_ID}/movie` }],
    ['exact URL', { id: 17, url: `${ORIGIN}/en/play/${VIDEO_ID}/movie?drift=1` }],
    ['locale URL', { id: 17, url: `${ORIGIN}/play/${VIDEO_ID}/movie` }],
  ] satisfies readonly [string, ActiveTabSnapshot][]) (
    'issues zero requests after an active %s mismatch',
    (_label, currentTab) => {
      const context = createContext();
      const expectedTab = { id: 17, url: context.url };
      const gate = new AttemptGate();

      expect(
        gate.start(isRequestAdmitted(context, context.identity, expectedTab, currentTab))
      ).toBe('unsupported');
      expect(gate.attemptsStarted).toBe(0);
    }
  );

  it.each([
    ['different origin', `${ORIGIN.replace('www.', '')}/en/play/${VIDEO_ID}/movie`],
    ['unsupported locale prefix', `${ORIGIN}/ja/play/${VIDEO_ID}/movie`],
    ['malformed URL', 'not-a-url'],
    ['different route ID', `${ORIGIN}/en/play/${OTHER_VIDEO_ID}/movie`],
    ['same-ID trailer route', `${ORIGIN}/en/play/${VIDEO_ID}/trailer`],
    ['same-ID channel route', `${ORIGIN}/en/play/${VIDEO_ID}/channel`],
    ['same-ID highlight route', `${ORIGIN}/en/play/${VIDEO_ID}/highlight`],
  ])('rejects target construction for %s', (_label, url) => {
    expect(createTarget(createContext({}, url))).toBeNull();
  });

  it.each<readonly [string, PlaybackLifecycle]>([
    ['waiting', 'waiting'],
    ['placeholder', 'placeholder'],
    ['advertisement', 'advertisement'],
    ['transitioning', 'transitioning'],
  ])('issues zero requests for %s lifecycle', (_label, lifecycle) => {
    const context = createContext({ lifecycle });
    expect(isEligible(context, context.identity)).toBe(false);
  });

  it.each<readonly [string, PlaybackRouteKind]>([
    ['trailer', 'trailer'],
    ['channel', 'channel'],
    ['highlight', 'highlight'],
    ['unknown', 'unknown'],
  ])('issues zero requests for %s routes', (_label, routeKind) => {
    const context = createContext({ routeKind });
    expect(isEligible(context, context.identity)).toBe(false);
  });

  it.each([
    ['content epoch', { contentEpoch: 5 }],
    ['content instance', { contentInstanceId: 'other-instance' }],
    ['route changed time', { routeChangedAt: 101 }],
    ['video ID', { videoId: OTHER_VIDEO_ID }],
    ['video revision', { videoRevision: 4 }],
  ] satisfies readonly [string, Partial<ContentVideoIdentity>][]) (
    'rejects an expected identity mismatch in %s',
    (_label, patch) => {
      const context = createContext();
      expect(isEligible(context, { ...context.identity, ...patch })).toBe(false);
    }
  );

  it('rejects a media attachment revision mismatch before the request', () => {
    const context = createContext({ mediaAttachmentRevision: 4 });
    expect(isEligible(context, context.identity)).toBe(false);
  });

  it('does not require learning availability or a native subtitle source', () => {
    const context = createContext({
      learningAvailable: false,
      subtitleIdentity: { learning: null, subtitleRevision: 0, support: null },
    });
    expect(isEligible(context, context.identity)).toBe(true);
  });

  it.each([
    ['content epoch', { contentEpoch: 5 }],
    ['content instance', { contentInstanceId: 'other-instance' }],
    ['route changed time', { routeChangedAt: 101 }],
    ['video ID', { videoId: OTHER_VIDEO_ID }],
    ['video revision', { videoRevision: 4, mediaAttachmentRevision: 4 }],
    ['media attachment', { mediaAttachmentRevision: 4 }],
    ['lifecycle', { lifecycle: 'advertisement' as const }],
    ['transition lifecycle', { lifecycle: 'transitioning' as const }],
    ['route kind', { routeKind: 'episode' as const }],
  ] satisfies readonly [string, Partial<PlaybackContextStatus>][]) (
    'rejects acceptance after %s changes',
    (_label, patch) => {
      const start = createContext();
      const end = createContext(patch);
      expect(isAcceptanceCurrent(start, end)).toBe(false);
    }
  );

  it('projects movie fields independently without inventing episode fields', () => {
    const projected = projectDescriptor(
      {
        as: 'MOVIE',
        id: VIDEO_ID,
        meta: { releaseYear: 2026 },
        title: 'Synthetic movie',
      },
      'movie',
      VIDEO_ID
    );

    expect(projected).toEqual({
      status: 'ready',
      descriptor: {
        episode: { status: 'not-applicable' },
        releaseYear: { status: 'number', value: 2026 },
        season: { status: 'not-applicable' },
        title: { status: 'value', value: 'Synthetic movie' },
      },
    });
  });

  it('observes string scalar types without normalizing them', () => {
    const projected = projectDescriptor(
      {
        as: 'EPISODE',
        episode: '02',
        id: VIDEO_ID,
        meta: { releaseYear: '2026' },
        season: '01',
        title: 'Synthetic episode',
      },
      'episode',
      VIDEO_ID
    );

    expect(projected.status).toBe('ready');
    if (projected.status !== 'ready') return;
    expect(projected.descriptor.releaseYear).toEqual({ status: 'string', value: '2026' });
    expect(projected.descriptor.season).toEqual({ status: 'string', value: '01' });
    expect(projected.descriptor.episode).toEqual({ status: 'string', value: '02' });
  });

  it('keeps missing, null, and wrong-type fields independent from a valid envelope', () => {
    const projected = projectDescriptor(
      {
        as: 'EPISODE',
        episode: null,
        id: VIDEO_ID,
        meta: 'unexpected',
        title: 7,
      },
      'episode',
      VIDEO_ID
    );

    expect(projected).toEqual({
      status: 'ready',
      descriptor: {
        episode: { status: 'null' },
        releaseYear: { status: 'wrong-type' },
        season: { status: 'missing' },
        title: { status: 'wrong-type' },
      },
    });
  });

  it.each([
    ['empty title', { title: '   ' }, { status: 'empty' }],
    ['oversize title', { title: 'x'.repeat(513) }, { status: 'invalid' }],
    ['negative season', { season: -1 }, { status: 'invalid' }],
    ['fractional episode', { episode: 1.5 }, { status: 'invalid' }],
    ['empty release year', { meta: { releaseYear: '' } }, { status: 'invalid' }],
  ] as const)('fails the %s field closed without rejecting siblings', (_label, patch, expected) => {
    const base = {
      as: 'EPISODE',
      episode: 2,
      id: VIDEO_ID,
      meta: { releaseYear: 2026 },
      season: 1,
      title: 'Synthetic episode',
    };
    const projected = projectDescriptor({ ...base, ...patch }, 'episode', VIDEO_ID);
    expect(projected.status).toBe('ready');
    if (projected.status !== 'ready') return;
    const field = _label.includes('title')
      ? projected.descriptor.title
      : _label.includes('season')
        ? projected.descriptor.season
        : _label.includes('episode')
          ? projected.descriptor.episode
          : projected.descriptor.releaseYear;
    expect(field).toEqual(expected);
  });

  it('rejects a response ID mismatch without exposing either ID', () => {
    expect(projectDescriptor({ as: 'MOVIE', id: OTHER_VIDEO_ID }, 'movie', VIDEO_ID)).toEqual({
      status: 'response-identity-mismatch',
    });
  });

  it.each([
    ['missing', { as: 'MOVIE' }, 'response-identity-missing'],
    ['null', { as: 'MOVIE', id: null }, 'response-identity-null'],
    ['wrong type', { as: 'MOVIE', id: 7 }, 'response-identity-wrong-type'],
  ])('distinguishes a %s response identity without exposing a value', (_label, value, status) => {
    expect(projectDescriptor(value, 'movie', VIDEO_ID)).toEqual({ status });
  });

  it.each([
    ['movie versus episode', { as: 'EPISODE', id: VIDEO_ID }, 'response-kind-mismatch'],
    ['TV show', { as: 'TVSHOW', id: VIDEO_ID }, 'response-kind-unrecognized'],
    ['missing', { id: VIDEO_ID }, 'response-kind-missing'],
    ['null', { as: null, id: VIDEO_ID }, 'response-kind-null'],
    ['wrong type', { as: 7, id: VIDEO_ID }, 'response-kind-wrong-type'],
  ])('distinguishes response kind boundary for %s', (_label, value, status) => {
    expect(projectDescriptor(value, 'movie', VIDEO_ID)).toEqual({ status });
  });

  it('does not treat title_canonical, order, or parent_id as selected descriptor fields', () => {
    const projected = projectDescriptor(
      {
        as: 'EPISODE',
        id: VIDEO_ID,
        order: 9,
        parent_id: OTHER_VIDEO_ID,
        title_canonical: 'Synthetic canonical copy',
      },
      'episode',
      VIDEO_ID
    );
    expect(projected).toEqual({
      status: 'ready',
      descriptor: {
        episode: { status: 'missing' },
        releaseYear: { status: 'missing' },
        season: { status: 'missing' },
        title: { status: 'missing' },
      },
    });
  });

  it.each([null, [], 'text', 3])('rejects non-object response envelope %j', (value) => {
    expect(projectDescriptor(value, 'movie', VIDEO_ID)).toEqual({ status: 'malformed' });
  });

  it('accepts exactly 1 MiB of streamed bytes', () => {
    expect(countBoundedBytes([512 * 1024, 512 * 1024])).toEqual({
      status: 'ready',
      total: MAX_RESPONSE_BYTES,
    });
  });

  it('fails closed at 1 MiB plus one byte without inspecting headers', () => {
    expect(countBoundedBytes([MAX_RESPONSE_BYTES, 1])).toEqual({
      status: 'too-large',
      total: MAX_RESPONSE_BYTES + 1,
    });
  });

  it.each([
    ['redirect flag', { redirected: true }],
    ['opaque redirect', { type: 'opaqueredirect' as const }],
    ['3xx status', { status: 302 }],
    ['changed origin/path/query', { responseUrl: `${ORIGIN}/unexpected` }],
  ])('classifies %s as a hard boundary error', (_label, patch) => {
    const target = createTarget(createContext());
    expect(target).not.toBeNull();
    if (target === null) return;
    expect(classifyResponseBoundary({
      ok: true,
      redirected: false,
      responseUrl: target.href,
      status: 200,
      target,
      type: 'basic',
      ...patch,
    })).toBe('boundary-error');
  });

  it.each([400, 401, 403, 404, 429, 500, 502, 503])(
    'classifies provider HTTP %i without retrying',
    (status) => {
      const target = createTarget(createContext());
      expect(target).not.toBeNull();
      if (target === null) return;
      expect(classifyResponseBoundary({
        ok: false,
        redirected: false,
        responseUrl: target.href,
        status,
        target,
        type: 'basic',
      })).toBe('http-error');
    }
  );

  it('does not count an unsupported preflight as an actual GET attempt', () => {
    const gate = new AttemptGate();
    expect(gate.start(false)).toBe('unsupported');
    expect(gate.attemptsStarted).toBe(0);
  });

  it('coalesces a duplicate action while one GET is pending', () => {
    const gate = new AttemptGate();
    expect(gate.start(true)).toBe('started');
    expect(gate.start(true)).toBe('busy');
    expect(gate.attemptsStarted).toBe(1);
  });

  it('counts eight explicit started attempts and blocks attempt nine', () => {
    const gate = new AttemptGate();
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      expect(gate.start(true), `attempt ${attempt}`).toBe('started');
      gate.finish();
    }
    expect(gate.attemptsStarted).toBe(MAX_ATTEMPTS);
    expect(gate.start(true)).toBe('limit-reached');
  });

  it.each(['offline', 'timeout'] as const)(
    'settles %s as a released network error without retry or acceptance',
    (kind) => {
      const startContext = createContext();
      const activeTab = { id: 17, url: startContext.url };
      const gate = new AttemptGate();
      expect(gate.start(true)).toBe('started');
      const signal = gate.signal;
      expect(signal).not.toBeNull();

      expect(settleAttempt({
        currentTab: activeTab,
        endContext: startContext,
        expectedTab: activeTab,
        gate,
        startContext,
        terminal: { kind },
      })).toEqual({
        acceptedDescriptor: null,
        retryScheduled: false,
        status: 'network-error',
      });
      expect(gate.pending).toBe(false);
      expect(gate.attemptsStarted).toBe(1);
      expect(signal?.aborted).toBe(kind === 'timeout');
    }
  );

  it('settles malformed JSON without retrying or exposing a descriptor', () => {
    const startContext = createContext();
    const activeTab = { id: 17, url: startContext.url };
    const gate = new AttemptGate();
    expect(gate.start(true)).toBe('started');

    expect(settleAttempt({
      currentTab: activeTab,
      endContext: startContext,
      expectedTab: activeTab,
      gate,
      startContext,
      terminal: { json: '{', kind: 'response' },
    })).toEqual({
      acceptedDescriptor: null,
      retryScheduled: false,
      status: 'malformed',
    });
    expect(gate.pending).toBe(false);
    expect(gate.attemptsStarted).toBe(1);
  });

  it('aborts for active-tab drift and ignores a late response without retrying', () => {
    const startContext = createContext();
    const expectedTab = { id: 17, url: startContext.url };
    const gate = new AttemptGate();
    expect(gate.start(true)).toBe('started');
    const signal = gate.signal;
    expect(signal).not.toBeNull();

    expect(settleAttempt({
      currentTab: { ...expectedTab, url: `${startContext.url}?drift=1` },
      endContext: startContext,
      expectedTab,
      gate,
      startContext,
      terminal: {
        json: JSON.stringify({ as: 'MOVIE', id: VIDEO_ID, title: 'Synthetic movie' }),
        kind: 'response',
      },
    })).toEqual({
      acceptedDescriptor: null,
      retryScheduled: false,
      status: 'stale',
    });
    expect(signal?.aborted).toBe(true);
    expect(settleAttempt({
      currentTab: expectedTab,
      endContext: startContext,
      expectedTab,
      gate,
      startContext,
      terminal: {
        json: JSON.stringify({ as: 'MOVIE', id: VIDEO_ID, title: 'Synthetic movie' }),
        kind: 'response',
      },
    })).toEqual({
      acceptedDescriptor: null,
      retryScheduled: false,
      status: 'late-ignored',
    });
    expect(gate.pending).toBe(false);
    expect(gate.attemptsStarted).toBe(1);
  });

  it('releases an explicit aborted attempt without retrying or accepting a descriptor', () => {
    const startContext = createContext();
    const activeTab = { id: 17, url: startContext.url };
    const gate = new AttemptGate();
    expect(gate.start(true)).toBe('started');
    const signal = gate.signal;
    expect(signal).not.toBeNull();

    expect(settleAttempt({
      currentTab: activeTab,
      endContext: startContext,
      expectedTab: activeTab,
      gate,
      startContext,
      terminal: { kind: 'aborted' },
    })).toEqual({
      acceptedDescriptor: null,
      retryScheduled: false,
      status: 'aborted',
    });
    expect(signal?.aborted).toBe(true);
    expect(gate.pending).toBe(false);
    expect(gate.attemptsStarted).toBe(1);
  });

  it('gives P0 drift precedence over a concurrent offline terminal', () => {
    const startContext = createContext();
    const activeTab = { id: 17, url: startContext.url };
    const gate = new AttemptGate();
    expect(gate.start(true)).toBe('started');
    const signal = gate.signal;

    expect(settleAttempt({
      currentTab: activeTab,
      endContext: createContext({ lifecycle: 'transitioning' }),
      expectedTab: activeTab,
      gate,
      startContext,
      terminal: { kind: 'offline' },
    })).toEqual({
      acceptedDescriptor: null,
      retryScheduled: false,
      status: 'stale',
    });
    expect(signal?.aborted).toBe(true);
    expect(gate.pending).toBe(false);
    expect(gate.attemptsStarted).toBe(1);
  });

  it('projects no URL, ID, header, credential, raw body, or unrelated metadata field', () => {
    const projected = projectDescriptor(
      {
        as: 'MOVIE',
        authorization: 'synthetic-forbidden',
        description: 'Synthetic excluded description',
        id: VIDEO_ID,
        meta: { releaseYear: 2026 },
        title: 'Synthetic movie',
        url: `${ORIGIN}/synthetic`,
      },
      'movie',
      VIDEO_ID
    );
    const serialized = JSON.stringify(projected);
    expect(serialized).not.toContain('authorization');
    expect(serialized).not.toContain('description');
    expect(serialized).not.toContain(VIDEO_ID);
    expect(serialized).not.toContain('/synthetic');
  });
});
