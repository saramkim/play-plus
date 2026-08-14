import { getCoupangPlayVideoId } from '@utils/coupang-play';
import {
  deriveLearningAvailability,
  derivePlaybackRouteKind,
  getCoupangPlayRouteKindSignal,
  getPlaybackTitleTypeSignal,
  type PlaybackContextStatus,
  type PlaybackLifecycle,
  type PlaybackSubtitleIdentity,
} from '@utils/playback-context';

export type PlaybackContextIdentity = Pick<
  PlaybackContextStatus,
  | 'contentEpoch'
  | 'contentInstanceId'
  | 'routeChangedAt'
  | 'videoId'
  | 'videoRevision'
>;

export class PlaybackContextController {
  private contentEpoch = 1;
  private lifecycle: PlaybackLifecycle = 'waiting';
  private routeChangedAt: number;
  private routeSignal: ReturnType<typeof getCoupangPlayRouteKindSignal>;
  private titleTypeSignal: ReturnType<typeof getPlaybackTitleTypeSignal> = null;
  private videoId: string | null;
  private videoRevision = 0;

  constructor(
    private readonly contentInstanceId: string,
    initialUrl: string,
    private readonly now: () => number = () => Date.now()
  ) {
    this.routeChangedAt = 0;
    this.routeSignal = null;
    this.videoId = null;
    this.reset(initialUrl);
  }

  reset(initialUrl: string) {
    this.contentEpoch = 1;
    this.lifecycle = 'waiting';
    this.routeChangedAt = this.now();
    this.routeSignal = getCoupangPlayRouteKindSignal(initialUrl);
    this.titleTypeSignal = null;
    this.videoId = getCoupangPlayVideoId(initialUrl);
    this.videoRevision = 0;
  }

  observeLifecycle({
    lifecycle,
    url,
    videoId,
    videoRevision,
  }: {
    lifecycle: PlaybackLifecycle;
    url: string;
    videoId: string | null;
    videoRevision: number;
  }) {
    const routeVideoId = getCoupangPlayVideoId(url);
    const nextVideoId = lifecycle === 'content' ? (videoId ?? routeVideoId) : routeVideoId;
    const contentChanged = nextVideoId !== this.videoId;
    if (contentChanged) {
      this.contentEpoch += 1;
      this.routeChangedAt = this.now();
      this.routeSignal = getCoupangPlayRouteKindSignal(url);
      this.titleTypeSignal = null;
      this.videoId = nextVideoId;
    } else {
      this.routeSignal = getCoupangPlayRouteKindSignal(url);
    }
    this.lifecycle = lifecycle;
    this.videoRevision = videoRevision;
    return { contentChanged };
  }

  observePlaybackEvidence({
    expectedIdentity,
    playbackUrl,
  }: {
    expectedIdentity: PlaybackContextIdentity;
    playbackUrl: string;
  }) {
    if (!this.isIdentityCurrent(expectedIdentity)) return false;
    this.titleTypeSignal = getPlaybackTitleTypeSignal(playbackUrl);
    return true;
  }

  createIdentity(): PlaybackContextIdentity {
    return {
      contentEpoch: this.contentEpoch,
      contentInstanceId: this.contentInstanceId,
      routeChangedAt: this.routeChangedAt,
      videoId: this.videoId,
      videoRevision: this.videoRevision,
    };
  }

  createStatus({
    hasVideo,
    missionResumeRequired,
    subtitleIdentity,
    url,
  }: {
    hasVideo: boolean;
    missionResumeRequired: boolean;
    subtitleIdentity: PlaybackSubtitleIdentity;
    url: string;
  }): PlaybackContextStatus {
    const identity = this.createIdentity();
    const routeKind = derivePlaybackRouteKind(this.routeSignal, this.titleTypeSignal);
    const hasCurrentContentIdentity =
      identity.videoId !== null && getCoupangPlayVideoId(url) === identity.videoId;
    const hasCurrentMediaAttachment = hasVideo && this.lifecycle === 'content';
    const hasCurrentSubtitleIdentity = subtitleIdentity.learning !== null;

    return {
      ...identity,
      learningAvailable: deriveLearningAvailability({
        hasCurrentContentIdentity,
        hasCurrentMediaAttachment,
        hasCurrentSubtitleIdentity,
        lifecycle: this.lifecycle,
        routeKind,
      }),
      lifecycle: this.lifecycle,
      mediaAttachmentRevision: identity.videoRevision,
      missionResumeRequired,
      routeKind,
      subtitleIdentity,
    };
  }

  isIdentityCurrent(identity: PlaybackContextIdentity) {
    const current = this.createIdentity();
    return (
      identity.contentEpoch === current.contentEpoch &&
      identity.contentInstanceId === current.contentInstanceId &&
      identity.routeChangedAt === current.routeChangedAt &&
      identity.videoId === current.videoId &&
      identity.videoRevision === current.videoRevision
    );
  }
}
