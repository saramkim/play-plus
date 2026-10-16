import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

import { convertV4MiniflareOptions, Miniflare } from 'miniflare';

const instances = [];
let mf;
let db;
const owner = 'saramkimm@gmail.com';
const origin = 'https://feedback.test';
async function instance(access = { aud: 'inbox', identity: { email: owner } }, audience = 'inbox') {
  const options = convertV4MiniflareOptions({ workers: [{
    name: 'inbox-test', modules: true,
    scriptPath: fileURLToPath(new URL('../dist/admin/admin-entry.js', import.meta.url)),
    compatibilityDate: '2026-10-01',
    bindings: { ACCESS_AUD: audience }, d1Databases: ['DB'],
    ...(access ? { access } : {}),
  }] });
  const manifest = options.workers[0].config.manifest;
  for (const name of await readdir(new URL('../dist/admin/', import.meta.url))) {
    if (/^[a-f0-9]+-inbox\.(html|css|js)$/.test(name)) {
      manifest.modules[manifest.mainModule.replace(/[^/]+$/, name)] = {
        type: 'text', contents: await readFile(new URL('../dist/admin/' + name, import.meta.url), 'utf8'),
      };
    }
  }
  const result = new Miniflare(options);
  instances.push(result);
  return result;
}
const get = (path = '/api/feedback', runtime = mf) => runtime.dispatchFetch(origin + path);
const mark = (id, read, extra = {}) => mf.dispatchFetch(`${origin}/api/feedback/${id}/read`, {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ read }), ...extra,
});
async function insert(message, age = 0, timestamp) {
  const id = randomUUID();
  await db.prepare('INSERT INTO feedback (request_id, message, extension_version, received_at) VALUES (?, ?, ?, ?)')
    .bind(id, message, '1.13.2', timestamp || new Date(Date.now() - age * 86400_000).toISOString()).run();
  return id;
}
before(async () => {
  mf = await instance();
  db = await mf.getD1Database('DB');
  for (const name of ['0001-feedback.sql', '0002-feedback-read-state.sql']) {
    const sql = await readFile(new URL('../migrations/' + name, import.meta.url), 'utf8');
    await db.exec(sql.replace(/^--.*$/gm, '').replaceAll('\n', ' '));
  }
});
after(async () => { for (const item of instances) await item.dispose(); });

test('no Access, forged email headers, wrong audience/user, and missing config fail closed', async () => {
  for (const [access, audience] of [
    [null, 'inbox'], [{ aud: 'other', identity: { email: owner } }, 'inbox'],
    [{ aud: 'inbox', identity: { email: 'someone@example.com' } }, 'inbox'],
    [{ aud: 'inbox', identity: {} }, 'inbox'], [{ aud: 'inbox', identity: { email: owner } }, ''],
  ]) {
    const runtime = await instance(access, audience);
    for (const path of ['/', '/inbox.js', '/inbox.css', '/api/feedback']) {
      const response = await runtime.dispatchFetch(origin + path, { headers: {
        'Cf-Access-Authenticated-User-Email': owner, 'Cf-Access-Jwt-Assertion': 'forged',
      } });
      assert.equal(response.status, 403);
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
  }
});

test('authorized assets are private, restrictive CSP, user text is not interpolated into HTML', async () => {
  const response = await get('/');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.doesNotMatch(response.headers.get('content-security-policy'), /unsafe-inline|unsafe-eval/);
  assert.match(await response.text(), /피드백함/);
  const js = await (await get('/inbox.js')).text();
  assert.doesNotThrow(() => new Script(js));
  assert.doesNotMatch(js, /innerHTML|outerHTML|insertAdjacentHTML/);
});

test('real D1 list, literal search, unread update, CSRF checks, and retention', async () => {
  const payload = '<img src=x onerror=alert(1)> 의견_%';
  const id = await insert(payload);
  const expired = await insert('expired', 91);
  let response = await get('/api/feedback?q=' + encodeURIComponent('의견_%'));
  let data = await response.json();
  assert.equal(data.items.length, 1);
  assert.equal(data.items[0].message, payload);
  assert.equal(data.items[0].read_at, null);
  assert.equal(data.counts.unread, 1);
  for (const badOrigin of ['https://evil.example', 'null', '']) {
    assert.equal((await mark(id, true, { headers: { Origin: badOrigin, 'Content-Type': 'application/json' } })).status, 403);
  }
  assert.equal((await mark(id, true, { headers: { Origin: origin, 'Content-Type': 'text/plain' } })).status, 403);
  assert.equal((await mark(id, true, { body: '{"read":"true"}' })).status, 400);
  assert.equal((await mark(id, true, { body: 'x'.repeat(100) })).status, 400);
  response = await mark(id, true);
  assert.equal(response.status, 200);
  assert.ok((await response.json()).read_at);
  data = await (await get('/api/feedback?state=unread')).json();
  assert.equal(data.items.some((item) => item.request_id === id), false);
  assert.equal((await mark(id, false)).status, 200);
  data = await (await get()).json();
  assert.ok(data.items.some((item) => item.request_id === id));
  assert.equal(data.items.some((item) => item.request_id === expired), false);
  assert.equal((await mark(expired, true)).status, 404);
  // Existing collection INSERT/receipt SQL still works after the additive migration.
  assert.equal((await db.prepare('SELECT message, extension_version, received_at FROM feedback WHERE request_id = ?').bind(id).first()).message, payload);
  await db.prepare('DELETE FROM feedback WHERE request_id = ?').bind(id).run();
  assert.equal((await mark(id, true)).status, 404);
});

test('stable cursor handles tied timestamps without lost or duplicate feedback; validates filters', async () => {
  const time = new Date().toISOString();
  for (let i = 0; i < 28; i++) await insert('pagination fixture ' + i, 0, time);
  const first = await (await get('/api/feedback?q=pagination')).json();
  assert.equal(first.items.length, 25);
  assert.equal(first.counts.total, 28);
  const second = await (await get('/api/feedback?q=pagination&' + new URLSearchParams(first.next))).json();
  assert.equal(second.items.length, 3);
  assert.equal(second.next, null);
  assert.equal(new Set([...first.items, ...second.items].map((item) => item.request_id)).size, 28);
  for (const filter of ['state=read', 'q=' + 'a'.repeat(201), 'before=nope', 'before=nope&id=' + randomUUID()]) {
    assert.equal((await get('/api/feedback?' + filter)).status, 400);
  }
});
