export interface Env {
  DB: D1Database;
  FEEDBACK_RATE_LIMITER: RateLimit;
  GLOBAL_RATE_LIMITER: RateLimit;
  ALLOWED_ORIGINS: string;
  ACCEPT_FEEDBACK: string;
}

interface Submission { message: string; extensionVersion: string; requestId: string }
interface StoredFeedback { message: string; extension_version: string; received_at: string }

const BODY_LIMIT = 8192;
const UUID = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/;
const VERSION = /^\d{1,5}(\.\d{1,5}){0,3}$/;
const EXTENSION_ORIGIN = /^chrome-extension:\/\/[a-p]{32}$/;

function parseSubmission(input: unknown): Submission | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  if (Object.keys(value).sort().join(',') !== 'extensionVersion,message,requestId') return null;
  if (typeof value.message !== 'string' || typeof value.extensionVersion !== 'string' || typeof value.requestId !== 'string') return null;
  const message = value.message.trim();
  if (!message.length || message.length > 1000 || !VERSION.test(value.extensionVersion) || !UUID.test(value.requestId)) return null;
  return { message, extensionVersion: value.extensionVersion, requestId: value.requestId };
}

async function readBody(request: Request) {
  if (Number(request.headers.get('Content-Length')) > BODY_LIMIT) throw new Error('body_too_large');
  const reader = request.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  let size = 0;
  let text = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return text + decoder.decode();
      size += value.byteLength;
      if (size > BODY_LIMIT) { await reader.cancel(); throw new Error('body_too_large'); }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const headers = new Headers({ 'Cache-Control': 'no-store', Vary: 'Origin', 'X-Content-Type-Options': 'nosniff' });
  const reply = (status: number, body: unknown) => Response.json(body, { status, headers });
  const url = new URL(request.url);
  if (url.protocol !== 'https:') return reply(400, { error: 'https_required' });
  if (url.pathname !== '/feedback' || url.search) return reply(404, { error: 'not_found' });
  const origin = request.headers.get('Origin') || '';
  const origins = (env.ALLOWED_ORIGINS || '').split(',').map((item) => item.trim());
  if (!EXTENSION_ORIGIN.test(origin) || !origins.includes(origin)) return reply(403, { error: 'origin_denied' });
  headers.set('Access-Control-Allow-Origin', origin);
  if (request.method === 'OPTIONS') {
    const requestedHeaders = (request.headers.get('Access-Control-Request-Headers') || '').toLowerCase().split(',').map((header) => header.trim()).filter(Boolean);
    if (request.headers.get('Access-Control-Request-Method') !== 'POST' || requestedHeaders.some((header) => header !== 'content-type')) return reply(403, { error: 'preflight_denied' });
    headers.set('Access-Control-Allow-Methods', 'POST');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== 'POST') { headers.set('Allow', 'POST, OPTIONS'); return reply(405, { error: 'method_not_allowed' }); }
  if (env.ACCEPT_FEEDBACK !== 'true') return reply(503, { error: 'unavailable' });
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return reply(415, { error: 'json_required' });
  if (request.headers.has('Content-Encoding')) return reply(415, { error: 'encoding_not_supported' });
  try {
    // Keys are transient Cloudflare rate-limiter state, never written to D1 or logs.
    const ip = request.headers.get('CF-Connecting-IP');
    if (!ip) return reply(503, { error: 'unavailable' });
    const globalLimit = await env.GLOBAL_RATE_LIMITER.limit({ key: 'feedback' });
    const perIp = await env.FEEDBACK_RATE_LIMITER.limit({ key: ip });
    if (!globalLimit.success || !perIp.success) { headers.set('Retry-After', '60'); return reply(429, { error: 'rate_limited' }); }
    let data: Submission | null;
    try {
      data = parseSubmission(JSON.parse(await readBody(request)));
    } catch (error) {
      return reply(error instanceof Error && error.message === 'body_too_large' ? 413 : 400, { error: error instanceof Error && error.message === 'body_too_large' ? 'body_too_large' : 'invalid_request' });
    }
    if (!data) return reply(400, { error: 'invalid_request' });
    const receivedAt = new Date().toISOString();
    // Batch executes atomically on the primary, including receipt readback.
    const results = await env.DB.batch([
      env.DB.prepare('INSERT INTO feedback (request_id, message, extension_version, received_at) VALUES (?, ?, ?, ?) ON CONFLICT(request_id) DO NOTHING')
        .bind(data.requestId, data.message, data.extensionVersion, receivedAt),
      env.DB.prepare('SELECT message, extension_version, received_at FROM feedback WHERE request_id = ?').bind(data.requestId),
    ]);
    if (results.some((result) => !result.success)) return reply(503, { error: 'storage_unavailable' });
    const stored = results[1].results[0] as StoredFeedback | undefined;
    if (!stored) return reply(503, { error: 'storage_unavailable' });
    if (stored.message !== data.message || stored.extension_version !== data.extensionVersion) return reply(409, { error: 'request_id_conflict' });
    return reply(200, { status: 'stored', requestId: data.requestId, receivedAt: stored.received_at });
  } catch {
    // Never serialize the exception: D1 errors may include bound user text.
    return reply(503, { error: 'unavailable' });
  }
}

export const worker = {
  fetch: handleRequest,
  async scheduled(_event: ScheduledController, env: Env) {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const result = await env.DB.prepare('DELETE FROM feedback WHERE received_at < ?').bind(cutoff).run();
    if (!result.success) throw new Error('Feedback retention cleanup failed');
  },
} satisfies ExportedHandler<Env>;
