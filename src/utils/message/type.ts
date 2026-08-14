import type { DeletedLearningCard } from '@storage/v2/learning-card-storage';
import type { ListeningMissionResult } from '@storage/v2/listening-progress-storage';
import type { LearningCard, ListeningProgressV1 } from '@storage/v2/type';
import type { Language } from '@utils/constants';
import type {
  OpenSubtitlesDownloadedSubtitle,
  OpenSubtitlesErrorCode,
  OpenSubtitlesSearchQuery,
  OpenSubtitlesSearchResult,
} from '@utils/opensubtitles/type';
import type { PlaybackContextStatus } from '@utils/playback-context';

import type {
  ListeningSegmentKey,
  ListeningSourceKey,
} from '@/listening/domain/source-identity';
import type { EndSessionResult, PlaySegmentResult } from '@/listening/session/mission-controller';

export type SubtitleRole = 'learning' | 'support';

export type ContentVideoIdentity = {
  contentEpoch: number;
  contentInstanceId: string;
  routeChangedAt: number;
  videoId: string | null;
  videoRevision: number;
};

export type SubtitleOverviewCue = {
  sourceIndex: number;
  startTime: number;
  endTime: number;
  text: string;
};

export type SubtitleOverviewLearningCue = SubtitleOverviewCue & {
  alignedSupport?: {
    sourceIndices: number[];
    text: string;
  };
};

export type SubtitleOverviewSource =
  | { kind: 'native'; language: Language }
  | {
      kind: 'registered';
      language: Language;
      subtitleId: string;
      delaySeconds: number;
    };

export type SubtitleOverviewTrack<Cue extends SubtitleOverviewCue = SubtitleOverviewCue> = {
  role: SubtitleRole;
  language: Language;
  source: SubtitleOverviewSource;
  cues: Cue[];
};

export type SubtitleOverviewResponse =
  | {
      status: 'ready';
      identity: ContentVideoIdentity;
      subtitleRevision: number;
      currentTime: number;
      tracks: {
        learning: SubtitleOverviewTrack<SubtitleOverviewLearningCue>;
        support: SubtitleOverviewTrack | null;
      };
    }
  | { status: 'no-video'; identity: ContentVideoIdentity };

export type VideoTimeResponse =
  | {
      status: 'ready';
      identity: ContentVideoIdentity;
      subtitleRevision: number;
      currentTime: number;
    }
  | { status: 'no-video'; identity: ContentVideoIdentity };

export type PlayVideoResponse =
  | { status: 'played' }
  | { status: 'stale' }
  | { status: 'no-video' };

export type SaveSubtitleOverviewCueResponse =
  | { status: 'saved-with-support' }
  | { status: 'saved-learning-only' }
  | { status: 'stale' }
  | { status: 'no-video' }
  | { status: 'cue-unavailable' }
  | { status: 'busy' }
  | { status: 'error' };

export type ContentBootstrap = {
  learningSubtitleId: string | null;
  supportSubtitleId: string | null;
};

export type V2ReadinessStatus =
  | { status: 'ready' }
  | { status: 'error'; code: 'migration-failed' };

export type ListeningCatalogSegmentSummary = Readonly<{
  segmentKey: ListeningSegmentKey;
  startMs: number;
  endMs: number;
}>;

export type ListeningCatalogResponse =
  | {
      status: 'ready';
      identity: ContentVideoIdentity;
      subtitleRevision: number;
      videoId: string;
      sourceKey: ListeningSourceKey;
      currentTime: number;
      segmenterVersion: 1;
      supportAvailable: boolean;
      segments: readonly ListeningCatalogSegmentSummary[];
    }
  | {
      status:
        | 'no-video'
        | 'video-identity-unavailable'
        | 'no-learning-track'
        | 'no-segments'
        | 'error';
    };

export type ListeningSessionSnapshotSegment = Readonly<{
  segmentKey: ListeningSegmentKey;
  sourceKey: ListeningSourceKey;
  sourceIndices: readonly number[];
  startMs: number;
  endMs: number;
  answerText: string;
  alignedSupport?: Readonly<{
    sourceIndices: readonly number[];
    text: string;
  }>;
}>;

export type ListeningSessionSnapshot = Readonly<{
  learningLanguage: Language;
  videoId: string;
  sourceKey: ListeningSourceKey;
  segmenterVersion: 1;
  segments: readonly ListeningSessionSnapshotSegment[];
}>;

export type BeginListeningSessionResponse =
  | {
      status: 'ready';
      sessionId: string;
      identity: ContentVideoIdentity;
      subtitleRevision: number;
      snapshot: ListeningSessionSnapshot;
    }
  | { status: 'busy' | 'stale' | 'no-video' | 'segment-unavailable' | 'error' };

export type HeartbeatListeningSessionResponse =
  | { status: 'alive' }
  | { status: 'stale' | 'no-video' | 'segment-unavailable' | 'error' };

export type ResumeListeningSessionAfterAdvertisementResponse =
  | {
      status: 'resumed';
      identity: ContentVideoIdentity;
      subtitleRevision: number;
    }
  | { status: 'stale' | 'no-video' | 'segment-unavailable' | 'error' };

export type PlayListeningSegmentResponse = PlaySegmentResult;

export type SaveListeningSegmentResponse =
  | { status: 'saved-with-support' | 'saved-learning-only' }
  | { status: 'busy' | 'stale' | 'no-video' | 'segment-unavailable' | 'error' };

export type EndListeningSessionResponse = EndSessionResult;

export type MessageSchema = {
  getV2Readiness: {
    response: V2ReadinessStatus;
  };
  retryV2Readiness: {
    response: V2ReadinessStatus;
  };
  contentInitialized: {
    response: ContentBootstrap;
  };
  resetElement: void;
  detectVideo: void;
  fetchVideoMetadata: {
    params: {
      expectedIdentity: ContentVideoIdentity;
      requestId: string;
      videoId: string | null;
      url: string;
      headers: chrome.webRequest.HttpHeader[];
    };
  };
  playVideo: {
    params: {
      startTime: number;
      expectedIdentity: ContentVideoIdentity;
      expectedSubtitleRevision?: number;
    };
    response: PlayVideoResponse;
  };
  viewVideo: {
    params: { url: string; startTime: number };
  };
  setSubtitleRole: {
    params: { role: SubtitleRole; subtitleId: string | null };
  };
  refreshRegisteredSubtitle: {
    params: { subtitleId: string };
  };
  getSubtitleOverview: {
    response: SubtitleOverviewResponse;
  };
  saveSubtitleOverviewCue: {
    params: {
      expectedIdentity: ContentVideoIdentity;
      expectedSubtitleRevision: number;
      learningSourceIndex: number;
    };
    response: SaveSubtitleOverviewCueResponse;
  };
  getVideoTime: {
    response: VideoTimeResponse;
  };
  getListeningCatalog: {
    response: ListeningCatalogResponse;
  };
  beginListeningSession: {
    params: {
      expectedIdentity: ContentVideoIdentity;
      expectedSubtitleRevision: number;
      segmentKeys: readonly ListeningSegmentKey[];
    };
    response: BeginListeningSessionResponse;
  };
  heartbeatListeningSession: {
    params: {
      sessionId: string;
      expectedIdentity: ContentVideoIdentity;
      expectedSubtitleRevision: number;
    };
    response: HeartbeatListeningSessionResponse;
  };
  resumeListeningSessionAfterAdvertisement: {
    params: {
      sessionId: string;
      expectedIdentity: ContentVideoIdentity;
      expectedSubtitleRevision: number;
    };
    response: ResumeListeningSessionAfterAdvertisementResponse;
  };
  playListeningSegment: {
    params: {
      sessionId: string;
      segmentKey: ListeningSegmentKey;
      rate: 1 | 0.75;
    };
    response: PlayListeningSegmentResponse;
  };
  saveListeningSegment: {
    params: {
      sessionId: string;
      segmentKey: ListeningSegmentKey;
    };
    response: SaveListeningSegmentResponse;
  };
  endListeningSession: {
    params: {
      sessionId: string;
      mode: 'restore-start' | 'complete-stay' | 'continue-watching';
    };
    response: EndListeningSessionResponse;
  };
  pingContent: {
    response: PlaybackContextStatus & {
      hasVideo: boolean;
    };
  };
  contentStatus: {
    params: PlaybackContextStatus & {
      hasVideo: boolean;
      isVideoUrl: boolean;
    };
  };
  getPlaybackContext: {
    params: { tabId: number };
    response: PlaybackContextStatus | null;
  };
  playbackContextChanged: {
    params: { status: PlaybackContextStatus | null; tabId: number };
  };
  searchOpenSubtitles: {
    params: OpenSubtitlesSearchQuery;
    response: OpenSubtitlesSearchResult;
    error: OpenSubtitlesErrorCode;
  };
  downloadOpenSubtitle: {
    params: { fileId: number; language: OpenSubtitlesSearchQuery['language'] };
    response: OpenSubtitlesDownloadedSubtitle;
    error: OpenSubtitlesErrorCode;
  };
  getLearningCards: {
    response: LearningCard[];
  };
  addLearningCard: {
    params: { card: LearningCard };
    response: LearningCard;
  };
  updateLearningCard: {
    params: { id: string; card: LearningCard };
    response: LearningCard;
  };
  deleteLearningCard: {
    params: { id: string };
    response: DeletedLearningCard;
  };
  restoreLearningCard: {
    params: { deleted: DeletedLearningCard };
    response: LearningCard;
  };
  getListeningProgress: {
    response: ListeningProgressV1;
  };
  recordListeningMissionResult: {
    params: { result: ListeningMissionResult };
    response: ListeningProgressV1;
  };
  clearListeningVideoProgress: {
    params: { videoId: string };
    response: ListeningProgressV1;
  };
  clearAllListeningProgress: {
    response: ListeningProgressV1;
  };
};
