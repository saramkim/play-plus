import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { convertV4MiniflareOptions, Miniflare } from 'miniflare';

const origin = 'chrome-extension://dmpmihmopccgeieooepklikeacdhkbki';
let mf;
let db;
let ip = 1;
const payload = (message = '로컬 테스트 의견') => ({ message, extensionVersion: '1.12.0', requestId: randomUUID() });
const post = (data, options = {}) => mf.dispatchFetch('https://feedback.test/feedback', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': `192.0.2.${ip++}`, ...options.headers },
  body: JSON.stringify(data), ...options,
});
before(async () => {
  mf = new Miniflare(convertV4MiniflareOptions({ workers: [{
    name: 'feedback-test',
    modules: true,
    scriptPath: fileURLToPath(new URL('../dist/entry.js', import.meta.url)),
    compatibilityDate: '2026-10-01',
    bindings: { ALLOWED_ORIGINS: origin, ACCEPT_FEEDBACK: 'true' },
    d1Databases: ['DB'],
    ratelimits: {
      FEEDBACK_RATE_LIMITER: { simple: { limit: 5, period: 60 }, namespace_id: '1281' },
      GLOBAL_RATE_LIMITER: { simple: { limit: 100, period: 60 }, namespace_id: '1282' },
    },
  }] }));
  db = await mf.getD1Database('DB');
  await db.exec((await readFile(new URL('../migrations/0001-feedback.sql', import.meta.url), 'utf8')).replaceAll('\n', ' '));
});
after(async () => { await mf?.dispose(); });

test('POST -> real local D1 readback, server timestamp and idempotent retry', async () => {
  const data = payload('  한글 의견  ');
  const before = Date.now();
  const response = await post(data);
  assert.equal(response.status, 200);
  const receipt = await response.json();
  assert.equal(receipt.status, 'stored');
  assert.equal(receipt.requestId, data.requestId);
  assert.ok(Date.parse(receipt.receivedAt) >= before);
  const row = await db.prepare('SELECT * FROM feedback WHERE request_id = ?').bind(data.requestId).first();
  assert.deepEqual(row, { request_id: data.requestId, message: '한글 의견', extension_version: '1.12.0', received_at: receipt.receivedAt });
  assert.deepEqual(await (await post(data)).json(), receipt);
  assert.equal((await post({ ...data, message: 'changed' })).status, 409);
  const count = await db.prepare('SELECT COUNT(*) AS count FROM feedback WHERE request_id = ?').bind(data.requestId).first();
  assert.equal(count.count, 1);
});

test('simultaneous retries store exactly one row', async () => {
  const data = payload();
  const responses = await Promise.all([post(data), post(data), post(data)]);
  assert.ok(responses.every((response) => response.status === 200));
  const receipts = await Promise.all(responses.map((response) => response.json()));
  assert.deepEqual(receipts[0], receipts[1]);
  assert.deepEqual(receipts[1], receipts[2]);
});

test('strict schema, length, content type, body limit and unknown media fields', async () => {
  for (const data of [null, [], {}, { ...payload(), url: 'private' }, { ...payload(), message: 42 }, payload('  '), payload('a'.repeat(1001)), { ...payload(), extensionVersion: 'bad' }, { ...payload(), requestId: 'bad' }]) {
    assert.equal((await post(data)).status, 400);
  }
  assert.equal((await post(payload('가'.repeat(1000)))).status, 200);
  assert.equal((await post(payload('a'.repeat(9000)))).status, 413);
  const response = await mf.dispatchFetch('https://feedback.test/feedback', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'text/plain' }, body: 'hello' });
  assert.equal(response.status, 415);
});

test('rejects streamed oversized bodies without trusting Content-Length', async () => {
  const response = await mf.dispatchFetch('https://feedback.test/feedback', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.150' },
    body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(' '.repeat(9000))); controller.close(); } }), duplex: 'half',
  });
  assert.equal(response.status, 413);
});

test('CORS allowlist, preflight, HTTPS and no public read endpoint', async () => {
  for (const denied of ['', 'null', 'https://arbitrary.test', 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa']) {
    const response = await mf.dispatchFetch('https://feedback.test/feedback', { method: 'POST', headers: { Origin: denied }, body: '{}' });
    assert.equal(response.status, 403); assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  }
  const response = await mf.dispatchFetch('https://feedback.test/feedback', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
  assert.equal(response.status, 204); assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null);
  assert.equal((await mf.dispatchFetch('https://feedback.test/feedback', { headers: { Origin: origin } })).status, 405);
  assert.equal((await mf.dispatchFetch('http://feedback.test/feedback', { headers: { Origin: origin } })).status, 400);
  assert.equal((await mf.dispatchFetch('https://feedback.test/feedback?secret=text', { headers: { Origin: origin } })).status, 404);
});

test('real local rate limiter rejects the sixth request before DB writes', async () => {
  const ids = [];
  for (let index = 0; index < 6; index++) {
    const data = payload(); ids.push(data.requestId);
    const response = await mf.dispatchFetch('https://feedback.test/feedback', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '198.51.100.50' }, body: JSON.stringify(data) });
    assert.equal(response.status, index === 5 ? 429 : 200);
    if (index === 5) assert.equal(response.headers.get('Retry-After'), '60');
  }
  assert.equal(await db.prepare('SELECT * FROM feedback WHERE request_id = ?').bind(ids[5]).first(), null);
});

test('scheduled cleanup removes expired rows and preserves recent feedback', async () => {
  const old = randomUUID(); const current = randomUUID();
  await db.prepare('INSERT INTO feedback VALUES (?, ?, ?, ?)').bind(old, 'expired', '1.12.0', new Date(Date.now() - 91 * 86400000).toISOString()).run();
  await db.prepare('INSERT INTO feedback VALUES (?, ?, ?, ?)').bind(current, 'recent', '1.12.0', new Date().toISOString()).run();
  const worker = await mf.getWorker();
  await worker.scheduled({ cron: '17 3 * * *' });
  assert.equal(await db.prepare('SELECT * FROM feedback WHERE request_id = ?').bind(old).first(), null);
  assert.ok(await db.prepare('SELECT * FROM feedback WHERE request_id = ?').bind(current).first());
});

test('storage failure returns a generic error without leaking feedback', async () => {
  await db.exec('DROP TABLE feedback');
  const response = await post(payload('private-text-do-not-log'));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'unavailable' });
});

test('checked-in configuration disables collection and needs no database to refuse it', async () => {
  const config = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  const disabled = new Miniflare(convertV4MiniflareOptions({
    modules: true, scriptPath: fileURLToPath(new URL('../dist/entry.js', import.meta.url)),
    compatibilityDate: config.compatibility_date, bindings: config.vars,
  }));
  try {
    const response = await disabled.dispatchFetch('https://feedback.test/feedback', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(payload()) });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'unavailable' });
  } finally { await disabled.dispose(); }
});
