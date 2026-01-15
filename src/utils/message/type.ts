import { SubtitleId } from '@storage/subtitle';
import { SubtitleData } from '@utils/parse';

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
  getVideoTime: {
    response: number;
  };
};
