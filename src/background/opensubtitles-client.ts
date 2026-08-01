import { Language } from '@utils/constants';
import {
  getOpenSubtitlesLanguageCodes,
  getProductLanguage,
  OPEN_SUBTITLES_API_BASE_URL,
  OPEN_SUBTITLES_DOWNLOAD_ORIGIN,
  OpenSubtitlesCandidate,
  OpenSubtitlesDownloadedSubtitle,
  OpenSubtitlesErrorCode,
  OpenSubtitlesQuota,
  OpenSubtitlesSearchQuery,
  OpenSubtitlesSearchResult,
} from '@utils/opensubtitles/type';
import {
  assertSubtitleFileSize,
  decodeSubtitleBytes,
  MAX_SUBTITLE_FILE_SIZE_BYTES,
  SubtitleDecodeError,
} from '@utils/subtitle-decode';

export interface CachedSubtitle {
  fileId: number;
  fileName: string;
  text: string;
}

export interface SubtitleCache {
  get(fileId: number): Promise<CachedSubtitle | null>;
  set(entry: CachedSubtitle): Promise<void>;
  clear(): Promise<void>;
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
type RetryDelay = (milliseconds: number) => Promise<void>;

interface OpenSubtitlesClientOptions {
  apiKey: string;
  userAgent: string;
  cache: SubtitleCache;
  fetcher?: Fetcher;
  retryDelay?: RetryDelay;
}

export class OpenSubtitlesError extends Error {
  constructor(
    public readonly code: OpenSubtitlesErrorCode,
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'OpenSubtitlesError';
  }
}

export interface OpenSubtitlesErrorDetails {
  code: OpenSubtitlesErrorCode;
  message: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isPositiveInteger = (value: number | undefined) => {
  return value === undefined || (Number.isSafeInteger(value) && value > 0);
};

const finiteNumber = (value: unknown) => {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const finiteNumberAtLeast = (value: unknown, minimum: number) => {
  const parsed = finiteNumber(value);
  return parsed !== undefined && parsed >= minimum ? parsed : undefined;
};

const safeIntegerAtLeast = (value: unknown, minimum: number) => {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum ? value : undefined;
};

const finiteNumberOrNull = (value: unknown) => finiteNumber(value) ?? null;

const nonEmptyString = (value: unknown) => {
  return typeof value === 'string' && value.trim() ? value : undefined;
};

const validDateString = (value: unknown) => {
  const parsed = nonEmptyString(value);
  return parsed && Number.isFinite(Date.parse(parsed)) ? parsed : undefined;
};

const trueOrUndefined = (value: unknown) => value === true ? true : undefined;

const errorForStatus = (status: number) => {
  if (status === 400) return new OpenSubtitlesError('INVALID_QUERY', 'OpenSubtitles rejected the search conditions.', status);
  if (status === 401) return new OpenSubtitlesError('AUTH_REQUIRED', 'OpenSubtitles requires authentication for this request.', status);
  if (status === 403) return new OpenSubtitlesError('ACCESS_DENIED', 'OpenSubtitles denied this request.', status);
  if (status === 406) return new OpenSubtitlesError('DOWNLOAD_REJECTED', 'OpenSubtitles rejected the download request.', status);
  if (status === 429) return new OpenSubtitlesError('RATE_LIMIT', 'OpenSubtitles is rate limiting requests.', status);
  if (status >= 500) return new OpenSubtitlesError('SERVER', 'OpenSubtitles is temporarily unavailable.', status);
  return new OpenSubtitlesError('INVALID_RESPONSE', 'OpenSubtitles returned an unexpected response.', status);
};

const parseJson = async (response: Response) => {
  try {
    return await response.json() as unknown;
  } catch {
    throw new OpenSubtitlesError('INVALID_RESPONSE', 'OpenSubtitles returned unreadable data.', response.status);
  }
};

const serializeSearchQuery = (query: OpenSubtitlesSearchQuery) => {
  const searchText = query.query.trim();
  if (!searchText || !isPositiveInteger(query.year) || !isPositiveInteger(query.seasonNumber)
    || !isPositiveInteger(query.episodeNumber) || !isPositiveInteger(query.page)) {
    throw new OpenSubtitlesError('INVALID_QUERY', 'Check the OpenSubtitles search conditions.');
  }
  if (query.contentType !== undefined && query.contentType !== 'movie' && query.contentType !== 'episode') {
    throw new OpenSubtitlesError('INVALID_QUERY', 'Check the OpenSubtitles search conditions.');
  }

  const values: Record<string, string | undefined> = {
    episode_number: query.episodeNumber?.toString(),
    languages: getOpenSubtitlesLanguageCodes(query.language).join(','),
    page: query.page && query.page > 1 ? query.page.toString() : undefined,
    query: searchText.toLowerCase(),
    season_number: query.seasonNumber?.toString(),
    type: query.contentType,
    year: query.year?.toString(),
  };
  const parameters = new URLSearchParams();
  for (const key of Object.keys(values).sort()) {
    const value = values[key];
    if (value !== undefined) parameters.set(key, value);
  }
  return parameters.toString();
};

const mapSearchResponse = (value: unknown, requestedLanguage: Language): OpenSubtitlesSearchResult => {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    throw new OpenSubtitlesError('INVALID_RESPONSE', 'OpenSubtitles returned malformed search data.');
  }
  const page = safeIntegerAtLeast(value.page, 1);
  const totalPages = safeIntegerAtLeast(value.total_pages, 0);
  const totalCount = safeIntegerAtLeast(value.total_count, 0);
  if (page === undefined || totalPages === undefined || totalCount === undefined) {
    throw new OpenSubtitlesError('INVALID_RESPONSE', 'OpenSubtitles returned malformed search data.');
  }
  if ((totalPages === 0 && (page !== 1 || totalCount !== 0 || value.data.length !== 0))
    || (totalPages > 0 && page > totalPages)) {
    throw new OpenSubtitlesError('INVALID_RESPONSE', 'OpenSubtitles returned contradictory paging data.');
  }

  const candidates: OpenSubtitlesCandidate[] = [];
  for (const entry of value.data) {
    if (!isRecord(entry) || !isRecord(entry.attributes)) {
      throw new OpenSubtitlesError('INVALID_RESPONSE', 'OpenSubtitles returned malformed search data.');
    }
    const attributes = entry.attributes;
    const files = attributes.files;
    if (!Array.isArray(files)) {
      throw new OpenSubtitlesError('INVALID_RESPONSE', 'OpenSubtitles returned malformed search data.');
    }
    const feature = isRecord(attributes.feature_details) ? attributes.feature_details : {};
    const uploader = isRecord(attributes.uploader) ? attributes.uploader : {};
    const language = typeof attributes.language === 'string'
      ? getProductLanguage(attributes.language) ?? requestedLanguage
      : requestedLanguage;
    const featureTitle = nonEmptyString(feature.title) ?? nonEmptyString(feature.movie_name) ?? '';
    const discCount = safeIntegerAtLeast(attributes.nb_cd, 1);

    for (const file of files) {
      if (!isRecord(file) || !Number.isSafeInteger(file.file_id) || (file.file_id as number) < 1
        || nonEmptyString(file.file_name) === undefined) {
        throw new OpenSubtitlesError('INVALID_RESPONSE', 'OpenSubtitles returned malformed search data.');
      }
      const discNumber = safeIntegerAtLeast(file.cd_number, 1);
      candidates.push({
        fileId: file.file_id as number,
        fileName: file.file_name as string,
        language,
        featureTitle,
        featureYear: finiteNumber(feature.year),
        seasonNumber: finiteNumber(feature.season_number),
        episodeNumber: finiteNumber(feature.episode_number),
        release: nonEmptyString(attributes.release),
        fps: finiteNumber(attributes.fps),
        discNumber: discCount && discNumber && discNumber <= discCount ? discNumber : undefined,
        discCount,
        autoTranslated: trueOrUndefined(attributes.ai_translated) || trueOrUndefined(attributes.machine_translated),
        hearingImpaired: trueOrUndefined(attributes.hearing_impaired),
        foreignPartsOnly: trueOrUndefined(attributes.foreign_parts_only),
        fromTrusted: trueOrUndefined(attributes.from_trusted),
        rating: finiteNumberAtLeast(attributes.ratings, 0),
        votes: safeIntegerAtLeast(attributes.votes, 0),
        downloadCount: safeIntegerAtLeast(attributes.download_count, 0),
        uploaderRank: nonEmptyString(uploader.rank),
        uploadDate: validDateString(attributes.upload_date),
      });
    }
  }

  return { totalCount, totalPages, page, candidates };
};

const isAllowedDownloadUrl = (value: string) => {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.origin === OPEN_SUBTITLES_DOWNLOAD_ORIGIN &&
      !url.username &&
      !url.password &&
      url.pathname.startsWith('/download/')
    );
  } catch {
    return false;
  }
};

const fetchSubtitleFile = async (fetcher: Fetcher, downloadUrl: string) => {
  if (!isAllowedDownloadUrl(downloadUrl)) {
    throw new OpenSubtitlesError('INVALID_RESPONSE', 'OpenSubtitles returned an unsupported download host.');
  }

  let response: Response;
  try {
    response = await fetcher(downloadUrl, { method: 'GET', redirect: 'error' });
  } catch {
    throw new OpenSubtitlesError('NETWORK', 'Could not download the subtitle file.');
  }

  const finalUrl = response.url || downloadUrl;
  if (response.redirected || !isAllowedDownloadUrl(finalUrl)) {
    throw new OpenSubtitlesError('INVALID_RESPONSE', 'OpenSubtitles returned an unsupported download host.');
  }
  return response;
};

const getDownloadedFileName = (value: unknown, fileId: number) => {
  const fileName = nonEmptyString(value);
  if (!fileName) return undefined;
  const leafName = fileName.split(/[\\/]/).at(-1)?.trim();
  if (!leafName) return `opensubtitles-${fileId}.srt`;
  if (/\.(srt|vtt|smi)$/i.test(leafName)) return leafName;
  const baseName = leafName.replace(/\.[^.]+$/, '').trim();
  return `${baseName || `opensubtitles-${fileId}`}.srt`;
};

const readLimitedResponseBytes = async (response: Response) => {
  const contentLength = response.headers.get('content-length');
  if (contentLength !== null) {
    const declaredLength = Number(contentLength);
    if (Number.isSafeInteger(declaredLength) && declaredLength >= 0) {
      assertSubtitleFileSize(declaredLength);
    }
  }

  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    assertSubtitleFileSize(bytes.byteLength);
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_SUBTITLE_FILE_SIZE_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new SubtitleDecodeError('FILE_TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

const getQuota = (value: Record<string, unknown>): OpenSubtitlesQuota | undefined => {
  const quota = {
    requests: finiteNumberOrNull(value.requests),
    remaining: finiteNumberOrNull(value.remaining),
    resetTimeUtc: nonEmptyString(value.reset_time_utc) ?? null,
  };
  return quota.requests !== null || quota.remaining !== null || quota.resetTimeUtc !== null ? quota : undefined;
};

export const getOpenSubtitlesErrorDetails = (error: unknown): OpenSubtitlesErrorDetails => {
  if (error instanceof OpenSubtitlesError) return { code: error.code, message: error.message };
  return { code: 'SERVER', message: 'The OpenSubtitles request failed.' };
};

export const createOpenSubtitlesClient = (options: OpenSubtitlesClientOptions) => {
  const apiKey = options.apiKey.trim();
  const userAgent = options.userAgent.trim();
  const fetcher = options.fetcher ?? fetch;
  const retryDelay = options.retryDelay ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const pendingDownloads = new Map<number, Promise<OpenSubtitlesDownloadedSubtitle>>();

  const assertConfigured = () => {
    if (!apiKey) throw new OpenSubtitlesError('API_KEY_MISSING', 'The OpenSubtitles API key is not configured.');
    if (!userAgent) throw new OpenSubtitlesError('USER_AGENT_MISSING', 'The OpenSubtitles application identifier is not configured.');
  };
  const headers = {
    Accept: 'application/json',
    'Api-Key': apiKey,
    'X-User-Agent': userAgent,
  };

  const search = async (query: OpenSubtitlesSearchQuery): Promise<OpenSubtitlesSearchResult> => {
    assertConfigured();
    const url = `${OPEN_SUBTITLES_API_BASE_URL}/subtitles?${serializeSearchQuery(query)}`;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let response: Response;
      try {
        response = await fetcher(url, { method: 'GET', headers, redirect: 'error' });
      } catch {
        if (attempt === 0) {
          await retryDelay(1000);
          continue;
        }
        throw new OpenSubtitlesError('NETWORK', 'Could not connect to OpenSubtitles.');
      }

      if (response.ok) return mapSearchResponse(await parseJson(response), query.language);
      if (response.status >= 500 && attempt === 0) {
        await retryDelay(1000);
        continue;
      }
      throw errorForStatus(response.status);
    }
    throw new OpenSubtitlesError('SERVER', 'OpenSubtitles is temporarily unavailable.');
  };

  const performDownload = async (fileId: number, language: Language): Promise<OpenSubtitlesDownloadedSubtitle> => {
    assertConfigured();
    try {
      const cached = await options.cache.get(fileId);
      if (cached) return { ...cached, fromCache: true };
    } catch {
      // A session-cache failure must not block a provider download.
    }

    let downloadResponse: Response;
    try {
      downloadResponse = await fetcher(`${OPEN_SUBTITLES_API_BASE_URL}/download`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId, sub_format: 'srt' }),
        redirect: 'error',
      });
    } catch {
      throw new OpenSubtitlesError('NETWORK', 'Could not connect to OpenSubtitles.');
    }
    if (!downloadResponse.ok) throw errorForStatus(downloadResponse.status);
    const download = await parseJson(downloadResponse);
    if (!isRecord(download) || nonEmptyString(download.link) === undefined
      || nonEmptyString(download.file_name) === undefined || !isAllowedDownloadUrl(download.link as string)) {
      throw new OpenSubtitlesError('INVALID_RESPONSE', 'OpenSubtitles returned an invalid download link.');
    }
    const fileName = getDownloadedFileName(download.file_name, fileId);
    if (!fileName) {
      throw new OpenSubtitlesError('INVALID_RESPONSE', 'OpenSubtitles returned an invalid subtitle filename.');
    }

    const fileResponse = await fetchSubtitleFile(fetcher, download.link as string);
    if (!fileResponse.ok) {
      if (fileResponse.status === 403 || fileResponse.status === 404 || fileResponse.status === 410) {
        throw new OpenSubtitlesError('TEMPORARY_LINK_EXPIRED', 'The OpenSubtitles download link expired.', fileResponse.status);
      }
      throw errorForStatus(fileResponse.status);
    }

    let text: string;
    try {
      text = decodeSubtitleBytes(await readLimitedResponseBytes(fileResponse), language);
    } catch (error) {
      if (error instanceof SubtitleDecodeError) {
        const message = error.code === 'FILE_TOO_LARGE'
          ? 'The subtitle file is larger than 1 MiB.'
          : 'The subtitle file encoding could not be decoded.';
        throw new OpenSubtitlesError(error.code, message);
      }
      throw new OpenSubtitlesError('NETWORK', 'Could not read the subtitle file.');
    }

    const entry = { fileId, fileName, text };
    try {
      await options.cache.set(entry);
    } catch {
      // A session-cache failure must not discard a successfully downloaded subtitle.
    }
    const quota = getQuota(download);
    return { ...entry, fromCache: false, ...(quota ? { quota } : {}) };
  };

  const download = (fileId: number, language: Language) => {
    if (!Number.isSafeInteger(fileId) || fileId < 1) {
      return Promise.reject(new OpenSubtitlesError('INVALID_QUERY', 'Select a valid OpenSubtitles file.'));
    }
    const pending = pendingDownloads.get(fileId);
    if (pending) return pending;
    const request = performDownload(fileId, language).finally(() => pendingDownloads.delete(fileId));
    pendingDownloads.set(fileId, request);
    return request;
  };

  return { search, download, clearCache: () => options.cache.clear() };
};
