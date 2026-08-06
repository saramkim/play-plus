import type { DeletedLearningCard } from '@storage/v2/learning-card-storage';
import type { LearningCard } from '@storage/v2/type';
import type {
  OpenSubtitlesDownloadedSubtitle,
  OpenSubtitlesErrorCode,
  OpenSubtitlesSearchQuery,
  OpenSubtitlesSearchResult,
} from '@utils/opensubtitles/type';

export type SubtitleRole = 'learning' | 'support';

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
    params: { startTime: number };
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
  pingContent: {
    response: {
      contentInstanceId: string;
      hasVideo: boolean;
      routeChangedAt: number;
      videoId: string | null;
      videoRevision: number;
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
