'use strict';
const $ = (id) => document.getElementById(id);
let state = 'all';
let query = '';
let next = null;
let generation = 0;
let loading = false;
const dateFormat = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
async function api(path, options) {
  const response = await fetch(path, { ...options, credentials: 'same-origin', redirect: 'error' });
  if (!response.ok) throw new Error(response.status === 403 || response.status === 401 ? 'auth' : 'request');
  if (!(response.headers.get('content-type') || '').includes('application/json')) throw new Error('auth');
  return response.json();
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function render(item) {
  const card = element('article', 'feedback' + (item.read_at ? ' is-read' : ''));
  const meta = element('div', 'meta');
  const date = element('time', '', dateFormat.format(new Date(item.received_at)));
  date.dateTime = item.received_at;
  meta.append(date, element('span', 'badge', 'v' + item.extension_version));
  if (!item.read_at) meta.append(element('span', 'badge new', '안 읽음'));
  const toggle = element('button', 'read-toggle', item.read_at ? '안 읽음으로 표시' : '✓ 읽음으로 표시');
  toggle.type = 'button';
  toggle.addEventListener('click', async () => {
    toggle.disabled = true;
    try {
      await api('/api/feedback/' + encodeURIComponent(item.request_id) + '/read', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ read: !item.read_at })
      });
      await load();
    } catch {
      $('status').textContent = '변경을 저장하지 못했어요. 다시 시도해 주세요.';
      $('login').hidden = false;
      toggle.disabled = false;
    }
  });
  card.append(meta, element('p', 'message', item.message), toggle);
  return card;
}
async function load(append = false) {
  if (append && loading) return;
  const current = ++generation;
  loading = true;
  $('list').setAttribute('aria-busy', 'true');
  $('more').disabled = true;
  $('status').textContent = '피드백을 불러오는 중이에요.';
  $('login').hidden = true;
  if (!append) { $('list').replaceChildren(); $('count').textContent = ''; next = null; }
  const params = new URLSearchParams({ q: query, state });
  if (append && next) { params.set('before', next.before); params.set('id', next.id); }
  try {
    const data = await api('/api/feedback?' + params);
    if (current !== generation) return;
    for (const item of data.items) $('list').append(render(item));
    next = data.next;
    $('count').textContent = data.counts.total.toLocaleString('ko-KR');
    $('status').textContent = $('list').childElementCount ? '' : query ? '검색 결과가 없어요.' : state === 'unread' ? '모두 확인했어요. 새로운 이야기가 오면 여기에 표시됩니다.' : '아직 도착한 피드백이 없어요.';
    $('more').hidden = !next;
  } catch (error) {
    if (current !== generation) return;
    $('status').textContent = error.message === 'auth' ? '로그인이 만료되었어요. 다시 로그인해 주세요.' : '피드백을 불러오지 못했어요. 새로고침하거나 다시 로그인해 주세요.';
    $('login').hidden = false;
    $('more').hidden = true;
  } finally {
    if (current === generation) { loading = false; $('list').setAttribute('aria-busy', 'false'); $('more').disabled = false; }
  }
}
for (const id of ['all', 'unread']) $(id).addEventListener('click', () => {
  state = id;
  $('all').setAttribute('aria-pressed', String(state === 'all'));
  $('unread').setAttribute('aria-pressed', String(state === 'unread'));
  load();
});
$('search-form').addEventListener('submit', (event) => { event.preventDefault(); query = $('search').value.trim(); load(); });
$('refresh').addEventListener('click', () => load());
$('more').addEventListener('click', () => load(true));
load();
