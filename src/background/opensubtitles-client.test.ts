import { MAX_SUBTITLE_FILE_SIZE_BYTES } from '@utils/subtitle-decode';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createOpenSubtitlesClient,
  OpenSubtitlesError,
  SubtitleCache,
} from './opensubtitles-client';

const ALLOWED_DOWNLOAD_URL = 'https://www.opensubtitles.com/download/token/subfile/example.srt';

const jsonResponse = (body: unknown, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
};

const responseAt = (response: Response, url = ALLOWED_DOWNLOAD_URL) => {
  Object.defineProperty(response, 'url', { configurable: true, value: url });
  return response;
};

const createCache = (): SubtitleCache & { values: Map<number, { fileId: number; fileName: string; text: string }> } => {
  const values = new Map<number, { fileId: number; fileName: string; text: string }>();
  return {
    values,
    get: vi.fn(async (fileId) => values.get(fileId) ?? null),
    set: vi.fn(async (entry) => {
      values.set(entry.fileId, entry);
    }),
    clear: vi.fn(async () => {
      values.clear();
    }),
  };
};

const createClient = (overrides: Partial<Parameters<typeof createOpenSubtitlesClient>[0]> = {}) => {
  return createOpenSubtitlesClient({
    apiKey: 'consumer-key',
    userAgent: 'PlayPlus v1.11.0',
    cache: createCache(),
    retryDelay: async () => undefined,
    ...overrides,
  });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OpenSubtitles search', () => {
  it('uses consumer headers, normalizes the query, and flattens every returned file', async () => {
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({
      page: 1,
      total_pages: 2,
      total_count: 1,
      data: [{
        attributes: {
          language: 'pt-br',
          release: 'WEB-DL',
          fps: 23.976,
          nb_cd: 2,
          machine_translated: true,
          hearing_impaired: true,
          foreign_parts_only: true,
          from_trusted: true,
          ratings: 4.5,
          votes: 12,
          download_count: 1234,
          upload_date: '2026-07-31T12:34:56Z',
          uploader: { name: 'not exposed', rank: 'Trusted member' },
          feature_details: {
            title: 'Example',
            year: 2025,
            season_number: 2,
            episode_number: 3,
          },
          files: [
            { file_id: 11, file_name: 'one.srt', cd_number: 1 },
            { file_id: 12, file_name: 'two.srt', cd_number: 2 },
          ],
        },
      }],
    }));
    const client = createClient({ fetcher });

    const result = await client.search({
      query: '  The Example  ',
      language: 'pt',
      contentType: 'episode',
      seasonNumber: 2,
      episodeNumber: 3,
      year: 2025,
      page: 1,
    });

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(
      'https://api.opensubtitles.com/api/v1/subtitles?episode_number=3&languages=pt-br%2Cpt-pt&query=the+example&season_number=2&type=episode&year=2025'
    );
    expect(init?.headers).toMatchObject({
      'Api-Key': 'consumer-key',
      'X-User-Agent': 'PlayPlus v1.11.0',
    });
    expect(init).toMatchObject({ method: 'GET', redirect: 'error' });
    expect(result.candidates).toEqual([
      expect.objectContaining({
        fileId: 11,
        fileName: 'one.srt',
        language: 'pt',
        featureTitle: 'Example',
        discNumber: 1,
        discCount: 2,
        autoTranslated: true,
        hearingImpaired: true,
        foreignPartsOnly: true,
        fromTrusted: true,
        rating: 4.5,
        votes: 12,
        downloadCount: 1234,
        uploaderRank: 'Trusted member',
        uploadDate: '2026-07-31T12:34:56Z',
      }),
      expect.objectContaining({ fileId: 12, fileName: 'two.srt', discNumber: 2, discCount: 2 }),
    ]);
    expect(result).toMatchObject({ page: 1, totalPages: 2, totalCount: 1 });
  });

  it('uses at most one retry for network and server failures', async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new TypeError('network'))
      .mockResolvedValueOnce(jsonResponse({ message: 'down' }, 503));
    const client = createClient({ fetcher });

    await expect(client.search({ query: 'Example', language: 'en' }))
      .rejects.toMatchObject({ code: 'SERVER' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([
    [401, 'AUTH_REQUIRED'],
    [403, 'ACCESS_DENIED'],
    [406, 'DOWNLOAD_REJECTED'],
    [429, 'RATE_LIMIT'],
  ] as const)('maps HTTP %s to the neutral %s code without trusting an error body', async (status, code) => {
    const fetcher = vi.fn(async () => jsonResponse({ message: 'untrusted detail' }, status));
    const client = createClient({ fetcher });

    await expect(client.search({ query: 'Example', language: 'en' })).rejects.toMatchObject({ code });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('reports a missing consumer key before making a request', async () => {
    const fetcher = vi.fn();
    const client = createClient({ apiKey: ' ', fetcher });

    await expect(client.search({ query: 'Example', language: 'en' }))
      .rejects.toMatchObject({ code: 'API_KEY_MISSING' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    { page: -1, total_pages: 1, total_count: 1 },
    { page: 1, total_pages: 1.5, total_count: 1 },
    { page: 1, total_pages: 1, total_count: -1 },
    { page: 2, total_pages: 1, total_count: 1 },
    { page: 1, total_pages: 0, total_count: 1 },
  ])('rejects malformed paging values: %o', async (paging) => {
    const fetcher = vi.fn(async () => jsonResponse({ ...paging, data: [] }));
    const client = createClient({ fetcher });

    await expect(client.search({ query: 'Example', language: 'en' }))
      .rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('accepts the provider empty-result paging shape', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ page: 1, total_pages: 0, total_count: 0, data: [] }));
    const client = createClient({ fetcher });

    await expect(client.search({ query: 'Example', language: 'en' })).resolves.toEqual({
      page: 1,
      totalPages: 0,
      totalCount: 0,
      candidates: [],
    });
  });

  it('omits malformed optional result-card metadata', async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      page: 1,
      total_pages: 1,
      total_count: 1,
      data: [{
        attributes: {
          language: 'en',
          nb_cd: 0,
          ai_translated: 'yes',
          hearing_impaired: 1,
          from_trusted: 'true',
          ratings: -1,
          votes: 1.5,
          download_count: -1,
          upload_date: 'not-a-date',
          uploader: { name: 'ignored', rank: '' },
          files: [{ file_id: 11, file_name: 'one.srt', cd_number: 0 }],
        },
      }],
    }));
    const client = createClient({ fetcher });

    const result = await client.search({ query: 'Example', language: 'en' });

    const candidate = result.candidates[0];
    expect(candidate).toMatchObject({ fileId: 11, fileName: 'one.srt' });
    expect(candidate.discNumber).toBeUndefined();
    expect(candidate.discCount).toBeUndefined();
    expect(candidate.autoTranslated).toBeUndefined();
    expect(candidate.hearingImpaired).toBeUndefined();
    expect(candidate.fromTrusted).toBeUndefined();
    expect(candidate.rating).toBeUndefined();
    expect(candidate.votes).toBeUndefined();
    expect(candidate.downloadCount).toBeUndefined();
    expect(candidate.uploaderRank).toBeUndefined();
    expect(candidate.uploadDate).toBeUndefined();
  });
});

describe('OpenSubtitles download', () => {
  it('returns a persistent session hit without consuming a provider request', async () => {
    const cache = createCache();
    cache.values.set(11, { fileId: 11, fileName: 'cached.srt', text: 'cached subtitle' });
    const fetcher = vi.fn();
    const client = createClient({ cache, fetcher });

    await expect(client.download(11, 'en')).resolves.toEqual({
      fileId: 11,
      fileName: 'cached.srt',
      text: 'cached subtitle',
      fromCache: true,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('requests SRT once, validates both URLs, decodes, caches, and returns quota fields', async () => {
    const cache = createCache();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        link: ALLOWED_DOWNLOAD_URL,
        file_name: 'example.ass',
        requests: 1,
        remaining: 4,
        reset_time_utc: '2026-08-01T23:59:59.999Z',
      }))
      .mockResolvedValueOnce(responseAt(new Response(
        '1\n00:00:00,000 --> 00:00:01,000\nHello',
        { status: 200 }
      )));
    const client = createClient({ cache, fetcher });

    await expect(client.download(11, 'en')).resolves.toMatchObject({
      fileId: 11,
      fileName: 'example.srt',
      fromCache: false,
      quota: { requests: 1, remaining: 4, resetTimeUtc: '2026-08-01T23:59:59.999Z' },
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]).toEqual([
      'https://api.opensubtitles.com/api/v1/download',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ file_id: 11, sub_format: 'srt' }),
        redirect: 'error',
      }),
    ]);
    expect(fetcher.mock.calls[1]).toEqual([
      ALLOWED_DOWNLOAD_URL,
      { method: 'GET', redirect: 'error' },
    ]);
    expect(cache.set).toHaveBeenCalledWith(expect.objectContaining({ fileId: 11, fileName: 'example.srt' }));
  });

  it('rejects an issued URL or final redirect outside the exact download path', async () => {
    const issuedUrlClient = createClient({
      fetcher: vi.fn(async () => jsonResponse({
        link: 'https://www.opensubtitles.com/not-download/example.srt',
        file_name: 'example.srt',
      })),
    });

    await expect(issuedUrlClient.download(11, 'en')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });

    const redirectedClient = createClient({
      fetcher: vi.fn()
        .mockResolvedValueOnce(jsonResponse({ link: ALLOWED_DOWNLOAD_URL, file_name: 'example.srt' }))
        .mockResolvedValueOnce(responseAt(new Response('subtitle'), 'https://cdn.example.com/download/example.srt')),
    });

    await expect(redirectedClient.download(11, 'en')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('rejects redirects instead of following an unverifiable response chain', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ link: ALLOWED_DOWNLOAD_URL, file_name: 'example.srt' }))
      .mockRejectedValueOnce(new TypeError('redirect mode is error'));
    const client = createClient({ fetcher });

    await expect(client.download(11, 'en')).rejects.toMatchObject({ code: 'NETWORK' });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenNthCalledWith(2, ALLOWED_DOWNLOAD_URL, { method: 'GET', redirect: 'error' });
  });

  it('rejects an oversized Content-Length before reading the response body', async () => {
    const fileResponse = responseAt(new Response('small', {
      headers: { 'Content-Length': String(MAX_SUBTITLE_FILE_SIZE_BYTES + 1) },
    }));
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ link: ALLOWED_DOWNLOAD_URL, file_name: 'example.srt' }))
      .mockResolvedValueOnce(fileResponse);
    const client = createClient({ fetcher });

    await expect(client.download(11, 'en')).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
  });

  it('aborts a streamed response as soon as actual bytes exceed 1 MiB', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_SUBTITLE_FILE_SIZE_BYTES));
        controller.enqueue(new Uint8Array([1]));
        controller.close();
      },
    });
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ link: ALLOWED_DOWNLOAD_URL, file_name: 'example.srt' }))
      .mockResolvedValueOnce(responseAt(new Response(stream)));
    const client = createClient({ fetcher });

    await expect(client.download(11, 'en')).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
  });

  it('coalesces same-file downloads and never retries a failed POST', async () => {
    let resolvePost: ((response: Response) => void) | undefined;
    const fetcher = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => {
        resolvePost = resolve;
      }))
      .mockResolvedValueOnce(responseAt(new Response('subtitle')));
    const client = createClient({ fetcher });

    const first = client.download(11, 'en');
    const second = client.download(11, 'en');
    await Promise.resolve();
    resolvePost?.(jsonResponse({ link: ALLOWED_DOWNLOAD_URL, file_name: 'example.srt' }));

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(fetcher).toHaveBeenCalledTimes(2);

    const failedFetcher = vi.fn(async () => jsonResponse({ message: 'down' }, 503));
    const failedClient = createClient({ fetcher: failedFetcher });
    await expect(failedClient.download(12, 'en')).rejects.toBeInstanceOf(OpenSubtitlesError);
    expect(failedFetcher).toHaveBeenCalledOnce();
  });
});
