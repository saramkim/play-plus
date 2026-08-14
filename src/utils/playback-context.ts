import { z } from 'zod';

import { getCoupangPlayVideoId } from './coupang-play';

export const PLAYBACK_ROUTE_KINDS = [
  'movie',
  'episode',
  'trailer',
  'channel',
  'highlight',
  'unknown',
] as const;
export type PlaybackRouteKind = (typeof PLAYBACK_ROUTE_KINDS)[number];

export const PLAYBACK_LIFECYCLES = [
  'waiting',
  'placeholder',
  'advertisement',
  'content',
  'transitioning',
] as const;
export type PlaybackLifecycle = (typeof PLAYBACK_LIFECYCLES)[number];

export type PlaybackSubtitleIdentity = Readonly<{
  learning: string | null;
  subtitleRevision: number;
  support: string | null;
}>;

export type PlaybackContextStatus = Readonly<{
  contentEpoch: number;
  contentInstanceId: string;
  learningAvailable: boolean;
  lifecycle: PlaybackLifecycle;
  mediaAttachmentRevision: number;
  missionResumeRequired: boolean;
  routeChangedAt: number;
  routeKind: PlaybackRouteKind;
  subtitleIdentity: PlaybackSubtitleIdentity;
  videoId: string | null;
  videoRevision: number;
}>;

const nonnegativeSafeIntegerSchema = z.number().int().nonnegative().refine(Number.isSafeInteger);
const playbackSubtitleIdentitySchema = z
  .object({
    learning: z.string().min(1).nullable(),
    subtitleRevision: nonnegativeSafeIntegerSchema,
    support: z.string().min(1).nullable(),
  })
  .strict();

export const playbackContextStatusSchema = z
  .object({
    contentEpoch: nonnegativeSafeIntegerSchema,
    contentInstanceId: z.string().min(1),
    learningAvailable: z.boolean(),
    lifecycle: z.enum(PLAYBACK_LIFECYCLES),
    mediaAttachmentRevision: nonnegativeSafeIntegerSchema,
    missionResumeRequired: z.boolean(),
    routeChangedAt: z.number().finite().nonnegative(),
    routeKind: z.enum(PLAYBACK_ROUTE_KINDS),
    subtitleIdentity: playbackSubtitleIdentitySchema,
    videoId: z.string().min(1).nullable(),
    videoRevision: nonnegativeSafeIntegerSchema,
  })
  .strict()
  .refine(({ mediaAttachmentRevision, videoRevision }) => mediaAttachmentRevision === videoRevision, {
    path: ['mediaAttachmentRevision'],
  });

export const selectPlaybackContextStatus = (
  status: PlaybackContextStatus
): PlaybackContextStatus => ({
  contentEpoch: status.contentEpoch,
  contentInstanceId: status.contentInstanceId,
  learningAvailable: status.learningAvailable,
  lifecycle: status.lifecycle,
  mediaAttachmentRevision: status.mediaAttachmentRevision,
  missionResumeRequired: status.missionResumeRequired,
  routeChangedAt: status.routeChangedAt,
  routeKind: status.routeKind,
  subtitleIdentity: status.subtitleIdentity,
  videoId: status.videoId,
  videoRevision: status.videoRevision,
});

const ROUTE_KIND_BY_TITLE_TYPE = {
  CHANNEL: 'channel',
  EPISODE: 'episode',
  HIGHLIGHT: 'highlight',
  MOVIE: 'movie',
  TRAILER: 'trailer',
} as const satisfies Record<string, Exclude<PlaybackRouteKind, 'unknown'>>;

const ROUTE_KIND_PATTERN = /\/play\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/([^/]+)\/?$/i;

export const getCoupangPlayRouteKindSignal = (
  url?: string | null
): Exclude<PlaybackRouteKind, 'unknown'> | null => {
  if (!getCoupangPlayVideoId(url)) return null;
  try {
    const match = new URL(url as string).pathname.match(ROUTE_KIND_PATTERN);
    if (!match) return null;
    const kind = match[1].toLowerCase();
    return isRecognizedRouteKind(kind) ? kind : null;
  } catch {
    return null;
  }
};

export const getPlaybackTitleTypeSignal = (
  url?: string | null
): Exclude<PlaybackRouteKind, 'unknown'> | null => {
  if (!url) return null;
  try {
    const values = new URL(url).searchParams.getAll('titleType');
    if (values.length !== 1) return null;
    return ROUTE_KIND_BY_TITLE_TYPE[values[0] as keyof typeof ROUTE_KIND_BY_TITLE_TYPE] ?? null;
  } catch {
    return null;
  }
};

export const derivePlaybackRouteKind = (
  routeSignal: Exclude<PlaybackRouteKind, 'unknown'> | null,
  titleTypeSignal: Exclude<PlaybackRouteKind, 'unknown'> | null
): PlaybackRouteKind =>
  routeSignal !== null && routeSignal === titleTypeSignal ? routeSignal : 'unknown';

export const deriveLearningAvailability = ({
  hasCurrentContentIdentity,
  hasCurrentMediaAttachment,
  hasCurrentSubtitleIdentity,
  lifecycle,
  routeKind,
}: {
  hasCurrentContentIdentity: boolean;
  hasCurrentMediaAttachment: boolean;
  hasCurrentSubtitleIdentity: boolean;
  lifecycle: PlaybackLifecycle;
  routeKind: PlaybackRouteKind;
}) =>
  (routeKind === 'movie' || routeKind === 'episode') &&
  lifecycle === 'content' &&
  hasCurrentContentIdentity &&
  hasCurrentMediaAttachment &&
  hasCurrentSubtitleIdentity;

const isRecognizedRouteKind = (
  value: string
): value is Exclude<PlaybackRouteKind, 'unknown'> =>
  value === 'movie' ||
  value === 'episode' ||
  value === 'trailer' ||
  value === 'channel' ||
  value === 'highlight';
