import { act } from 'react';
import type { ComponentProps } from 'react';

import type { V2LearningCardStorageApi } from '@storage/v2/learning-card-storage';
import type { SubtitleOverviewResponse } from '@utils/message/type';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { SubtitleOverview as ProductionSubtitleOverview } from './subtitle-overview';
import type { SubtitleOverviewViewState } from './use-subtitle-overview';

const testState = vi.hoisted(() => ({
  activeTabId: 7 as number | undefined,
  emitProgrammaticScroll: false,
  hookArgs: [] as unknown[][],
  measure: vi.fn(),
  measureElement: vi.fn(),
  rangeEndIndex: 2,
  rangeStartIndex: 0,
  refresh: vi.fn(),
  scrollToIndex: vi.fn(),
  scrollToOffset: vi.fn(),
  sendMessageToTab: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
  viewState: { status: 'loading' } as unknown,
  virtualIndexes: [0, 1, 2],
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({
    count,
    getScrollElement,
    getItemKey,
  }: {
    count: number;
    getScrollElement: () => HTMLElement | null;
    getItemKey: (index: number) => string | number;
  }) => ({
    getTotalSize: () => count * 49,
    getVirtualItems: () =>
      testState.virtualIndexes
        .filter((index) => index < count)
        .map((index) => ({ index, key: getItemKey(index), start: index * 49 })),
    measure: testState.measure,
    measureElement: testState.measureElement,
    range:
      count === 0
        ? null
        : {
            endIndex: Math.min(testState.rangeEndIndex, count - 1),
            startIndex: Math.min(testState.rangeStartIndex, count - 1),
          },
    scrollToIndex: (...args: unknown[]) => {
      testState.scrollToIndex(...args);
      if (testState.emitProgrammaticScroll) {
        getScrollElement()?.dispatchEvent(new Event('scroll', { bubbles: true }));
      }
    },
    scrollToOffset: (...args: unknown[]) => {
      testState.scrollToOffset(...args);
      if (testState.emitProgrammaticScroll) {
        getScrollElement()?.dispatchEvent(new Event('scroll', { bubbles: true }));
      }
    },
  }),
}));

vi.mock('@utils/message', () => ({
  sendMessageToTab: testState.sendMessageToTab,
}));

vi.mock('sonner', () => ({
  toast: {
    error: testState.toastError,
    info: testState.toastInfo,
    success: testState.toastSuccess,
  },
}));

vi.mock('./use-subtitle-overview', () => ({
  useSubtitleOverview: (...args: unknown[]) => {
    testState.hookArgs.push(args);
    return {
      activeTabId: testState.activeTabId,
      refresh: testState.refresh,
      viewState: testState.viewState,
    };
  },
}));

const snapshot: Extract<SubtitleOverviewResponse, { status: 'ready' }> = {
  status: 'ready',
  identity: {
    contentInstanceId: 'content-1',
    routeChangedAt: 1,
    videoId: 'video-1',
    videoRevision: 1,
  },
  subtitleRevision: 23,
  currentTime: 3.5,
  tracks: {
    learning: {
      role: 'learning',
      language: 'en',
      source: {
        kind: 'registered',
        language: 'en',
        subtitleId: 'learning-upload',
        delaySeconds: 0.25,
      },
      cues: [
        {
          sourceIndex: 4,
          startTime: 1,
          endTime: 2,
          text: 'Alpha sentence',
          alignedSupport: { sourceIndices: [2], text: 'Support for alpha' },
        },
        {
          sourceIndex: 8,
          startTime: 3,
          endTime: 4,
          text: 'Current beta',
          alignedSupport: { sourceIndices: [5], text: 'Support for beta' },
        },
        { sourceIndex: 12, startTime: 5, endTime: 6, text: 'Another alpha' },
      ],
    },
    support: {
      role: 'support',
      language: 'ko',
      source: { kind: 'native', language: 'ko' },
      cues: [
        { sourceIndex: 2, startTime: 1, endTime: 2, text: 'Support for alpha' },
        { sourceIndex: 5, startTime: 3, endTime: 4, text: 'Support for beta' },
        { sourceIndex: 9, startTime: 6.5, endTime: 7.5, text: 'Unpaired support' },
      ],
    },
  },
};

const learningProfile = { learningLanguage: 'en', supportLanguage: 'ko' } as const;
const learningCardStorage = {
  get: vi.fn(async () => []),
} as unknown as V2LearningCardStorageApi;

function SubtitleOverview(
  props: Omit<
    ComponentProps<typeof ProductionSubtitleOverview>,
    'cardRevision' | 'learningCardStorage'
  >
) {
  return (
    <ProductionSubtitleOverview
      {...props}
      cardRevision={0}
      learningCardStorage={learningCardStorage}
    />
  );
}

describe('SubtitleOverview', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal(
      'ResizeObserver',
      class ResizeObserver {
        disconnect() {}
        observe() {}
        unobserve() {}
      }
    );
  });

  beforeEach(() => {
    vi.clearAllMocks();
    testState.activeTabId = 7;
    testState.emitProgrammaticScroll = false;
    testState.hookArgs = [];
    testState.rangeEndIndex = 2;
    testState.rangeStartIndex = 0;
    testState.viewState = readyState(snapshot);
    testState.virtualIndexes = [0, 1, 2];
    testState.sendMessageToTab.mockResolvedValue({
      success: true,
      data: { status: 'played' },
    });
    vi.mocked(chrome.i18n.getMessage).mockImplementation((key, substitutions) => {
      if (Array.isArray(substitutions) && substitutions.length > 0) {
        return `${key}:${substitutions.join('/')}`;
      }
      return key;
    });
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: vi.fn((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      }),
    });
    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      value: vi.fn(),
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  afterAll(() => vi.unstubAllGlobals());

  it('uses one atomic overview request and hides view modes without a support language', () => {
    testState.viewState = readyState({
      ...snapshot,
      tracks: { ...snapshot.tracks, support: null },
    });

    act(() => {
      root.render(
        <SubtitleOverview
          learningProfile={{ learningLanguage: 'en', supportLanguage: null }}
        />
      );
    });

    expect(findButton(container, 'v2_subtitle_overview_together')).toBeUndefined();
    expect(findButton(container, 'v2_subtitle_overview_support')).toBeUndefined();
    expect(container.textContent).toContain('learning_subtitle');
    expect(testState.hookArgs.every((args) => args.length === 0)).toBe(true);
  });

  it('defaults to Together, renders aligned support, and identifies the active sources', () => {
    const onChangeSource = vi.fn();
    act(() => {
      root.render(
        <SubtitleOverview
          learningProfile={learningProfile}
          onChangeSource={onChangeSource}
          sourceTitles={{ 'learning-upload': 'My learning subtitles' }}
        />
      );
    });

    expect(getButton(container, 'v2_subtitle_overview_together').getAttribute('aria-pressed')).toBe(
      'true'
    );
    expect(getCueButtons(container)[0].textContent).toContain('Alpha sentence');
    expect(getCueButtons(container)[0].textContent).toContain('Support for alpha');
    expect(container.textContent).toContain('My learning subtitles');
    expect(container.textContent).toContain('v2_subtitle_overview_source_coupang_play');

    act(() => getButton(container, 'v2_subtitle_overview_change_source').click());
    expect(onChangeSource).toHaveBeenCalledWith('learning');
  });

  it('uses compact role labels and dense two-line rows without repeated role metadata', () => {
    act(() => root.render(<SubtitleOverview learningProfile={learningProfile} />));

    expect(getButton(container, 'v2_subtitle_overview_learning')).toBeDefined();
    expect(getButton(container, 'v2_subtitle_overview_support')).toBeDefined();

    const firstRow = getCueButtons(container)[0];
    expect(firstRow.textContent).toContain('00:01');
    expect(firstRow.textContent).toContain('Alpha sentence');
    expect(firstRow.textContent).toContain('Support for alpha');
    expect(firstRow.textContent).not.toContain('support_subtitle');
    expect(firstRow.querySelectorAll('[data-subtitle-overview-learning-text]')).toHaveLength(1);
    expect(firstRow.querySelectorAll('[data-subtitle-overview-support-text]')).toHaveLength(1);
    expect(firstRow.getAttribute('aria-label')).toContain('Alpha sentence');
    expect(firstRow.getAttribute('aria-label')).toContain('Support for alpha');
    expect(firstRow.getAttribute('aria-label')).toContain('00:01–00:02');

    const rowContainer = firstRow.closest('[data-row-key]');
    expect(rowContainer?.className).toContain('border-b');
    expect(rowContainer?.className).not.toContain('pb-2');
  });

  it('opens full cue text after a complete touch tap while seeking once', async () => {
    act(() => root.render(<SubtitleOverview learningProfile={learningProfile} />));
    const row = getCueButtons(container)[0];

    act(() => {
      dispatchTouchPointerEvent(row, 'pointerdown');
      dispatchTouchPointerEvent(row, 'pointerup');
      row.click();
    });

    expect(testState.sendMessageToTab).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector("[data-slot='tooltip-content']")).toBeNull();

    await act(waitForNextTimer);

    const detail = document.body.querySelector<HTMLElement>(
      "[data-slot='tooltip-content']"
    );
    expect(detail?.textContent).toContain('Alpha sentence');
    expect(detail?.textContent).toContain('Support for alpha');
    expect(detail?.textContent).toContain('00:01–00:02');
  });

  it('cancels pending touch detail disclosure when the cue list scrolls', async () => {
    act(() => root.render(<SubtitleOverview learningProfile={learningProfile} />));
    const row = getCueButtons(container)[0];

    act(() => {
      dispatchTouchPointerEvent(row, 'pointerdown');
      dispatchTouchPointerEvent(row, 'pointerup');
      row.click();
      getScrollOwner(container).dispatchEvent(new Event('scroll', { bubbles: true }));
    });

    await act(waitForNextTimer);

    expect(document.body.querySelector("[data-slot='tooltip-content']")).toBeNull();
  });

  it('opens full cue text and range from keyboard focus', () => {
    act(() => root.render(<SubtitleOverview learningProfile={learningProfile} />));

    act(() => getCueButtons(container)[0].focus());

    const detail = document.body.querySelector<HTMLElement>(
      "[data-slot='tooltip-content']"
    );
    expect(detail?.textContent).toContain('Alpha sentence');
    expect(detail?.textContent).toContain('Support for alpha');
    expect(detail?.textContent).toContain('00:01–00:02');
    expect(detail?.className.split(' ')).toEqual(
      expect.arrayContaining([
        'max-h-[min(calc(100dvh_-_1rem),var(--radix-tooltip-content-available-height))]',
        'overflow-y-auto',
        'break-words',
      ])
    );
  });

  it('filters in source order without resetting measured row heights and scrolls to the top', () => {
    act(() => root.render(<SubtitleOverview learningProfile={learningProfile} />));
    testState.measure.mockClear();
    testState.scrollToOffset.mockClear();

    const search = getSearchInput(container);
    act(() => setInputValue(search, '  ALPHA  '));

    expect(getCueButtons(container).map((row) => row.textContent)).toEqual([
      expect.stringContaining('Alpha sentence'),
      expect.stringContaining('Another alpha'),
    ]);
    expect(container.textContent).toContain('v2_subtitle_overview_count:2/3');
    expect(container.textContent).toContain('v2_subtitle_overview_time_range:00:01/00:06');
    expect(testState.measure).not.toHaveBeenCalled();
    expect(testState.scrollToOffset).toHaveBeenLastCalledWith(0);

    act(() => getButton(container, 'clear_search').click());
    expect(container.textContent).not.toContain('v2_subtitle_overview_following');
    act(() => getButton(container, 'v2_subtitle_overview_resume_follow').click());

    expect(container.textContent).toContain('v2_subtitle_overview_following');
    expect(testState.scrollToIndex).toHaveBeenLastCalledWith(1, { align: 'center' });
  });

  it('switches among Together, Learning, and Support and resets the query each time', () => {
    act(() => root.render(<SubtitleOverview learningProfile={learningProfile} />));

    act(() => setInputValue(getSearchInput(container), 'support for alpha'));
    expect(getCueButtons(container)).toHaveLength(1);
    expect(getCueButtons(container)[0].textContent).toContain('Alpha sentence');

    act(() => getButton(container, 'v2_subtitle_overview_learning').click());
    expect(getSearchInput(container).value).toBe('');
    expect(
      getButton(container, 'v2_subtitle_overview_learning').getAttribute('aria-pressed')
    ).toBe('true');
    expect(getCueButtons(container)[0].textContent).toContain('Alpha sentence');
    expect(getCueButtons(container)[0].textContent).not.toContain('Support for alpha');

    act(() => setInputValue(getSearchInput(container), 'beta'));
    act(() => getButton(container, 'v2_subtitle_overview_support').click());
    expect(getSearchInput(container).value).toBe('');
    expect(
      getButton(container, 'v2_subtitle_overview_support').getAttribute('aria-pressed')
    ).toBe('true');
    expect(getCueButtons(container).map((row) => row.textContent)).toEqual([
      expect.stringContaining('Support for alpha'),
      expect.stringContaining('Support for beta'),
      expect.stringContaining('Unpaired support'),
    ]);
    expect(getSaveButtons(container)).toHaveLength(0);
  });

  it('keeps a rendered tab stop, moves roving focus, and seeks from an actual row button', async () => {
    act(() => root.render(<SubtitleOverview learningProfile={learningProfile} />));

    const rows = getCueButtons(container);
    expect(rows[1].getAttribute('aria-current')).toBe('true');
    expect(rows[1].tabIndex).toBe(0);
    expect(rows[1].textContent).toContain('00:03');
    expect(rows[1].getAttribute('aria-label')).toContain('00:03–00:04');
    expect(rows[1].getAttribute('aria-label')).toContain('v2_subtitle_overview_current');
    expect(rows[1].textContent).not.toContain('00:04');
    expect(
      rows[1]
        .closest('[data-row-key]')
        ?.querySelector('[data-subtitle-overview-current-marker]')
    ).not.toBeNull();

    act(() => {
      rows[1].focus();
      rows[1].dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown' }));
    });
    expect(document.activeElement).toBe(getCueButtons(container)[2]);
    expect(container.textContent).toContain('v2_subtitle_overview_resume_follow');

    await act(async () => getCueButtons(container)[2].click());
    expect(testState.sendMessageToTab).toHaveBeenCalledWith(7, 'playVideo', {
      startTime: 5,
      expectedIdentity: snapshot.identity,
      expectedSubtitleRevision: 23,
    });
  });

  it('keeps overscan Save actions out of the tab order and moves Save arrow navigation to seek', () => {
    testState.rangeStartIndex = 1;
    act(() => root.render(<SubtitleOverview learningProfile={learningProfile} />));

    expect(getCueButtons(container).map(({ tabIndex }) => tabIndex)).toEqual([-1, 0, -1]);
    expect(getSaveButtons(container).map(({ tabIndex }) => tabIndex)).toEqual([-1, 0, -1]);

    act(() => {
      const currentSave = getSaveButtons(container)[1];
      currentSave.focus();
      currentSave.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown' })
      );
    });

    expect(document.activeElement).toBe(getCueButtons(container)[2]);
    expect(getSaveButtons(container).map(({ tabIndex }) => tabIndex)).toEqual([-1, -1, 0]);
  });

  it('disables follow on row focus without mistaking programmatic scrolling for user scrolling', () => {
    testState.emitProgrammaticScroll = true;
    act(() => root.render(<SubtitleOverview learningProfile={learningProfile} />));

    expect(container.textContent).toContain('v2_subtitle_overview_following');
    act(() => getCueButtons(container)[0].focus());
    expect(container.textContent).toContain('v2_subtitle_overview_resume_follow');

    act(() => getButton(container, 'v2_subtitle_overview_resume_follow').click());
    expect(container.textContent).toContain('v2_subtitle_overview_following');
    act(() => getScrollOwner(container).dispatchEvent(new Event('scroll', { bubbles: true })));
    expect(container.textContent).toContain('v2_subtitle_overview_resume_follow');
  });

  it('keeps Save focus stable and does not auto-follow after playback moves', () => {
    act(() => root.render(<SubtitleOverview learningProfile={learningProfile} />));
    const firstSave = getSaveButtons(container)[0];

    act(() => firstSave.focus());
    expect(container.textContent).toContain('v2_subtitle_overview_resume_follow');
    expect(firstSave.tabIndex).toBe(0);
    testState.scrollToIndex.mockClear();

    testState.viewState = readyState({ ...snapshot, currentTime: 5.5 });
    act(() => root.render(<SubtitleOverview learningProfile={learningProfile} />));

    expect(testState.scrollToIndex).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(getSaveButtons(container)[0]);
    expect(getSaveButtons(container)[0].tabIndex).toBe(0);
  });

  it.each(['stale', 'no-video'] as const)(
    'shows invalid seek feedback and immediately refreshes a %s snapshot',
    async (status) => {
      testState.sendMessageToTab.mockResolvedValueOnce({
        success: true,
        data: { status },
      });
      act(() => root.render(<SubtitleOverview learningProfile={learningProfile} />));

      await act(async () => getCueButtons(container)[0].click());

      expect(container.textContent).toContain('v2_subtitle_overview_seek_error');
      expect(testState.refresh).toHaveBeenCalledWith(status);
      expect(testState.sendMessageToTab).toHaveBeenCalledWith(7, 'playVideo', {
        startTime: 1,
        expectedIdentity: snapshot.identity,
        expectedSubtitleRevision: 23,
      });
    }
  );

  it('shows seek feedback for a transport failure without controlling stale content', async () => {
    testState.sendMessageToTab.mockRejectedValueOnce(new Error('disconnected'));
    act(() => root.render(<SubtitleOverview learningProfile={learningProfile} />));

    await act(async () => getCueButtons(container)[0].click());

    expect(container.textContent).toContain('v2_subtitle_overview_seek_error');
    expect(testState.refresh).not.toHaveBeenCalled();
  });

  it('saves a learning row with only the guarded cue identity from a sibling button', async () => {
    testState.sendMessageToTab.mockResolvedValueOnce({
      success: true,
      data: { status: 'saved-with-support' },
    });
    act(() => root.render(<SubtitleOverview learningProfile={learningProfile} />));

    const seekButton = getCueButtons(container)[0];
    const saveButton = getSaveButtons(container)[0];
    expect(seekButton.contains(saveButton)).toBe(false);
    expect(saveButton.getAttribute('aria-label')).toBe(
      'v2_subtitle_overview_save_row: Alpha sentence'
    );

    await act(async () => saveButton.click());

    expect(testState.sendMessageToTab).toHaveBeenCalledWith(7, 'saveSubtitleOverviewCue', {
      expectedIdentity: snapshot.identity,
      expectedSubtitleRevision: 23,
      learningSourceIndex: 4,
    });
    expect(testState.toastSuccess).toHaveBeenCalledWith(
      'v2_subtitle_overview_saved_with_support'
    );
    expect(container.textContent).not.toContain('v2_subtitle_overview_saved_with_support');
    expect(saveButton.getAttribute('aria-label')).toBe(
      'v2_subtitle_overview_saved_row: Alpha sentence'
    );
    expect(saveButton.getAttribute('aria-pressed')).toBeNull();
    expect(saveButton.disabled).toBe(false);
    expect(saveButton.querySelector('.lucide-bookmark-check')).not.toBeNull();
  });

  it.each([
    ['saved-learning-only', 'success', 'v2_subtitle_overview_saved_learning_only'],
    ['busy', 'info', 'v2_subtitle_overview_save_busy'],
    ['error', 'error', 'v2_subtitle_overview_save_error'],
  ] as const)('shows %s row-save feedback in a toast', async (status, kind, expectedMessage) => {
    testState.sendMessageToTab.mockResolvedValueOnce({ success: true, data: { status } });
    act(() => root.render(<SubtitleOverview learningProfile={learningProfile} />));

    await act(async () => getSaveButtons(container)[0].click());

    const toastMock =
      kind === 'success'
        ? testState.toastSuccess
        : kind === 'info'
          ? testState.toastInfo
          : testState.toastError;
    expect(toastMock).toHaveBeenCalledWith(expectedMessage);
    expect(container.textContent).not.toContain(expectedMessage);
  });

  it('disables every row save while a save is pending', async () => {
    let resolveSave: ((value: unknown) => void) | undefined;
    testState.sendMessageToTab.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSave = resolve;
      })
    );
    act(() => root.render(<SubtitleOverview learningProfile={learningProfile} />));

    act(() => getSaveButtons(container)[0].click());
    expect(getSaveButtons(container).every((button) => button.disabled)).toBe(true);

    await act(async () => {
      resolveSave?.({ success: true, data: { status: 'saved-learning-only' } });
    });
    expect(getSaveButtons(container).every((button) => !button.disabled)).toBe(true);
  });

  it('falls back to a rendered row when the preferred roving row is virtualized away', () => {
    testState.virtualIndexes = [0];
    act(() => root.render(<SubtitleOverview learningProfile={learningProfile} />));

    const rows = getCueButtons(container);
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('Alpha sentence');
    expect(rows[0].tabIndex).toBe(0);
  });

  it('uses the viewport start when the active row remains rendered only as overscan', () => {
    testState.rangeEndIndex = 2;
    testState.rangeStartIndex = 2;
    testState.virtualIndexes = [1, 2];
    act(() => root.render(<SubtitleOverview learningProfile={learningProfile} />));

    const rows = getCueButtons(container);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Current beta'),
      expect.stringContaining('Another alpha'),
    ]);
    expect(rows.map(({ tabIndex }) => tabIndex)).toEqual([-1, 0]);
    expect(getSaveButtons(container).map(({ tabIndex }) => tabIndex)).toEqual([-1, 0]);
  });

  it('shows explicit disconnected, no-video, stale, empty, and error states', () => {
    for (const [state, expected] of [
      [{ status: 'loading' }, 'v2_subtitle_overview_loading'],
      [{ status: 'disconnected' }, 'v2_subtitle_overview_disconnected'],
      [{ status: 'no-video' }, 'v2_subtitle_overview_no_video'],
      [{ status: 'stale' }, 'v2_subtitle_overview_stale'],
      [{ status: 'error' }, 'v2_subtitle_overview_error'],
    ] as const) {
      testState.viewState = state;
      act(() => root.render(<SubtitleOverview learningProfile={learningProfile} />));
      expect(container.textContent).toContain(expected);
    }

    testState.viewState = readyState({
      ...snapshot,
      tracks: {
        ...snapshot.tracks,
        learning: { ...snapshot.tracks.learning, cues: [] },
      },
    });
    act(() => root.render(<SubtitleOverview learningProfile={learningProfile} />));
    expect(container.textContent).toContain('v2_subtitle_overview_empty_learning');
  });

  it.each(['no-video', 'stale', 'error'] as const)(
    'retries the %s state without forwarding the click event as a pending status',
    (status) => {
      testState.viewState = { status };
      act(() => root.render(<SubtitleOverview learningProfile={learningProfile} />));

      act(() => getButton(container, 'v2_retry').click());

      expect(testState.refresh.mock.calls).toEqual([[]]);
    }
  );
});

function readyState(
  readySnapshot: Extract<SubtitleOverviewResponse, { status: 'ready' }>
): SubtitleOverviewViewState {
  return {
    status: 'ready',
    context: {
      activeTabUrl: 'https://www.coupangplay.com/play/1',
      generation: 1,
      learningSubtitleId: 'learning-upload',
      supportSubtitleId: null,
      tabId: 7,
    },
    revision: 1,
    snapshot: readySnapshot,
  };
}

function getSearchInput(container: HTMLElement) {
  const input = container.querySelector<HTMLInputElement>(
    "input[aria-label='v2_subtitle_overview_search_label']"
  );
  if (!input) throw new Error('Expected subtitle search input');
  return input;
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setter) throw new Error('Expected native input value setter');
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function dispatchTouchPointerEvent(
  target: HTMLElement,
  type: 'pointerdown' | 'pointerup',
  pointerId = 1
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientX: { value: 0 },
    clientY: { value: 0 },
    pointerId: { value: pointerId },
    pointerType: { value: 'touch' },
  });
  target.dispatchEvent(event);
}

function waitForNextTimer() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}

function getCueButtons(container: HTMLElement) {
  const scrollOwner = container.querySelector("[data-scroll-owner='subtitle-overview']");
  if (!scrollOwner) return [];
  return Array.from(
    scrollOwner.querySelectorAll<HTMLButtonElement>(
      "button[data-subtitle-overview-seek='true']"
    )
  );
}

function getSaveButtons(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>(
      "button[data-subtitle-overview-save='true']"
    )
  );
}

function getScrollOwner(container: HTMLElement) {
  const scrollOwner = container.querySelector<HTMLElement>(
    "[data-scroll-owner='subtitle-overview']"
  );
  if (!scrollOwner) throw new Error('Expected subtitle overview scroll owner');
  return scrollOwner;
}

function getButton(container: HTMLElement, name: string) {
  const button = findButton(container, name);
  if (!button) throw new Error(`Expected button: ${name}`);
  return button;
}

function findButton(container: HTMLElement, name: string) {
  return Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.getAttribute('aria-label') === name || candidate.textContent === name
  );
}
