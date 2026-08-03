import { act } from 'react';

import { LearningCard } from '@storage/v2/type';
import { createRoot, Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FocusedReview,
  FocusedReviewStorage,
  getFocusedReviewQueue,
  OpenOriginalVideoTarget,
} from './focused-review';

describe('v2 Focused Review queue selector', () => {
  it('keeps assigned cards in storage order and excludes every unassigned card', () => {
    const firstActive = assignedCard('first-active', 'active');
    const completed = assignedCard('completed', 'completed');
    const unassignedActive = unassignedCard('unassigned-active', 'active');
    const secondActive = assignedCard('second-active', 'active');
    const unassignedCompleted = unassignedCard('unassigned-completed', 'completed');
    const cards = [
      firstActive,
      completed,
      unassignedActive,
      secondActive,
      unassignedCompleted,
    ];
    const original = structuredClone(cards);

    expect(getFocusedReviewQueue(cards, 'active')).toEqual([firstActive, secondActive]);
    expect(getFocusedReviewQueue(cards, 'completed')).toEqual([completed]);
    expect(cards).toEqual(original);
  });

  it('returns an empty queue for empty, wrong-state, and unassigned-only inputs', () => {
    expect(getFocusedReviewQueue([], 'active')).toEqual([]);
    expect(getFocusedReviewQueue([assignedCard('completed', 'completed')], 'active')).toEqual([]);
    expect(getFocusedReviewQueue([unassignedCard('active', 'active')], 'active')).toEqual([]);
    expect(getFocusedReviewQueue([unassignedCard('completed', 'completed')], 'completed')).toEqual(
      []
    );
  });
});

describe('v2 Focused Review component', () => {
  let container: HTMLDivElement;
  let root: Root;
  let onOpenLibrary: ReturnType<typeof vi.fn<() => void>>;
  let onOpenOriginalVideo: ReturnType<typeof vi.fn<(target: OpenOriginalVideoTarget) => void>>;

  beforeAll(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));

  beforeEach(() => {
    vi.mocked(chrome.i18n.getMessage).mockImplementation((key, substitutions) => {
      const values = Array.isArray(substitutions)
        ? substitutions
        : substitutions
          ? [substitutions]
          : [];
      return [key, ...values].join(':');
    });
    onOpenLibrary = vi.fn<() => void>();
    onOpenOriginalVideo = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  afterAll(() => vi.unstubAllGlobals());

  it('announces loading and recovers from a truthful load error', async () => {
    const card = assignedCard('retry');
    const harness = createStorageHarness([card]);
    let attempts = 0;
    harness.storage.get = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('Injected read failure');
      return [card];
    });

    act(() => render(harness.storage));
    expect(container.textContent).toContain('v2_review_loading');

    await act(async () => Promise.resolve());
    expect(container.querySelector("[role='alert']")?.textContent).toBe('v2_review_load_error');

    await act(async () => getButton(container, 'v2_review_retry').click());
    expect(container.textContent).toContain('Learning retry');
    expect(harness.storage.get).toHaveBeenCalledTimes(2);
  });

  it('shows distinct active and completed empty states and exposes Library navigation', async () => {
    const harness = createStorageHarness([unassignedCard('untouched', 'active')]);
    await renderReview(harness.storage);

    expect(container.textContent).toContain('v2_review_active_empty_title');
    expect(container.textContent).toContain('v2_review_active_empty_description');
    expect(container.textContent).not.toContain('Unassigned untouched');

    await act(async () => getButton(container, 'v2_review_completed_session').click());
    expect(container.textContent).toContain('v2_review_completed_empty_title');
    expect(container.textContent).toContain('v2_review_completed_empty_description');
    expect(harness.storage.get).toHaveBeenCalledTimes(2);

    act(() => getButton(container, 'v2_review_open_library').click());
    expect(onOpenLibrary).toHaveBeenCalledTimes(1);
    expect(harness.storage.update).not.toHaveBeenCalled();
  });

  it('reveals optional support, resets it on navigation, and exposes accurate progress and focus', async () => {
    const harness = createStorageHarness([
      assignedCard('first'),
      assignedCard('second'),
    ]);
    await renderReview(harness.storage);

    expect(container.textContent).toContain('Learning first');
    expect(container.textContent).not.toContain('Support first');
    expect(getButton(container, 'v2_review_previous').disabled).toBe(true);
    expect(container.querySelectorAll("[data-scroll-owner='focused-review']")).toHaveLength(1);

    const progress = getProgressbar(container);
    expect(progress.getAttribute('aria-label')).toBe('v2_review_progress:1:2');
    expect(progress.getAttribute('aria-valuemin')).toBe('1');
    expect(progress.getAttribute('aria-valuemax')).toBe('2');
    expect(progress.getAttribute('aria-valuenow')).toBe('1');
    expect(document.activeElement).toBe(getFocusedCard(container));

    const reveal = getButton(container, 'v2_review_show_support');
    expect(reveal.getAttribute('aria-expanded')).toBe('false');
    const supportRegion = document.getElementById(reveal.getAttribute('aria-controls') ?? '');
    expect(supportRegion).not.toBeNull();
    expect(supportRegion?.textContent).toBe('');
    expect(
      container.querySelector("[role='group'][aria-label='v2_review_navigation_label']")
    ).not.toBeNull();
    expect(
      container.querySelector("[role='group'][aria-label='v2_review_judgment_label']")
    ).not.toBeNull();
    act(() => reveal.click());
    expect(container.textContent).toContain('Support first');
    expect(supportRegion?.textContent).toContain('Support first');
    expect(getButton(container, 'v2_review_hide_support').getAttribute('aria-expanded')).toBe(
      'true'
    );

    act(() => getButton(container, 'v2_review_skip').click());
    expect(container.textContent).toContain('Learning second');
    expect(container.textContent).not.toContain('Support second');
    expect(getProgressbar(container).getAttribute('aria-valuenow')).toBe('2');
    expect(document.activeElement).toBe(getFocusedCard(container));

    act(() => getButton(container, 'v2_review_previous').click());
    expect(container.textContent).toContain('Learning first');
    expect(container.textContent).not.toContain('Support first');
    expect(harness.storage.update).not.toHaveBeenCalled();
  });

  it('finishes after a final Skip without writing and focuses the completion heading', async () => {
    const harness = createStorageHarness([assignedCard('only')]);
    await renderReview(harness.storage);

    act(() => getButton(container, 'v2_review_skip').click());

    const heading = getHeading(container, 'v2_review_finished_title');
    const library = getButton(container, 'v2_review_open_library');
    expect(container.textContent).toContain('v2_review_finished_description');
    expect(document.activeElement).toBe(heading);
    expect(heading.compareDocumentPosition(library) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(harness.storage.update).not.toHaveBeenCalled();

    act(() => library.click());
    expect(onOpenLibrary).toHaveBeenCalledTimes(1);
  });

  it('awaits a canonical update, replaces the snapshot card, and only then advances', async () => {
    const first = assignedCard('first');
    const second = assignedCard('second');
    const harness = createStorageHarness([first, second]);
    const deferred = createDeferred<LearningCard>();
    harness.storage.update = vi.fn(() => deferred.promise);
    await renderReview(harness.storage);

    await act(async () => {
      getButton(container, 'v2_review_complete').click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Learning first');
    expect(container.textContent).not.toContain('Learning second');
    expect(harness.storage.update).toHaveBeenCalledWith('card-first', {
      ...first,
      studyState: 'completed',
    });

    const returned = {
      ...first,
      content: {
        learning: { text: 'Learning first returned', language: 'en' as const },
        support: { text: 'Support first returned', language: 'ko' as const },
      },
      studyState: 'completed' as const,
    };
    await act(async () => {
      deferred.resolve(returned);
      await deferred.promise;
    });

    expect(container.textContent).toContain('Learning second');
    act(() => getButton(container, 'v2_review_previous').click());
    expect(container.textContent).toContain('Learning first returned');
    expect(container.textContent).toContain('v2_library_completed');
    expect(container.textContent).not.toContain('Support first returned');
  });

  it('persists same-state outcomes and supports both completed-card outcomes', async () => {
    const active = assignedCard('active');
    const completedFirst = assignedCard('completed-first', 'completed');
    const completedSecond = assignedCard('completed-second', 'completed');
    const harness = createStorageHarness([active, completedFirst, completedSecond]);
    await renderReview(harness.storage);

    await act(async () => getButton(container, 'v2_review_keep_learning').click());
    expect(harness.storage.update).toHaveBeenNthCalledWith(1, active.id, {
      ...active,
      studyState: 'active',
    });
    expect(container.textContent).toContain('v2_review_finished_title');

    await act(async () => getButton(container, 'v2_review_completed_session').click());
    expect(container.textContent).toContain('Learning completed-first');

    await act(async () => getButton(container, 'v2_review_keep_learning').click());
    expect(harness.storage.update).toHaveBeenNthCalledWith(2, completedFirst.id, {
      ...completedFirst,
      studyState: 'active',
    });
    expect(container.textContent).toContain('Learning completed-second');

    await act(async () => getButton(container, 'v2_review_complete').click());
    expect(harness.storage.update).toHaveBeenNthCalledWith(3, completedSecond.id, {
      ...completedSecond,
      studyState: 'completed',
    });
    expect(container.textContent).toContain('v2_review_finished_title');
  });

  it('locks every leaving or changing action and prevents duplicate writes while pending', async () => {
    const first = assignedCard('first');
    const second = assignedCard('second');
    const harness = createStorageHarness([first, second]);
    const deferred = createDeferred<LearningCard>();
    harness.storage.update = vi.fn(() => deferred.promise);
    await renderReview(harness.storage);

    await act(async () => {
      getButton(container, 'v2_review_complete').click();
      await Promise.resolve();
    });

    expect(getFocusedCard(container).getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector("[role='status']")?.textContent).toBe(
      'v2_review_save_pending'
    );
    for (const name of [
      'v2_review_active_session',
      'v2_review_completed_session',
      'v2_review_open_library',
      'v2_review_show_support',
      'v2_review_open_video',
      'v2_review_previous',
      'v2_review_skip',
      'v2_review_keep_learning',
      'v2_review_complete',
    ]) {
      expect(getButton(container, name).disabled, name).toBe(true);
    }

    act(() => {
      getButton(container, 'v2_review_complete').click();
      getButton(container, 'v2_review_open_video').click();
      getButton(container, 'v2_review_open_library').click();
    });
    expect(harness.storage.update).toHaveBeenCalledTimes(1);
    expect(onOpenOriginalVideo).not.toHaveBeenCalled();
    expect(onOpenLibrary).not.toHaveBeenCalled();

    await act(async () => {
      deferred.resolve({ ...first, studyState: 'completed' });
      await deferred.promise;
    });
    expect(container.textContent).toContain('Learning second');
  });

  it('preserves the card, revealed support, and initiating-button focus after a failed write', async () => {
    const card = assignedCard('failure');
    const harness = createStorageHarness([card]);
    harness.storage.update = vi.fn(async () => {
      throw new Error('Missing card');
    });
    await renderReview(harness.storage);

    act(() => getButton(container, 'v2_review_show_support').click());
    const complete = getButton(container, 'v2_review_complete');
    complete.focus();
    await act(async () => complete.click());

    expect(container.textContent).toContain('Learning failure');
    expect(container.textContent).toContain('Support failure');
    expect(container.textContent).not.toContain('v2_review_finished_title');
    expect(container.querySelector("[role='alert']")?.textContent).toBe(
      'v2_review_update_error'
    );
    expect(getFocusedCard(container).getAttribute('aria-busy')).toBe('false');
    expect(document.activeElement).toBe(complete);
  });

  it('ignores a late write success after a storage boundary starts a newer session', async () => {
    const oldCard = assignedCard('old');
    const oldHarness = createStorageHarness([oldCard]);
    const deferred = createDeferred<LearningCard>();
    oldHarness.storage.update = vi.fn(() => deferred.promise);
    await renderReview(oldHarness.storage);

    await act(async () => {
      getButton(container, 'v2_review_complete').click();
      await Promise.resolve();
    });

    const newHarness = createStorageHarness([assignedCard('new')]);
    await act(async () => {
      render(newHarness.storage);
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Learning new');

    await act(async () => {
      deferred.resolve({ ...oldCard, studyState: 'completed' });
      await deferred.promise;
    });
    expect(container.textContent).toContain('Learning new');
    expect(container.textContent).not.toContain('Learning old');
    expect(container.textContent).not.toContain('v2_review_finished_title');
  });

  it('ignores a late write rejection after a storage boundary starts a newer session', async () => {
    const oldHarness = createStorageHarness([assignedCard('old')]);
    const deferred = createRejectedDeferred<LearningCard>();
    oldHarness.storage.update = vi.fn(() => deferred.promise);
    await renderReview(oldHarness.storage);

    await act(async () => {
      getButton(container, 'v2_review_complete').click();
      await Promise.resolve();
    });

    const newHarness = createStorageHarness([assignedCard('new')]);
    await act(async () => {
      render(newHarness.storage);
      await Promise.resolve();
    });

    await act(async () => {
      deferred.reject(new Error('Late failure'));
      await deferred.promise.catch(() => undefined);
    });
    expect(container.textContent).toContain('Learning new');
    expect(container.querySelector("[role='alert']")).toBeNull();
  });

  it('opens only the exact immutable video target without writing card state', async () => {
    const card: LearningCard = {
      ...assignedCard('video'),
      content: { learning: { text: 'Learning video', language: 'en' } },
    };
    const harness = createStorageHarness([card]);
    await renderReview(harness.storage);

    expect(
      Array.from(container.querySelectorAll('button')).some((button) =>
        button.textContent?.includes('v2_review_show_support')
      )
    ).toBe(false);
    act(() => getButton(container, 'v2_review_open_video').click());

    expect(onOpenOriginalVideo).toHaveBeenCalledWith({
      url: card.source.url,
      startTime: card.source.startTime,
    });
    expect(Object.keys(onOpenOriginalVideo.mock.calls[0][0]).sort()).toEqual([
      'startTime',
      'url',
    ]);
    expect(harness.storage.update).not.toHaveBeenCalled();
  });

  it('refreshes the current session without remounting the focused card', async () => {
    const first = assignedCard('refresh-first');
    const second = assignedCard('refresh-second');
    const third = assignedCard('refresh-third');
    const storage: FocusedReviewStorage = {
      get: vi
        .fn<() => Promise<LearningCard[]>>()
        .mockResolvedValueOnce([first, second])
        .mockResolvedValueOnce([first, second, third]),
      update: vi.fn(),
    };
    await renderReview(storage, 0);
    act(() => getButton(container, 'v2_review_skip').click());
    act(() => getButton(container, 'v2_review_show_support').click());
    const article = getFocusedCard(container);
    expect(article.textContent).toContain('Support refresh-second');

    await act(async () => {
      render(storage, 1);
      await Promise.resolve();
    });

    expect(getFocusedCard(container)).toBe(article);
    expect(article.textContent).toContain('Learning refresh-second');
    expect(article.textContent).toContain('Support refresh-second');
    expect(getProgressbar(container).getAttribute('aria-valuemax')).toBe('3');
    expect(getProgressbar(container).getAttribute('aria-valuenow')).toBe('2');
  });

  function render(storage: FocusedReviewStorage, refreshRevision = 0) {
    root.render(
      <FocusedReview
        refreshRevision={refreshRevision}
        storage={storage}
        onOpenLibrary={onOpenLibrary}
        onOpenOriginalVideo={onOpenOriginalVideo}
      />
    );
  }

  async function renderReview(storage: FocusedReviewStorage, refreshRevision = 0) {
    await act(async () => {
      render(storage, refreshRevision);
      await Promise.resolve();
    });
  }
});

function assignedCard(
  suffix: string,
  studyState: LearningCard['studyState'] = 'active'
): LearningCard {
  return {
    id: `card-${suffix}`,
    content: {
      learning: { text: `Learning ${suffix}`, language: 'en' },
      support: { text: `Support ${suffix}`, language: 'ko' },
    },
    source: {
      url: `https://www.coupangplay.com/play/${suffix}`,
      startTime: 42,
      endTime: 48,
      title: `Title ${suffix}`,
    },
    studyState,
    createdAt: '2026-08-03T00:00:00.000Z',
  };
}

function unassignedCard(
  suffix: string,
  studyState: LearningCard['studyState']
): LearningCard {
  return {
    id: `card-${suffix}`,
    content: { unassigned: { text: `Unassigned ${suffix}`, language: 'und' } },
    source: { url: `https://www.coupangplay.com/play/${suffix}`, startTime: 21 },
    studyState,
    createdAt: '2026-08-03T00:00:00.000Z',
  };
}

function createStorageHarness(initialCards: LearningCard[]) {
  const cards = structuredClone(initialCards);
  const storage: FocusedReviewStorage = {
    get: vi.fn(async () => structuredClone(cards)),
    update: vi.fn(async (id, card) => {
      const index = cards.findIndex((current) => current.id === id);
      if (index < 0) throw new Error('Missing card');
      cards[index] = structuredClone(card);
      return structuredClone(card);
    }),
  };
  return { storage, state: () => structuredClone(cards) };
}

function getButton(scope: ParentNode, accessibleName: string) {
  const button = Array.from(scope.querySelectorAll('button')).find(
    (candidate) =>
      candidate.getAttribute('aria-label') === accessibleName ||
      candidate.textContent === accessibleName
  );
  if (!button) throw new Error(`Expected button: ${accessibleName}`);
  return button;
}

function getFocusedCard(container: HTMLElement) {
  const card = container.querySelector('article');
  if (!card) throw new Error('Expected focused Review card');
  return card;
}

function getHeading(container: HTMLElement, text: string) {
  const heading = Array.from(container.querySelectorAll('h2')).find(
    (candidate) => candidate.textContent === text
  );
  if (!heading) throw new Error(`Expected heading: ${text}`);
  return heading;
}

function getProgressbar(container: HTMLElement) {
  const progressbar = container.querySelector("[role='progressbar']");
  if (!progressbar) throw new Error('Expected Review progressbar');
  return progressbar;
}

function createDeferred<T>() {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

function createRejectedDeferred<T>() {
  let rejectPromise!: (reason?: unknown) => void;
  const promise = new Promise<T>((_, reject) => {
    rejectPromise = reject;
  });
  return { promise, reject: rejectPromise };
}
