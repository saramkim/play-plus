import { MAX_SUBTITLE_FILE_SIZE_BYTES } from '@utils/subtitle-decode';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createOpenSubtitlesClient,
  getOpenSubtitlesErrorDetails,
  OpenSubtitlesError,
  SubtitleCache,
} from './opensubtitles-client';

const ALLOWED_DOWNLOAD_URL =
  'https://www.opensubtitles.com/download/token/subfile/example.srt';

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

const createCache = (): SubtitleCache & {
  values: Map<number, { fileId: number; fileName: string; text: string }>;
} => {
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

const createClient = (
  overrides: Partial<Parameters<typeof createOpenSubtitlesClient>[0]> = {}
) => {
  return createOpenSubtitlesClient({
    apiKey: 'consumer-key',
    userAgent: 'PlayPlus v2.0.0',
    cache: createCache(),
    retryDelay: async () => undefined,
    ...overrides,
  });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OpenSubtitles search', () => {
  it('uses the direct trailing-slash route, omits credentials, and returns file-level results', async () => {
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        page: 1,
        total_pages: 2,
        total_count: 1,
        data: [
          {
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
          },
        ],
      })
    );
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
      'https://api.opensubtitles.com/api/v1/subtitles/?episode_number=3&languages=pt-br%2Cpt-pt&query=the+example&season_number=2&type=episode&year=2025'
    );
    expect(init?.headers).toMatchObject({
      'Api-Key': 'consumer-key',
      'X-User-Agent': 'PlayPlus v2.0.0',
    });
    expect(init).toMatchObject({
      method: 'GET',
      credentials: 'omit',
      redirect: 'error',
      signal: expect.any(AbortSignal),
    });
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
      expect.objectContaining({
        fileId: 12,
        fileName: 'two.srt',
        discNumber: 2,
        discCount: 2,
      }),
    ]);
    expect(result).toMatchObject({ page: 1, totalPages: 2, totalCount: 1 });
    expect(result.candidates[0]).not.toHaveProperty('uploader');
  });

  it('uses at most one retry for network and server failures', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network'))
      .mockResolvedValueOnce(jsonResponse({ message: 'down' }, 503));
    const client = createClient({ fetcher });

    await expect(client.search({ query: 'Example', language: 'en' })).rejects.toMatchObject({
      code: 'SERVER',
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([
    [401, 'AUTH_REQUIRED'],
    [403, 'ACCESS_DENIED'],
    [406, 'DOWNLOAD_REJECTED'],
    [429, 'RATE_LIMIT'],
  ] as const)(
    'maps HTTP %s to the neutral %s code without trusting an error body',
    async (status, code) => {
      const fetcher = vi.fn(async () =>
        jsonResponse({ message: 'private provider detail' }, status)
      );
      const client = createClient({ fetcher });

      await expect(client.search({ query: 'Example', language: 'en' })).rejects.toMatchObject({
        code,
      });
      expect(fetcher).toHaveBeenCalledOnce();
    }
  );

  it('rejects missing configuration and invalid fields before making a request', async () => {
    const fetcher = vi.fn();
    const missingKeyClient = createClient({ apiKey: ' ', fetcher });

    await expect(
      missingKeyClient.search({ query: 'Example', language: 'en' })
    ).rejects.toMatchObject({ code: 'API_KEY_MISSING' });

    const client = createClient({ fetcher });
    await expect(
      client.search({ query: 'Example', language: 'unsupported' as unknown as 'en' })
    ).rejects.toMatchObject({ code: 'INVALID_QUERY' });
    await expect(
      client.search({ query: 'Example', language: 'en', year: 10_000 })
    ).rejects.toMatchObject({ code: 'INVALID_QUERY' });
    await expect(
      client.search({ query: 'Example', language: 'en', seasonNumber: 10_000 })
    ).rejects.toMatchObject({ code: 'INVALID_QUERY' });
    await expect(
      client.search({ query: 'Example', language: 'en', episodeNumber: 10_000 })
    ).rejects.toMatchObject({ code: 'INVALID_QUERY' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([undefined, 'unsupported', 'ko']) (
    'rejects missing, unsupported, or mismatched provider language %s',
    async (language) => {
      const fetcher = vi.fn(async () =>
        jsonResponse({
          page: 1,
          total_pages: 1,
          total_count: 1,
          data: [
            {
              attributes: {
                language,
                files: [{ file_id: 11, file_name: 'one.srt' }],
              },
            },
          ],
        })
      );
      const client = createClient({ fetcher });

      await expect(client.search({ query: 'Example', language: 'en' })).rejects.toMatchObject({
        code: 'INVALID_RESPONSE',
      });
    }
  );

  it('rejects redirected or off-origin API responses', async () => {
    const offOrigin = responseAt(
      jsonResponse({ page: 1, total_pages: 0, total_count: 0, data: [] }),
      'https://example.com/api/v1/subtitles/'
    );
    const offOriginClient = createClient({ fetcher: vi.fn(async () => offOrigin) });

    await expect(
      offOriginClient.search({ query: 'Example', language: 'en' })
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });

    const redirected = jsonResponse({ page: 1, total_pages: 0, total_count: 0, data: [] });
    Object.defineProperty(redirected, 'redirected', { configurable: true, value: true });
    const redirectedClient = createClient({ fetcher: vi.fn(async () => redirected) });
    await expect(
      redirectedClient.search({ query: 'Example', language: 'en' })
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it.each([
    { page: -1, total_pages: 1, total_count: 1 },
    { page: 1, total_pages: 1.5, total_count: 1 },
    { page: 1, total_pages: 1, total_count: -1 },
    { page: 2, total_pages: 1, total_count: 1 },
    { page: 2, total_pages: 2, total_count: 2 },
    { page: 1, total_pages: 0, total_count: 1 },
  ])('rejects malformed paging values: %o', async (paging) => {
    const fetcher = vi.fn(async () => jsonResponse({ ...paging, data: [] }));
    const client = createClient({ fetcher });

    await expect(client.search({ query: 'Example', language: 'en' })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('accepts empty results and omits malformed optional metadata', async () => {
    const emptyClient = createClient({
      fetcher: vi.fn(async () =>
        jsonResponse({ page: 1, total_pages: 0, total_count: 0, data: [] })
      ),
    });
    await expect(emptyClient.search({ query: 'Example', language: 'en' })).resolves.toEqual({
      page: 1,
      totalPages: 0,
      totalCount: 0,
      candidates: [],
    });

    const client = createClient({
      fetcher: vi.fn(async () =>
        jsonResponse({
          page: 1,
          total_pages: 1,
          total_count: 1,
          data: [
            {
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
                feature_details: {
                  year: 10_000,
                  season_number: 1.5,
                  episode_number: -1,
                },
                files: [{ file_id: 11, file_name: 'one.srt', cd_number: 0 }],
              },
            },
          ],
        })
      ),
    });

    const candidate = (await client.search({ query: 'Example', language: 'en' })).candidates[0];
    expect(candidate).toMatchObject({ fileId: 11, fileName: 'one.srt' });
    expect(candidate.discNumber).toBeUndefined();
    expect(candidate.autoTranslated).toBeUndefined();
    expect(candidate.rating).toBeUndefined();
    expect(candidate.uploaderRank).toBeUndefined();
    expect(candidate.featureYear).toBeUndefined();
    expect(candidate.seasonNumber).toBeUndefined();
    expect(candidate.episodeNumber).toBeUndefined();
  });

  it('accepts an exact requested page and rejects a different otherwise valid page', async () => {
    const matchingClient = createClient({
      fetcher: vi.fn(async () =>
        jsonResponse({ page: 2, total_pages: 2, total_count: 1, data: [] })
      ),
    });
    await expect(
      matchingClient.search({ query: 'Example', language: 'en', page: 2 })
    ).resolves.toMatchObject({ page: 2 });

    const mismatchedClient = createClient({
      fetcher: vi.fn(async () =>
        jsonResponse({ page: 1, total_pages: 2, total_count: 1, data: [] })
      ),
    });
    await expect(
      mismatchedClient.search({ query: 'Example', language: 'en', page: 2 })
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('bounds each search attempt, aborts it, and preserves the single retry', async () => {
    vi.useFakeTimers();
    try {
      const signals: AbortSignal[] = [];
      const fetcher = vi.fn(
        async (_url: string, init?: RequestInit) =>
          new Promise<Response>((_, reject) => {
            const signal = init?.signal;
            if (!signal) return;
            signals.push(signal);
            signal.addEventListener(
              'abort',
              () => reject(new DOMException('The operation was aborted', 'AbortError')),
              { once: true }
            );
          })
      );
      const client = createClient({ fetcher, requestTimeoutMs: 10 });
      const assertion = expect(
        client.search({ query: 'Example', language: 'en' })
      ).rejects.toMatchObject({ code: 'NETWORK' });

      await vi.runAllTimersAsync();
      await assertion;

      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(signals).toHaveLength(2);
      expect(signals.every((signal) => signal.aborted)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('OpenSubtitles download', () => {
  it('returns a session hit without consuming a provider request', async () => {
    const cache = createCache();
    cache.values.set(11, {
      fileId: 11,
      fileName: 'cached.srt',
      text: 'cached subtitle',
    });
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

  it('uses the direct download routes, omits credentials, decodes, caches, and returns quota', async () => {
    const cache = createCache();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          link: ALLOWED_DOWNLOAD_URL,
          file_name: 'example.ass',
          requests: 1,
          remaining: 4,
          reset_time_utc: '2026-08-01T23:59:59.999Z',
        })
      )
      .mockResolvedValueOnce(
        responseAt(
          new Response('1\n00:00:00,000 --> 00:00:01,000\nHello', { status: 200 })
        )
      );
    const client = createClient({ cache, fetcher });

    await expect(client.download(11, 'en')).resolves.toMatchObject({
      fileId: 11,
      fileName: 'example.srt',
      fromCache: false,
      quota: {
        requests: 1,
        remaining: 4,
        resetTimeUtc: '2026-08-01T23:59:59.999Z',
      },
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]).toEqual([
      'https://api.opensubtitles.com/api/v1/download/',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ file_id: 11, sub_format: 'srt' }),
        credentials: 'omit',
        redirect: 'error',
        signal: expect.any(AbortSignal),
      }),
    ]);
    expect(fetcher.mock.calls[1]).toEqual([
      ALLOWED_DOWNLOAD_URL,
      expect.objectContaining({
        method: 'GET',
        credentials: 'omit',
        redirect: 'error',
        signal: expect.any(AbortSignal),
      }),
    ]);
    expect(cache.set).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: 11, fileName: 'example.srt' })
    );
  });

  it('rejects issued, API-response, and final URLs outside the exact routes', async () => {
    const issuedUrlClient = createClient({
      fetcher: vi.fn(async () =>
        jsonResponse({
          link: 'https://www.opensubtitles.com/not-download/example.srt',
          file_name: 'example.srt',
        })
      ),
    });
    await expect(issuedUrlClient.download(11, 'en')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });

    const apiRedirectClient = createClient({
      fetcher: vi.fn(async () =>
        responseAt(
          jsonResponse({ link: ALLOWED_DOWNLOAD_URL, file_name: 'example.srt' }),
          'https://api.opensubtitles.com/api/v1/download'
        )
      ),
    });
    await expect(apiRedirectClient.download(11, 'en')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });

    const redirectedClient = createClient({
      fetcher: vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({ link: ALLOWED_DOWNLOAD_URL, file_name: 'example.srt' })
        )
        .mockResolvedValueOnce(
          responseAt(new Response('subtitle'), 'https://cdn.example.com/download/example.srt')
        ),
    });
    await expect(redirectedClient.download(11, 'en')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('does not follow an unverifiable download redirect', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ link: ALLOWED_DOWNLOAD_URL, file_name: 'example.srt' })
      )
      .mockRejectedValueOnce(new TypeError('redirect mode is error'));
    const client = createClient({ fetcher });

    await expect(client.download(11, 'en')).rejects.toMatchObject({ code: 'NETWORK' });
    expect(fetcher).toHaveBeenNthCalledWith(2, ALLOWED_DOWNLOAD_URL, {
      method: 'GET',
      credentials: 'omit',
      redirect: 'error',
      signal: expect.any(AbortSignal),
    });
  });

  it('ignores unsafe optional quota metadata', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          link: ALLOWED_DOWNLOAD_URL,
          file_name: 'example.srt',
          requests: -1,
          remaining: 1.5,
          reset_time_utc: 'tomorrow',
        })
      )
      .mockResolvedValueOnce(responseAt(new Response('subtitle')));
    const client = createClient({ fetcher });

    const result = await client.download(11, 'en');

    expect(result).not.toHaveProperty('quota');
  });

  it('rejects declared or streamed data beyond the raw 1 MiB limit', async () => {
    const fileResponse = responseAt(
      new Response('small', {
        headers: { 'Content-Length': String(MAX_SUBTITLE_FILE_SIZE_BYTES + 1) },
      })
    );
    const declaredClient = createClient({
      fetcher: vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({ link: ALLOWED_DOWNLOAD_URL, file_name: 'example.srt' })
        )
        .mockResolvedValueOnce(fileResponse),
    });
    await expect(declaredClient.download(11, 'en')).rejects.toMatchObject({
      code: 'FILE_TOO_LARGE',
    });

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_SUBTITLE_FILE_SIZE_BYTES));
        controller.enqueue(new Uint8Array([1]));
        controller.close();
      },
    });
    const streamedClient = createClient({
      fetcher: vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({ link: ALLOWED_DOWNLOAD_URL, file_name: 'example.srt' })
        )
        .mockResolvedValueOnce(responseAt(new Response(stream))),
    });
    await expect(streamedClient.download(12, 'en')).rejects.toMatchObject({
      code: 'FILE_TOO_LARGE',
    });
  });

  it('coalesces same-file downloads and never retries a failed POST', async () => {
    let resolvePost: ((response: Response) => void) | undefined;
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolvePost = resolve;
          })
      )
      .mockResolvedValueOnce(responseAt(new Response('subtitle')));
    const client = createClient({ fetcher });

    const first = client.download(11, 'en');
    const second = client.download(11, 'en');
    await vi.waitFor(() => expect(resolvePost).toBeTypeOf('function'));
    resolvePost?.(jsonResponse({ link: ALLOWED_DOWNLOAD_URL, file_name: 'example.srt' }));

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(fetcher).toHaveBeenCalledTimes(2);

    const failedFetcher = vi.fn(async () => jsonResponse({ message: 'down' }, 503));
    const failedClient = createClient({ fetcher: failedFetcher });
    await expect(failedClient.download(12, 'en')).rejects.toBeInstanceOf(OpenSubtitlesError);
    expect(failedFetcher).toHaveBeenCalledOnce();
  });

  it('bounds and aborts a download POST without retrying it', async () => {
    vi.useFakeTimers();
    try {
      const signals: AbortSignal[] = [];
      const fetcher = vi.fn(
        async (_url: string, init?: RequestInit) =>
          new Promise<Response>((_, reject) => {
            const signal = init?.signal;
            if (!signal) return;
            signals.push(signal);
            signal.addEventListener(
              'abort',
              () => reject(new DOMException('The operation was aborted', 'AbortError')),
              { once: true }
            );
          })
      );
      const client = createClient({ fetcher, requestTimeoutMs: 10 });
      const assertion = expect(client.download(11, 'en')).rejects.toMatchObject({
        code: 'NETWORK',
      });

      await vi.runAllTimersAsync();
      await assertion;

      expect(fetcher).toHaveBeenCalledOnce();
      expect(signals).toHaveLength(1);
      expect(signals[0].aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('bounds and aborts the subtitle file GET without retrying it', async () => {
    vi.useFakeTimers();
    try {
      const signals: AbortSignal[] = [];
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({ link: ALLOWED_DOWNLOAD_URL, file_name: 'example.srt' })
        )
        .mockImplementationOnce(
          async (_url: string, init?: RequestInit) =>
            new Promise<Response>((_, reject) => {
              const signal = init?.signal;
              if (!signal) return;
              signals.push(signal);
              signal.addEventListener(
                'abort',
                () => reject(new DOMException('The operation was aborted', 'AbortError')),
                { once: true }
              );
            })
        );
      const client = createClient({ fetcher, requestTimeoutMs: 10 });
      const assertion = expect(client.download(11, 'en')).rejects.toMatchObject({
        code: 'NETWORK',
      });

      await vi.runAllTimersAsync();
      await assertion;

      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(signals).toHaveLength(1);
      expect(signals[0].aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('bounds the subtitle stream, aborts it, and never retries the file GET', async () => {
    vi.useFakeTimers();
    try {
      let streamCancelled = false;
      const stream = new ReadableStream<Uint8Array>({
        cancel() {
          streamCancelled = true;
        },
      });
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({ link: ALLOWED_DOWNLOAD_URL, file_name: 'example.srt' })
        )
        .mockResolvedValueOnce(responseAt(new Response(stream)));
      const client = createClient({ fetcher, requestTimeoutMs: 10 });
      const assertion = expect(client.download(11, 'en')).rejects.toMatchObject({
        code: 'NETWORK',
      });

      await vi.runAllTimersAsync();
      await assertion;

      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(streamCancelled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('normalizes unknown failures without exposing their details', () => {
    expect(getOpenSubtitlesErrorDetails(new Error('private URL and response'))).toEqual({
      code: 'SERVER',
      message: 'The OpenSubtitles request failed.',
    });
  });
});
