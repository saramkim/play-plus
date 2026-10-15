import { SubtitleId } from '@storage/subtitle';
import { NativeSubtitleBatch } from '@utils/native-subtitles';

export type MessageSchema = {
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
    params: { subtitleId: SubtitleId; delay: number; expectedVideoId: string };
  };
  restoreUploadedSubtitles: {
    params: { primarySubtitle: SubtitleId | null; secondarySubtitle: SubtitleId | null };
    response: { primarySubtitle: SubtitleId | null; secondarySubtitle: SubtitleId | null };
  };
  updateCurrentTime: {
    params: number;
  };
  updateSubtitles: {
    params: NativeSubtitleBatch;
  };
  pingContent: {
    response: { hasVideo: boolean };
  };
  contentStatus: {
    params: { hasVideo: boolean; isVideoUrl: boolean; restoreUploadedSubtitles?: boolean };
  };
  getVideoTime: {
    response: number;
  };
};
