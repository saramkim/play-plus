import type { DeletedLearningCard } from '@storage/v2/learning-card-storage';
import type { LearningCard } from '@storage/v2/type';
import type { Language } from '@utils/constants';
import type {
  OpenSubtitlesDownloadedSubtitle,
  OpenSubtitlesErrorCode,
  OpenSubtitlesSearchQuery,
  OpenSubtitlesSearchResult,
} from '@utils/opensubtitles/type';

export type SubtitleRole = 'learning' | 'support';

export type ContentVideoIdentity = {
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
      requestId: string;
      videoId: string | null;
      url: string;
      headers: chrome.webRequest.HttpHeader[];
    };
  };
  playVideo: {
    params: {
      startTime: number;
      expectedIdentity?: ContentVideoIdentity;
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
  pingContent: {
    response: ContentVideoIdentity & {
      hasVideo: boolean;
    };
  };
  contentStatus: {
    params: {
      contentInstanceId: string;
      hasVideo: boolean;
      isVideoUrl: boolean;
      routeChangedAt: number;
      videoId: string | null;
      videoRevision: number;
    };
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
};
