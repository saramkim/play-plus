import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { act } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ListeningSegmentKey,
  ListeningSourceKey,
} from '@/listening/domain/source-identity';
import type {
  CommitProgressResult,
  DifficultSaveResult,
  EndSessionResult,
  ListeningMissionController,
  PlaySegmentResult,
} from '@/listening/session/mission-controller';
import type { ListeningMissionSnapshot } from '@/listening/session/mission-reducer';

import { ListeningMission } from './listening-mission';

const PRACTICED_AT = '2026-08-09T12:00:00+12:00';
const SOURCE_KEY = 'native:en' as ListeningSourceKey;

describe('ListeningMission isolated UI', () => {
  let container: HTMLDivElement;
  let root: Root | undefined;

  beforeAll(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      queueMicrotask(() => callback(0));
      return 1;
    });
  });

  beforeEach(() => {
    vi.mocked(chrome.i18n.getMessage).mockImplementation((messageName, substitutions) => {
      const values = Array.isArray(substitutions)
        ? substitutions
        : substitutions === undefined
          ? []
          : [substitutions];
      return values.length === 0 ? messageName : `${messageName}:${values.join('/')}`;
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = undefined;
    container.remove();
    document.documentElement.classList.remove('dark');
  });

  afterAll(() => vi.unstubAllGlobals());

  it.each([320, 360, 390])(
    'keeps one scroll owner and usable narrow controls at %ipx',
    async (width) => {
      container.style.width = `${width}px`;
      const harness = createHarness();
      await renderMission(root, harness, snapshot(1));

      const scrollOwners = container.querySelectorAll<HTMLElement>(
        "[data-scroll-owner='listening-mission']"
      );
      expect(scrollOwners).toHaveLength(1);
      expect(scrollOwners[0].className).toContain('overflow-x-hidden');
      expect(scrollOwners[0].className).toContain('overflow-y-auto');
      expect(scrollOwners[0].parentElement?.className).toContain('overflow-hidden');
      expect(container.querySelectorAll('[data-scroll-owner] [data-scroll-owner]')).toHaveLength(0);

      const textarea = getTextarea(container);
      const label = container.querySelector<HTMLLabelElement>(`label[for='${textarea.id}']`);
      expect(label?.textContent).toBe('v2_listening_mission_answer_label');
      expect(textarea.value).toBe('');
      expect(textarea.className).toContain('min-w-0');
      expect(textarea.className).toContain('[overflow-wrap:anywhere]');
      expect(
        Array.from(container.querySelectorAll<HTMLButtonElement>('button')).every((button) =>
          button.className.includes('min-h-11')
        )
      ).toBe(true);
    }
  );

  it('preserves draft and cumulative hints through an accessible exit dialog', async () => {
    const harness = createHarness();
    await renderMission(root, harness, snapshot(1, { support: true }));

    const textarea = getTextarea(container);
    changeTextarea(textarea, 'private draft');
    await click(getButton(container, 'v2_listening_mission_hint'));
    expect(container.textContent).toContain('v2_listening_mission_hint_level:1');

    const exit = getButton(container, 'v2_listening_mission_exit');
    exit.focus();
    await click(exit);

    const dialog = container.querySelector<HTMLElement>("[role='alertdialog']");
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBeTruthy();
    expect(dialog?.getAttribute('aria-describedby')).toBeTruthy();
    const continueButton = getButton(dialog!, 'v2_listening_mission_continue_mission');
    const saveButton = getButton(dialog!, 'v2_listening_mission_save_and_exit');
    expect(document.activeElement).toBe(continueButton);

    dispatchKey(continueButton, 'Tab', { shiftKey: true });
    expect(document.activeElement).toBe(saveButton);
    dispatchKey(saveButton, 'Tab');
    expect(document.activeElement).toBe(continueButton);

    dispatchKey(dialog!, 'Escape');
    await flush();
    expect(container.querySelector("[role='alertdialog']")).toBeNull();
    expect(document.activeElement).toBe(exit);
    expect(getTextarea(container).value).toBe('private draft');
    expect(container.textContent).toContain('v2_listening_mission_hint_level:1');
  });

  it('submits Enter only outside IME composition and keeps Shift+Enter multiline', async () => {
    const harness = createHarness();
    await renderMission(root, harness, snapshot(1, { support: true }));

    const textarea = getTextarea(container);
    changeTextarea(textarea, 'Answer 1');
    act(() => textarea.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })));
    const composingEnter = dispatchKey(textarea, 'Enter');
    expect(composingEnter.defaultPrevented).toBe(false);
    expect(getTextarea(container)).toBe(textarea);
    expect(container.textContent).not.toContain('v2_listening_mission_answer_heading');

    const shiftedEnter = dispatchKey(textarea, 'Enter', { shiftKey: true });
    expect(shiftedEnter.defaultPrevented).toBe(false);
    expect(getTextarea(container)).toBe(textarea);
    act(() => textarea.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
    const submitEnter = dispatchKey(textarea, 'Enter');
    expect(submitEnter.defaultPrevented).toBe(true);
    await flush();

    expect(container.querySelector('textarea')).toBeNull();
    expect(container.textContent).toContain('v2_listening_mission_answer_heading');
    expect(container.textContent).toContain('Answer 1');
    expect(container.textContent).toContain('도움 1');
    expect(document.activeElement).toBe(getButton(container, 'v2_listening_mission_next'));
  });

  it('renders cumulative authored hints and never labels Reveal as cleared', async () => {
    const harness = createHarness();
    await renderMission(root, harness, snapshot(1, { support: true }));

    await click(getButton(container, 'v2_listening_mission_hint'));
    await click(getButton(container, 'v2_listening_mission_hint'));
    await click(getButton(container, 'v2_listening_mission_hint'));

    expect(container.textContent).toContain('v2_listening_mission_hint_level:1');
    expect(container.textContent).toContain('v2_listening_mission_hint_level:2');
    expect(container.textContent).toContain('v2_listening_mission_hint_level:3');
    expect(container.textContent).toContain('도움 1');

    await click(getButton(container, 'v2_listening_mission_reveal'));
    await flush();
    expect(container.textContent).toContain('v2_listening_mission_hint_level:4');
    expect(container.textContent).toContain('v2_listening_mission_line_retry');
    expect(container.textContent).not.toContain('v2_listening_mission_line_completed');
    expect(container.textContent).toContain('Answer 1');
    expect(document.activeElement).toBe(getButton(container, 'v2_listening_mission_next'));
  });

  it('skips support cleanly when the mission has no aligned support', async () => {
    const harness = createHarness();
    await renderMission(root, harness, snapshot(1));

    await click(getButton(container, 'v2_listening_mission_hint'));
    await click(getButton(container, 'v2_listening_mission_hint'));
    expect(container.textContent).toContain('v2_listening_mission_hint_level:1');
    expect(container.textContent).toContain('v2_listening_mission_hint_level:2');
    expect(container.textContent).not.toContain('v2_listening_mission_hint_level:3');
    expect(getButton(container, 'v2_listening_mission_reveal')).not.toBeNull();
  });

  it('distinguishes Almost from Try again while preserving editable focus and draft', async () => {
    const harness = createHarness();
    const base = snapshot(1);
    await renderMission(root, harness, {
      ...base,
      segments: [{ ...base.segments[0], answerText: 'abcdefghij' }],
    });

    const textarea = getTextarea(container);
    changeTextarea(textarea, 'abcdefghiX');
    dispatchKey(textarea, 'Enter');
    await flush();
    let feedback = container.querySelector<HTMLElement>("[role='status']:not(.sr-only)");
    expect(feedback?.textContent).toContain('v2_listening_mission_almost');
    expect(feedback?.querySelector('svg')?.className.baseVal).toContain('text-primary');
    expect(getTextarea(container).value).toBe('abcdefghiX');
    expect(document.activeElement).toBe(textarea);

    changeTextarea(textarea, 'abcdefghXY');
    dispatchKey(textarea, 'Enter');
    await flush();
    feedback = container.querySelector<HTMLElement>("[role='status']:not(.sr-only)");
    expect(feedback?.textContent).toContain('v2_listening_mission_try_again');
    expect(feedback?.querySelector('svg')?.className.baseVal).toContain('text-destructive');
    expect(getTextarea(container).value).toBe('abcdefghXY');
    expect(document.activeElement).toBe(textarea);
  });

  it('wraps deterministic long English, Korean, and no-space text in light and dark hosts', async () => {
    document.documentElement.classList.add('dark');
    const harness = createHarness();
    const base = snapshot(1, { support: true });
    const longAnswer =
      'A deliberately long English sentence 한국어 문장 ' + 'NoBreakToken'.repeat(40);
    const longSupport = '긴 도움 문장 ' + '지원텍스트'.repeat(50);
    await renderMission(root, harness, {
      ...base,
      segments: [
        {
          ...base.segments[0],
          alignedSupport: { sourceIndices: [100], text: longSupport },
          answerText: longAnswer,
        },
      ],
    });

    await click(getButton(container, 'v2_listening_mission_hint'));
    await click(getButton(container, 'v2_listening_mission_hint'));
    await click(getButton(container, 'v2_listening_mission_hint'));
    await click(getButton(container, 'v2_listening_mission_reveal'));

    for (const width of [320, 360, 390]) {
      container.style.width = `${width}px`;
      expect(container.querySelectorAll("[data-scroll-owner='listening-mission']")).toHaveLength(1);
      expect(container.querySelectorAll('[data-scroll-owner] [data-scroll-owner]')).toHaveLength(0);
      expect(
        Array.from(container.querySelectorAll<HTMLElement>('[class*="overflow-wrap:anywhere"]')).some(
          ({ textContent }) => textContent?.includes('NoBreakToken')
        )
      ).toBe(true);
      expect(container.textContent).toContain(longSupport);
    }
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('uses retry-round position and renders local Results without sharing claims', async () => {
    const harness = createHarness();
    await renderMission(root, harness, snapshot(2, { support: true }));

    changeTextarea(getTextarea(container), 'wrong');
    dispatchKey(getTextarea(container), 'Enter');
    expect(container.textContent).toContain('v2_listening_mission_try_again');
    expect(container.querySelector('textarea')).not.toBeNull();

    changeTextarea(getTextarea(container), 'Answer 1');
    dispatchKey(getTextarea(container), 'Enter');
    await flush();
    await click(getButton(container, 'v2_listening_mission_next'));
    await click(getButton(container, 'v2_listening_mission_later'));

    expect(container.textContent).toContain('v2_listening_mission_summary_title');
    expect(container.textContent).toContain('v2_listening_mission_summary_retry:2');
    expect(document.activeElement?.textContent).toBe('v2_listening_mission_summary_title');
    await click(getButton(container, 'v2_listening_mission_retry_lines'));
    expect(container.textContent).toContain('v2_listening_mission_retry_round');
    expect(container.textContent).toContain('v2_listening_mission_round_progress:1/2');
    expect(getTextarea(container).value).toBe('');
    expect(container.textContent).not.toContain('v2_listening_mission_hint_level');

    changeTextarea(getTextarea(container), 'Answer 1');
    dispatchKey(getTextarea(container), 'Enter');
    await flush();
    await click(getButton(container, 'v2_listening_mission_next'));
    expect(container.textContent).toContain('v2_listening_mission_round_progress:2/2');
    changeTextarea(getTextarea(container), 'Answer 2');
    dispatchKey(getTextarea(container), 'Enter');
    await flush();
    await click(getButton(container, 'v2_listening_mission_next'));
    await flush();

    expect(container.textContent).toContain('v2_listening_mission_results_title');
    expect(document.activeElement?.textContent).toBe('v2_listening_mission_results_title');
    expect(container.textContent).toContain('v2_listening_mission_progress_saved');
    expect(container.textContent).toContain('v2_listening_mission_results_retry:2/2');
    expect(container.textContent).toContain('v2_listening_mission_stars:');
    expect(container.textContent?.toLowerCase()).not.toContain('share');
    expect(container.textContent?.toLowerCase()).not.toContain('leaderboard');
  });

  it('stays isolated from production mounts and never sends typed answer text', async () => {
    const componentSource = readFileSync(
      join(process.cwd(), 'src/ui/features/listening-mission/listening-mission.tsx'),
      'utf8'
    );
    const productionSource = readProductionSource([
      'src/ui/app.tsx',
      'src/ui/index.tsx',
      'src/ui/pages',
      'src/background',
      'src/content',
      'src/utils/message',
    ]);

    expect(componentSource).not.toMatch(/@storage|@utils\/message|@\/ui\/(?:pages|store)|chrome\./u);
    expect(productionSource).not.toContain('listening-mission');

    const harness = createHarness();
    await renderMission(root, harness, snapshot(1, { support: true }));
    changeTextarea(getTextarea(container), 'typed secret answer');
    await click(getButton(container, 'v2_listening_mission_hint'));
    const exit = getButton(container, 'v2_listening_mission_exit');
    exit.focus();
    await click(exit);
    await click(getButton(container, 'v2_listening_mission_continue_mission'));

    const controllerCalls = JSON.stringify({
      commit: harness.commitProgress.mock.calls,
      difficult: harness.saveDifficultSegments.mock.calls,
      end: harness.endSession.mock.calls,
      play: harness.playSegment.mock.calls,
    });
    expect(controllerCalls).not.toContain('typed secret answer');
    expect(controllerCalls).not.toContain('Answer 1');
    expect(controllerCalls).not.toContain('도움 1');
    expect(
      Array.from(container.querySelectorAll('*')).flatMap((element) =>
        Array.from(element.attributes, ({ value }) => value)
      )
    ).not.toContain('typed secret answer');
  });
});

type MissionHarness = ReturnType<typeof createHarness>;

function createHarness() {
  const playSegment = vi.fn(async (): Promise<PlaySegmentResult> => ({ status: 'played' }));
  const commitProgress = vi.fn(async (): Promise<CommitProgressResult> => ({ status: 'saved' }));
  const endSession = vi.fn(async (): Promise<EndSessionResult> => ({ status: 'ended' }));
  const saveDifficultSegments = vi.fn(
    async (segmentKeys: string[]): Promise<DifficultSaveResult> => ({
      retryableFailures: [],
      saved: segmentKeys,
    })
  );
  const controller = {
    commitProgress,
    endSession,
    playSegment,
    saveDifficultSegments,
  } satisfies ListeningMissionController;

  return {
    commitProgress,
    controller,
    endSession,
    getPracticedAt: vi.fn(() => PRACTICED_AT),
    onExit: vi.fn(),
    onNextMission: vi.fn(),
    onOwnershipChange: vi.fn(),
    playSegment,
    saveDifficultSegments,
  };
}

async function renderMission(
  root: Root | undefined,
  harness: MissionHarness,
  missionSnapshot: ListeningMissionSnapshot
) {
  if (!root) throw new Error('Expected a React root');
  await act(async () => {
    root.render(
      <ListeningMission
        controller={harness.controller}
        getPracticedAt={harness.getPracticedAt}
        onExit={harness.onExit}
        onNextMission={harness.onNextMission}
        onOwnershipChange={harness.onOwnershipChange}
        snapshot={missionSnapshot}
      />
    );
    await Promise.resolve();
  });
  await flush();
}

const key = (index: number): ListeningSegmentKey =>
  `segment-v1-${index.toString(16).padStart(64, '0')}` as ListeningSegmentKey;

const snapshot = (
  count: number,
  options: { support?: boolean } = {}
): ListeningMissionSnapshot => ({
  learningLanguage: 'en',
  segmenterVersion: 1,
  segments: Array.from({ length: count }, (_, index) => ({
    ...(options.support
      ? {
          alignedSupport: {
            sourceIndices: [index + 100],
            text: `도움 ${index + 1}`,
          },
        }
      : {}),
    answerText: `Answer ${index + 1}`,
    segmentKey: key(index),
    sourceIndices: [index],
    sourceKey: SOURCE_KEY,
  })),
  sourceKey: SOURCE_KEY,
  videoId: 'video-1',
});

function getTextarea(scope: ParentNode) {
  const textarea = scope.querySelector<HTMLTextAreaElement>('textarea');
  if (!textarea) throw new Error('Expected an answer textarea');
  return textarea;
}

function getButton(scope: ParentNode, name: string) {
  const button = Array.from(scope.querySelectorAll<HTMLButtonElement>('button')).find(
    ({ textContent }) => textContent?.trim() === name || textContent?.trim().startsWith(`${name}:`)
  );
  if (!button) throw new Error(`Expected button: ${name}`);
  return button;
}

function changeTextarea(textarea: HTMLTextAreaElement, value: string) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (!setter) throw new Error('Expected native textarea value setter');
    setter.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function dispatchKey(
  target: Element,
  keyValue: string,
  options: Pick<KeyboardEventInit, 'shiftKey'> = {}
) {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key: keyValue,
    ...options,
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

async function click(target: HTMLElement) {
  await act(async () => {
    target.click();
    await Promise.resolve();
  });
  await flush();
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function readProductionSource(relativePaths: readonly string[]) {
  const visit = (path: string): string => {
    const entries = readdirSync(path, { withFileTypes: true });
    return entries
      .filter(({ name }) => !name.includes('.test.') && !name.includes('listening-mission'))
      .map((entry) => {
        const child = join(path, entry.name);
        if (entry.isDirectory()) return visit(child);
        return /\.tsx?$/u.test(entry.name) ? readFileSync(child, 'utf8') : '';
      })
      .join('\n');
  };

  return relativePaths
    .map((relativePath) => {
      const path = join(process.cwd(), relativePath);
      return /\.tsx?$/u.test(relativePath) ? readFileSync(path, 'utf8') : visit(path);
    })
    .join('\n');
}
