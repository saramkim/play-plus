import { SubtitleId } from '@storage/subtitle';
import {
  OpenSubtitlesDownloadedSubtitle,
  OpenSubtitlesErrorCode,
  OpenSubtitlesSearchQuery,
  OpenSubtitlesSearchResult,
} from '@utils/opensubtitles/type';
import { SubtitleData } from '@utils/parse';

export type MessageSchema = {
  contentInitialized: void;
  resetElement: void;
  detectVideo: void;
  fetchVideoMetadata: {
    params: { url: string; headers: chrome.webRequest.HttpHeader[] };
  };
  playVideo: {
    params: { startTime: number };
  };
  viewVideo: {
    params: { url: string; startTime: number };
  };
  setPrimarySubtitle: {
    params: { subtitleId: SubtitleId | null; delay: number };
  };
  setSecondarySubtitle: {
    params: { subtitleId: SubtitleId | null; delay: number };
  };
  updateSubtitleDelay: {
    params: { subtitleId: SubtitleId; delay: number };
  };
  updateCurrentTime: {
    params: number;
  };
  updateSubtitles: {
    params: { lang: string; subtitleData: SubtitleData[] | null };
  };
  pingContent: {
    response: { hasVideo: boolean };
  };
  contentStatus: {
    params: { hasVideo: boolean; isVideoUrl: boolean };
  };
  getVideoTime: {
    response: number;
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
};
