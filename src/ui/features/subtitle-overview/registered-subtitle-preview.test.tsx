import { act } from 'react';

import type { SubtitleId } from '@storage/subtitle';
import type { V2RegisteredSubtitleMetadata } from '@storage/v2/type';
import { createRoot, Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { RegisteredSubtitlePreview } from './registered-subtitle-preview';
import type { RegisteredSubtitlePreviewState } from './use-registered-subtitle-preview';

const testState = vi.hoisted(() => ({
  measureElement: vi.fn(),
  retry: vi.fn(),
  scrollToOffset: vi.fn(),
  viewState: { status: 'loading' } as unknown,
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({
    count,
    getItemKey,
  }: {
    count: number;
    getItemKey: (index: number) => string | number;
  }) => ({
    getTotalSize: () => count * 44,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: getItemKey(index),
        start: index * 44,
      })),
    measureElement: testState.measureElement,
    scrollToOffset: testState.scrollToOffset,
  }),
}));

vi.mock('./use-registered-subtitle-preview', () => ({
  useRegisteredSubtitlePreview: () => ({
    retry: testState.retry,
    viewState: testState.viewState,
  }),
}));

const SUBTITLE_ID = 'subtitle-00000000-0000-4000-8000-000000000001' as SubtitleId;
const subtitle: V2RegisteredSubtitleMetadata = {
  id: SUBTITLE_ID,
  title: 'Preview source',
  language: 'en',
  savedAt: '2026-08-01T00:00:00.000Z',
  delay: 0.25,
};

describe('RegisteredSubtitlePreview', () => {
  let container: HTMLDivElement;
  let root: Root;
  let onBack: () => void;

  beforeAll(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));

  beforeEach(() => {
    vi.clearAllMocks();
    testState.viewState = { status: 'loading', subtitleId: SUBTITLE_ID };
    vi.mocked(chrome.i18n.getMessage).mockImplementation((key, substitutions) => {
      const values = Array.isArray(substitutions)
        ? substitutions
        : substitutions
          ? [substitutions]
          : [];
      return values.length > 0 ? `${key}:${values.join('|')}` : key;
    });
    onBack = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  afterAll(() => vi.unstubAllGlobals());

  it('shows a distinct registered-source header and returns through Back', () => {
    renderPreview(root, subtitle, onBack);

    expect(container.textContent).toContain('v2_registered_subtitle_preview_title');
    expect(container.textContent).toContain(subtitle.title);
    expect(container.textContent).toContain('english');
    expect(container.textContent).not.toContain('learning_subtitle');
    expect(container.textContent).not.toContain('support_subtitle');

    act(() => getButton(container, 'v2_registered_subtitle_preview_back').click());
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('renders compact canonical cues, applies delay once, and expands details on activation', () => {
    testState.viewState = readyState([
      { start: 1, end: 2, text: '<i>First &amp; long preview cue</i>' },
      { start: 3, end: 4, text: 'Second cue' },
      { start: 5, end: 6, text: '<b> </b>' },
    ]);
    renderPreview(root, subtitle, onBack);

    const rows = getCueRows(container);
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('First & long preview cue');
    expect(rows[0].getAttribute('aria-label')).toContain('00:01–00:02');
    expect(rows[0].getAttribute('aria-expanded')).toBe('false');
    expect(rows[0].querySelector('[data-preview-end-time]')?.className).toContain('hidden');
    expect(container.textContent).toContain('v2_subtitle_overview_count:2|2');
    expect(container.textContent).toContain('v2_subtitle_overview_time_range:00:01|00:04');
    expect(container.textContent).toContain('v2_local_subtitles_sync_value:0.3');

    act(() => rows[0].click());
    expect(rows[0].getAttribute('aria-expanded')).toBe('true');
    expect(rows[0].querySelector('[data-preview-end-time]')?.className).toContain('inline');

    expect(findButton(container, 'v2_subtitle_overview_save_row')).toBeUndefined();
    expect(container.querySelector('[data-subtitle-overview-seek]')).toBeNull();
    expect(container.textContent).not.toContain('v2_subtitle_overview_following');
    expect(container.textContent).not.toContain('v2_subtitle_overview_change_source');
  });

  it('searches only the selected registered track and keeps source order', () => {
    testState.viewState = readyState([
      { start: 4, end: 5, text: 'Alpha first in source order' },
      { start: 1, end: 2, text: 'Beta cue' },
      { start: 3, end: 4, text: 'Another ALPHA cue' },
    ]);
    renderPreview(root, subtitle, onBack);

    act(() => setInputValue(getSearchInput(container), '  alpha '));

    expect(getCueRows(container).map(({ textContent }) => textContent)).toEqual([
      expect.stringContaining('Alpha first in source order'),
      expect.stringContaining('Another ALPHA cue'),
    ]);
    expect(container.textContent).toContain('v2_subtitle_overview_count:2|3');
    expect(testState.scrollToOffset).toHaveBeenCalledWith(0);

    act(() => getButton(container, 'clear_search').click());
    expect(getCueRows(container)).toHaveLength(3);
  });

  it('shows truthful loading, error, retry, empty, and deleted states', () => {
    renderPreview(root, subtitle, onBack);
    expect(container.textContent).toContain('v2_registered_subtitle_preview_loading');

    testState.viewState = { status: 'error', subtitleId: SUBTITLE_ID };
    renderPreview(root, subtitle, onBack);
    expect(container.querySelector('[role=alert]')?.textContent).toContain(
      'v2_registered_subtitle_preview_error'
    );
    act(() => getButton(container, 'v2_retry').click());
    expect(testState.retry).toHaveBeenCalledOnce();

    testState.viewState = readyState([]);
    renderPreview(root, subtitle, onBack);
    expect(container.textContent).toContain('v2_registered_subtitle_preview_empty');

    testState.viewState = { status: 'unavailable', subtitleId: SUBTITLE_ID };
    renderPreview(root, undefined, onBack);
    expect(container.textContent).toContain('v2_registered_subtitle_preview_unavailable');
    expect(container.querySelector("[data-scroll-owner='registered-subtitle-preview']")).toBeNull();
  });
});

const readyState = (
  cues: Extract<RegisteredSubtitlePreviewState, { status: 'ready' }>['cues']
): RegisteredSubtitlePreviewState => ({
  status: 'ready',
  subtitleId: SUBTITLE_ID,
  cues,
});

const renderPreview = (
  root: Root,
  selectedSubtitle: V2RegisteredSubtitleMetadata | undefined,
  onBack: () => void
) => {
  act(() =>
    root.render(
      <RegisteredSubtitlePreview
        subtitleId={SUBTITLE_ID}
        subtitle={selectedSubtitle}
        onBack={onBack}
      />
    )
  );
};

const getCueRows = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>('[data-preview-cue]'));

const getSearchInput = (container: HTMLElement) => {
  const input = container.querySelector<HTMLInputElement>('input[type=search]');
  if (!input) throw new Error('Expected preview search input');
  return input;
};

const setInputValue = (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

const getButton = (container: HTMLElement, accessibleName: string) => {
  const button = findButton(container, accessibleName);
  if (!button) throw new Error(`Expected button: ${accessibleName}`);
  return button;
};

const findButton = (container: HTMLElement, accessibleName: string) =>
  Array.from(container.querySelectorAll('button')).find(
    (candidate) =>
      candidate.getAttribute('aria-label') === accessibleName ||
      candidate.textContent === accessibleName
  );
