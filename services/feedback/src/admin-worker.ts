import css from './admin/inbox.css';
import html from './admin/inbox.html';
import script from './admin/inbox.js';

interface AdminEnv { DB: D1Database; ACCESS_AUD: string }
interface FeedbackRow {
  request_id: string;
  message: string;
  extension_version: string;
  received_at: string;
  read_at: string | null;
}

const OWNER = 'saramkimm@gmail.com';
const UUID = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
};
const json = (status: number, body: unknown) => Response.json(body, { status, headers });
const asset = (body: string, type: string) => new Response(body, { headers: { ...headers, 'Content-Type': type } });

async function readSmallBody(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 64) { await reader.cancel(); throw new Error('body_too_large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
}

async function handleRequest(request: Request, env: AdminEnv, ctx: ExecutionContext): Promise<Response> {
  // Trust runtime-verified Access identity, never client-supplied email/JWT headers.
  // No static-assets binding: its router does not propagate ctx.access.
  if (!env.ACCESS_AUD || !ctx.access || ctx.access.aud !== env.ACCESS_AUD) return json(403, { error: 'access_required' });
  const identity = await ctx.access.getIdentity();
  if (identity?.email?.toLowerCase() !== OWNER) return json(403, { error: 'owner_only' });
  const url = new URL(request.url);
  if (url.protocol !== 'https:') return json(400, { error: 'https_required' });
  if (request.method === 'GET') {
    if (url.pathname === '/') return asset(html, 'text/html; charset=utf-8');
    if (url.pathname === '/inbox.css') return asset(css, 'text/css; charset=utf-8');
    if (url.pathname === '/inbox.js') return asset(script, 'text/javascript; charset=utf-8');
    if (url.pathname !== '/api/feedback') return json(404, { error: 'not_found' });
    const query = (url.searchParams.get('q') || '').trim();
    const state = url.searchParams.get('state') || 'all';
    const before = url.searchParams.get('before');
    const beforeId = url.searchParams.get('id');
    if (query.length > 200 || !['all', 'unread'].includes(state) || Boolean(before) !== Boolean(beforeId)
      || (before && (!ISO_DATE.test(before) || !Number.isFinite(Date.parse(before)))) || (beforeId && !UUID.test(beforeId))) {
      return json(400, { error: 'invalid_filter' });
    }
    const cutoff = new Date(Date.now() - 90 * 86400_000).toISOString();
    const filter = 'received_at >= ? AND instr(lower(message), lower(?)) > 0 AND (? = 0 OR read_at IS NULL)';
    const values = [cutoff, query, state === 'unread' ? 1 : 0];
    const cursor = before ? ' AND (received_at, request_id) < (?, ?)' : '';
    const results = await env.DB.batch([
      env.DB.prepare(`SELECT request_id, message, extension_version, received_at, read_at FROM feedback WHERE ${filter}${cursor} ORDER BY received_at DESC, request_id DESC LIMIT 26`)
        .bind(...values, ...(before ? [before, beforeId] : [])),
      env.DB.prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(read_at IS NULL), 0) AS unread FROM feedback WHERE ${filter}`).bind(...values),
    ]);
    const rows = results[0].results as unknown as FeedbackRow[];
    const items = rows.slice(0, 25);
    const last = items.at(-1);
    return json(200, { items, counts: results[1].results[0], next: rows.length > 25 && last ? { before: last.received_at, id: last.request_id } : null });
  }
  const match = /^\/api\/feedback\/([\da-f-]+)\/read$/.exec(url.pathname);
  if (request.method !== 'POST' || !match || !UUID.test(match[1]) || url.search) return json(404, { error: 'not_found' });
  // Cookie authentication requires same-origin writes. No CORS/preflight support.
  if (request.headers.get('Origin') !== url.origin || request.headers.get('Content-Type') !== 'application/json'
    || request.headers.get('Sec-Fetch-Site') === 'cross-site') return json(403, { error: 'origin_denied' });
  let body: unknown;
  try { body = JSON.parse(await readSmallBody(request)); } catch { return json(400, { error: 'invalid_body' }); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).join(',') !== 'read'
    || typeof (body as { read?: unknown }).read !== 'boolean') return json(400, { error: 'invalid_body' });
  const readAt = (body as { read: boolean }).read ? new Date().toISOString() : null;
  const result = await env.DB.prepare('UPDATE feedback SET read_at = ? WHERE request_id = ? AND received_at >= ? RETURNING request_id, read_at')
    .bind(readAt, match[1], new Date(Date.now() - 90 * 86400_000).toISOString()).first();
  return result ? json(200, result) : json(404, { error: 'not_found' });
}

export const adminWorker: ExportedHandler<AdminEnv> = {
  async fetch(request, env, ctx) {
    try { return await handleRequest(request, env, ctx); }
    catch { return json(503, { error: 'temporarily_unavailable' }); }
  },
};
