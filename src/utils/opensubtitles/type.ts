import { Language } from '@utils/constants';

export const OPEN_SUBTITLES_API_ORIGIN = 'https://api.opensubtitles.com';
export const OPEN_SUBTITLES_API_BASE_URL = `${OPEN_SUBTITLES_API_ORIGIN}/api/v1`;
export const OPEN_SUBTITLES_DOWNLOAD_ORIGIN = 'https://www.opensubtitles.com';

export type OpenSubtitlesContentType = 'movie' | 'episode';

export interface OpenSubtitlesSearchQuery {
  query: string;
  language: Language;
  contentType?: OpenSubtitlesContentType;
  year?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  page?: number;
}

export interface OpenSubtitlesCandidate {
  fileId: number;
  fileName: string;
  language: Language;
  featureTitle: string;
  featureYear?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  release?: string;
  fps?: number;
  discNumber?: number;
  discCount?: number;
  autoTranslated?: boolean;
  hearingImpaired?: boolean;
  foreignPartsOnly?: boolean;
  fromTrusted?: boolean;
  rating?: number;
  votes?: number;
  downloadCount?: number;
  uploaderRank?: string;
  uploadDate?: string;
}

export interface OpenSubtitlesSearchResult {
  totalCount: number;
  totalPages: number;
  page: number;
  candidates: OpenSubtitlesCandidate[];
}

export interface OpenSubtitlesQuota {
  requests: number | null;
  remaining: number | null;
  resetTimeUtc: string | null;
}

export interface OpenSubtitlesDownloadedSubtitle {
  fileId: number;
  fileName: string;
  text: string;
  fromCache: boolean;
  quota?: OpenSubtitlesQuota;
}

export type OpenSubtitlesErrorCode =
  | 'API_KEY_MISSING'
  | 'USER_AGENT_MISSING'
  | 'INVALID_QUERY'
  | 'AUTH_REQUIRED'
  | 'ACCESS_DENIED'
  | 'DOWNLOAD_REJECTED'
  | 'RATE_LIMIT'
  | 'NETWORK'
  | 'SERVER'
  | 'INVALID_RESPONSE'
  | 'TEMPORARY_LINK_EXPIRED'
  | 'FILE_TOO_LARGE'
  | 'DECODE_FAILED';

export const getOpenSubtitlesLanguageCodes = (language: Language): readonly string[] => {
  if (language === 'zh-CN') return ['zh-cn'];
  if (language === 'zh-TW') return ['zh-tw'];
  if (language === 'pt') return ['pt-br', 'pt-pt'];
  return [language];
};

export const getProductLanguage = (language: string): Language | undefined => {
  const normalized = language.trim().toLowerCase();
  if (normalized === 'zh-cn') return 'zh-CN';
  if (normalized === 'zh-tw') return 'zh-TW';
  if (normalized === 'pt-br' || normalized === 'pt-pt') return 'pt';
  if (
    normalized === 'en' ||
    normalized === 'ko' ||
    normalized === 'ja' ||
    normalized === 'es' ||
    normalized === 'fr' ||
    normalized === 'de' ||
    normalized === 'pt' ||
    normalized === 'ru' ||
    normalized === 'ar'
  ) {
    return normalized;
  }
  return undefined;
};
