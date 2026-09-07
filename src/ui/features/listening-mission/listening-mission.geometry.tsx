import { createRoot } from 'react-dom/client';

import type { ListeningMissionController } from '@/listening/session/mission-controller';
import type { ListeningMissionSnapshot } from '@/listening/session/mission-snapshot';
import '@/ui/style.css';

import { ListeningMission } from './listening-mission';

// This entry is bundled only by scripts/listening-geometry.mjs. Synthetic data,
// real component and stylesheet; it is not an extension/IME/playback test.
const parameters = new URLSearchParams(location.search);
const width = Number(parameters.get('width') ?? 320);
const locale = parameters.get('locale') === 'ko' ? 'ko' : 'en';
const sample = parameters.get('sample') ?? 'english';
const samples: Record<string, string> = {
  english: 'A long synthetic sentence with enough detail to wrap across many lines while all listening actions remain reachable. '.repeat(6),
  korean: '긴 한국어 예문을 표시해도 문장 확인과 다시 듣기 및 돌아가기 버튼에 접근할 수 있어야 합니다. '.repeat(6),
  unbroken: 'LongUnbrokenSyntheticLearningSubtitle'.repeat(12),
};
const segmentKey: `segment-v1-${string}` = `segment-v1-${'0'.repeat(64)}`;
const snapshot: ListeningMissionSnapshot = {
  learningLanguage: sample === 'korean' ? 'ko' : 'en', sourceKey: 'native:en', segmenterVersion: 1, videoId: 'geometry-fixture',
  segments: [{ segmentKey, sourceKey: 'native:en', sourceIndices: [0], startMs: 0, endMs: 1000,
    answerText: samples[sample] ?? samples.english,
    alignedSupport: { sourceIndices: [0], text: samples.korean },
  }],
};
const controller: ListeningMissionController = {
  playSegment: async () => ({ status: 'played' }),
  endSession: async () => ({ status: 'ended' }),
  saveDifficultSegments: async () => ({ saved: [segmentKey], retryableFailures: [] }),
};
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
const settle = async () => { await frame(); await document.fonts.ready; await frame(); };

async function run() {
  const messages: Record<string, { message: string }> = await (await fetch(`/_locales/${locale}/messages.json`)).json();
  const label = (key: string) => messages[key]?.message ?? key;
  Reflect.set(globalThis, 'chrome', { i18n: { getMessage: label } });
  document.documentElement.classList.toggle('dark', parameters.get('theme') === 'dark');
  document.documentElement.lang = locale;
  const host = document.getElementById('root')!;
  host.style.width = `${width}px`;
  host.style.height = '600px';
  const root = createRoot(host);
  root.render(<div className='flex h-full flex-col text-nowrap select-none'>
    <main className='min-h-0 flex-1 overflow-hidden outline-none'>
      <ListeningMission snapshot={snapshot} controller={controller} initialSegmentKey={segmentKey} onExit={() => undefined} />
    </main>
  </div>);
  await settle();
  const button = (key: string) => {
    const node = Array.from(host.querySelectorAll('button')).find((item) => item.textContent?.trim() === label(key));
    if (!node) throw new Error(`Missing fixture action: ${key}`);
    return node;
  };
  const click = async (key: string) => { button(key).click(); await settle(); };
  const observations: { state: string; overflow: number; overlap: number; clippedFocus: number; unreachable: number; scrollOwners: number }[] = [];
  const measure = async (state: string) => {
    const controls = Array.from(host.querySelectorAll<HTMLElement>('button:not(:disabled), textarea'));
    const bounds = host.getBoundingClientRect();
    const elements = Array.from(host.querySelectorAll<HTMLElement>('*')).filter((node) => !node.classList.contains('sr-only') && getComputedStyle(node).display !== 'inline');
    const overflow = elements.filter((node) => node.clientWidth > 0 && node.scrollWidth > node.clientWidth + 1).length;
    let overlap = 0; let clippedFocus = 0; let unreachable = 0;
    const rects = controls.map((node) => node.getBoundingClientRect());
    for (let index = 0; index < rects.length; index += 1) {
      for (const other of rects.slice(index + 1)) {
        const rect = rects[index];
        if (Math.min(rect.right, other.right) - Math.max(rect.left, other.left) > 1 && Math.min(rect.bottom, other.bottom) - Math.max(rect.top, other.top) > 1) overlap += 1;
      }
    }
    for (const node of controls) {
      node.focus(); node.scrollIntoView({ block: 'center', inline: 'nearest' }); await frame();
      const rect = node.getBoundingClientRect();
      const center = document.elementFromPoint((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2);
      if (!center || !node.contains(center)) unreachable += 1;
      // Production buttons have a 3px focus ring. Require clearance from each
      // clipping ancestor, not just the viewport; vertically scroll first.
      let parent = node.parentElement;
      while (parent && host.contains(parent)) {
        const style = getComputedStyle(parent); const clip = parent.getBoundingClientRect();
        if (/(auto|hidden|scroll)/.test(style.overflowX) && (rect.left - 3 < clip.left - 0.5 || rect.right + 3 > clip.right + 0.5)) clippedFocus += 1;
        if (/(auto|hidden|scroll)/.test(style.overflowY) && (rect.top - 3 < clip.top - 0.5 || rect.bottom + 3 > clip.bottom + 0.5)) clippedFocus += 1;
        parent = parent.parentElement;
      }
      if (rect.left < bounds.left || rect.right > bounds.right || rect.top < bounds.top || rect.bottom > bounds.bottom) unreachable += 1;
    }
    observations.push({ state, overflow, overlap, clippedFocus, unreachable, scrollOwners: host.querySelectorAll('[data-scroll-owner]').length });
  };
  await measure('hidden');
  await click('v2_listening_reveal');
  await click('v2_listening_type_optional');
  const input = host.querySelector('textarea')!;
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, samples.korean);
  input.dispatchEvent(new Event('input', { bubbles: true })); await settle();
  await click('v2_listening_compare');
  await measure('revealed-typing-comparison');
  await click('v2_listening_landing_continue');
  await measure('past-picker');
  const result = { width, locale, sample, theme: parameters.get('theme') ?? 'light', observations,
    pass: observations.every((item) => item.overflow === 0 && item.overlap === 0 && item.clippedFocus === 0 && item.unreachable === 0 && item.scrollOwners === 1),
  };
  Reflect.set(globalThis, 'geometryResult', result);
  return result;
}

Reflect.set(globalThis, 'geometryReady', run());
