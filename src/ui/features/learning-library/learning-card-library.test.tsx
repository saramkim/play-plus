import { act } from 'react';

import {
  DeletedLearningCard,
  V2LearningCardStorageApi,
} from '@storage/v2/learning-card-storage';
import { LearningCard } from '@storage/v2/type';
import { createRoot, Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getVisibleLearningCards,
  LearningCardLibrary,
  LearningCardLibraryQuery,
} from './learning-card-library';

describe('v2 learning card Library selectors', () => {
  it('searches every canonical sentence and composes study-state and role filters', () => {
    const learning = assignedCard('learning', 'active', '2026-08-02T00:00:00.000Z');
    const completed = assignedCard('completed', 'completed', '2026-08-01T00:00:00.000Z');
    const unassigned = unassignedCard('legacy', 'completed', '2026-08-03T00:00:00.000Z');
    const cards = [learning, completed, unassigned];

    expect(select(cards, { searchText: 'SUPPORT LEARNING' })).toEqual([learning]);
    expect(select(cards, { searchText: 'unassigned LEGACY' })).toEqual([unassigned]);
    expect(select(cards, { role: 'support', studyState: 'completed' })).toEqual([completed]);
    expect(select(cards, { role: 'learning', studyState: 'active' })).toEqual([learning]);
    expect(select(cards, { role: 'unassigned' })).toEqual([unassigned]);
  });

  it('sorts stably for equal timestamps without mutating storage order', () => {
    const first = assignedCard('first', 'active', '2026-08-02T00:00:00.000Z');
    const second = assignedCard('second', 'active', '2026-08-02T00:00:00.000Z');
    const newest = assignedCard('newest', 'active', '2026-08-03T00:00:00.000Z');
    const cards = [first, second, newest];

    expect(select(cards)).toEqual([newest, first, second]);
    expect(select(cards, { sort: 'oldest' })).toEqual([first, second, newest]);
    expect(cards).toEqual([first, second, newest]);
  });
});

describe('v2 learning card Library component', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));

  beforeEach(() => {
    vi.mocked(chrome.i18n.getMessage).mockImplementation((key) => key);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  afterAll(() => vi.unstubAllGlobals());

  it('announces loading while the strict storage read is pending', async () => {
    const harness = createStorageHarness([]);
    const deferred = createDeferred<LearningCard[]>();
    harness.storage.get = vi.fn(() => deferred.promise);

    act(() => root.render(<LearningCardLibrary storage={harness.storage} />));
    expect(container.textContent).toContain('v2_library_loading');

    await act(async () => deferred.resolve([]));
    expect(container.textContent).toContain('v2_library_empty_title');
  });

  it('shows loading, recoverable load failure, retry, and true empty states', async () => {
    const harness = createStorageHarness([]);
    harness.storage.get = vi
      .fn<() => Promise<LearningCard[]>>()
      .mockRejectedValueOnce(new Error('Injected read failure'))
      .mockResolvedValueOnce([]);

    await renderLibrary(root, harness.storage);

    expect(container.textContent).toContain('v2_library_load_error');
    await act(async () => getButton(container, 'v2_library_retry').click());
    expect(container.textContent).toContain('v2_library_empty_title');
    expect(container.textContent).toContain('v2_library_empty_description');
    expect(harness.storage.get).toHaveBeenCalledTimes(2);
  });

  it('renders canonical roles and labels with one scroll owner and no legacy vocabulary', async () => {
    const harness = createStorageHarness([
      assignedCard('assigned'),
      unassignedCard('legacy'),
    ]);

    await renderLibrary(root, harness.storage);

    expect(container.textContent).toContain('Learning assigned');
    expect(container.textContent).toContain('Support assigned');
    expect(container.textContent).toContain('Unassigned legacy');
    expect(container.textContent).toContain('v2_library_learning');
    expect(container.textContent).toContain('v2_library_support');
    expect(container.textContent).toContain('v2_library_unassigned');
    expect(container.textContent).not.toContain('primary');
    expect(container.textContent).not.toContain('secondary');
    expect(container.querySelectorAll("[data-scroll-owner='learning-library']")).toHaveLength(1);
    expect(container.querySelector("[aria-label='v2_library_search_label']")).not.toBeNull();
    expect(container.querySelector("[aria-label='v2_library_state_filter']")).not.toBeNull();
    expect(container.querySelector("[aria-label='v2_library_role_filter']")).not.toBeNull();
    expect(container.querySelector("[aria-label='v2_library_sort_label']")).not.toBeNull();
  });

  it('preserves and clears composed search, sort, state, and role controls', async () => {
    const harness = createStorageHarness([
      assignedCard('active'),
      assignedCard('completed', 'completed'),
      unassignedCard('legacy', 'completed'),
    ]);
    await renderLibrary(root, harness.storage);

    changeInput(getInput(container, 'v2_library_search_label'), 'support');
    changeSelect(getSelect(container, 'v2_library_state_filter'), 'completed');
    changeSelect(getSelect(container, 'v2_library_role_filter'), 'unassigned');
    changeSelect(getSelect(container, 'v2_library_sort_label'), 'oldest');

    expect(container.textContent).toContain('v2_library_filtered_empty');
    act(() => getButton(container, 'clear_filters').click());

    expect(getInput(container, 'v2_library_search_label').value).toBe('');
    expect(getSelect(container, 'v2_library_state_filter').value).toBe('all');
    expect(getSelect(container, 'v2_library_role_filter').value).toBe('all');
    expect(getSelect(container, 'v2_library_sort_label').value).toBe('latest');
    expect(container.textContent).toContain('Learning active');
    expect(container.textContent).toContain('Unassigned legacy');
  });

  it('awaits a direct state change, disables duplicate mutations, and restores focus', async () => {
    const card = assignedCard('pending');
    const harness = createStorageHarness([card]);
    const deferred = createDeferred<LearningCard>();
    harness.storage.update = vi.fn(() => deferred.promise);
    await renderLibrary(root, harness.storage);
    const stateSelect = getCard(container, 'Learning pending').querySelector<HTMLSelectElement>(
      "select[aria-label='v2_library_state_change']"
    );
    if (!stateSelect) throw new Error('Expected state select');

    await act(async () => {
      stateSelect.value = 'completed';
      stateSelect.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    expect(harness.storage.update).toHaveBeenCalledWith(card.id, {
      ...card,
      studyState: 'completed',
    });
    expect(getCard(container, 'Learning pending').getAttribute('aria-busy')).toBe('true');
    expect(Array.from(container.querySelectorAll('button, select')).every((control) => {
      if (control.getAttribute('aria-label')?.includes('filter')) return true;
      if (control.getAttribute('aria-label')?.includes('sort')) return true;
      return !(control instanceof HTMLButtonElement || control instanceof HTMLSelectElement) || control.disabled;
    })).toBe(true);
    expect(container.textContent).toContain('v2_library_save_pending');

    await act(async () => deferred.resolve({ ...card, studyState: 'completed' }));

    expect(stateSelect.value).toBe('completed');
    expect(document.activeElement).toBe(stateSelect);
  });

  it('keeps persisted state unchanged and reports a recoverable direct-update failure', async () => {
    const card = assignedCard('failure');
    const harness = createStorageHarness([card]);
    harness.storage.update = vi.fn(async () => {
      throw new Error('Injected update failure');
    });
    await renderLibrary(root, harness.storage);
    const stateSelect = getCard(container, 'Learning failure').querySelector<HTMLSelectElement>(
      "select[aria-label='v2_library_state_change']"
    );
    if (!stateSelect) throw new Error('Expected state select');

    await act(async () => changeSelect(stateSelect, 'completed'));

    expect(stateSelect.value).toBe('active');
    expect(container.textContent).toContain('v2_library_update_error');
  });

  it('converts an unassigned card only after explicit language selection', async () => {
    const card = unassignedCard('convert');
    const harness = createStorageHarness([card]);
    await renderLibrary(root, harness.storage);
    act(() => getButton(getCard(container, 'Unassigned convert'), 'edit').click());

    const learningText = getTextarea(container, `${card.id}-learning-text`);
    const learningLanguage = getSelectById(container, `${card.id}-learning-language`);
    expect(learningText.value).toBe('Unassigned convert');
    expect(learningLanguage.value).toBe('');

    await act(async () => submitEditor(container));
    expect(harness.storage.update).not.toHaveBeenCalled();
    expect(container.textContent).toContain('v2_library_editor_invalid');

    changeSelect(learningLanguage, 'en');
    await act(async () => submitEditor(container));

    expect(harness.storage.update).toHaveBeenCalledWith(card.id, {
      ...card,
      content: { learning: { text: 'Unassigned convert', language: 'en' } },
    });
    expect(container.querySelector(`#${card.id}-learning-text`)).toBeNull();
    expect(document.activeElement?.textContent).toBe('edit');
  });

  it('keeps an editor draft and focus context after a failed save', async () => {
    const card = assignedCard('draft');
    const harness = createStorageHarness([card]);
    harness.storage.update = vi.fn(async () => {
      throw new Error('Injected update failure');
    });
    await renderLibrary(root, harness.storage);
    act(() => getButton(getCard(container, 'Learning draft'), 'edit').click());
    const text = getTextarea(container, `${card.id}-learning-text`);
    changeInput(text, 'My unsaved draft');

    await act(async () => submitEditor(container));

    expect(text.value).toBe('My unsaved draft');
    expect(container.textContent).toContain('v2_library_update_error');
    expect(container.querySelector(`#${card.id}-learning-text`)).toBe(text);
  });

  it('locks every editor and query control while a rejected save preserves its draft', async () => {
    const editingCard = assignedCard('locked-draft');
    const otherCard = assignedCard('other');
    const harness = createStorageHarness([editingCard, otherCard]);
    const deferred = createRejectedDeferred<LearningCard>();
    harness.storage.update = vi.fn(() => deferred.promise);
    await renderLibrary(root, harness.storage);
    act(() => getButton(getCard(container, 'Learning locked-draft'), 'edit').click());
    const text = getTextarea(container, `${editingCard.id}-learning-text`);
    changeInput(text, 'Draft that must stay mounted');

    await act(async () => {
      submitEditor(container);
      await Promise.resolve();
    });

    const search = getInput(container, 'v2_library_search_label');
    const stateFilter = getSelect(container, 'v2_library_state_filter');
    expect(text.matches(':disabled')).toBe(true);
    expect(search.disabled).toBe(true);
    expect(stateFilter.disabled).toBe(true);
    expect(getButton(getCard(container, 'Learning other'), 'edit').disabled).toBe(true);

    changeInput(search, 'no matching cards');
    changeSelect(stateFilter, 'completed');
    expect(container.querySelector(`#${editingCard.id}-learning-text`)).toBe(text);

    await act(async () => deferred.reject(new Error('Injected update failure')));

    expect(search.value).toBe('');
    expect(stateFilter.value).toBe('all');
    expect(text.matches(':disabled')).toBe(false);
    expect(text.value).toBe('Draft that must stay mounted');
    expect(container.textContent).toContain('v2_library_update_error');
    expect(container.querySelector(`#${editingCard.id}-learning-text`)).toBe(text);
  });

  it('supports role swapping, support removal, and cancel focus restoration in the editor', async () => {
    const card = assignedCard('roles');
    const harness = createStorageHarness([card]);
    await renderLibrary(root, harness.storage);
    const article = getCard(container, 'Learning roles');
    act(() => getButton(article, 'edit').click());

    expect(document.activeElement?.textContent).toBe('v2_library_editor_title');
    const learningText = getTextarea(container, `${card.id}-learning-text`);
    const supportText = getTextarea(container, `${card.id}-support-text`);
    act(() => getButton(container, 'v2_library_swap_roles').click());
    expect(learningText.value).toBe('Support roles');
    expect(supportText.value).toBe('Learning roles');

    act(() => getButton(container, 'v2_library_remove_support').click());
    expect(container.querySelector(`#${card.id}-support-text`)).toBeNull();
    act(() => getButton(container, 'v2_library_add_support').click());
    expect(getTextarea(container, `${card.id}-support-text`).value).toBe('Learning roles');

    act(() => getButton(container, 'cancel').click());
    expect(container.querySelector(`#${card.id}-learning-text`)).toBeNull();
    expect(document.activeElement?.textContent).toBe('edit');
  });

  it('keeps filter state and focuses the Library heading when a status change removes a card', async () => {
    const card = assignedCard('filtered');
    const harness = createStorageHarness([card]);
    await renderLibrary(root, harness.storage);
    changeSelect(getSelect(container, 'v2_library_state_filter'), 'active');
    const stateSelect = getCard(container, 'Learning filtered').querySelector<HTMLSelectElement>(
      "select[aria-label='v2_library_state_change']"
    );
    if (!stateSelect) throw new Error('Expected state select');

    await act(async () => changeSelect(stateSelect, 'completed'));

    expect(container.textContent).toContain('v2_library_filtered_empty');
    expect(getSelect(container, 'v2_library_state_filter').value).toBe('active');
    expect(document.activeElement?.id).toBe('v2-learning-library-title');
  });

  it('deletes one card and undo restores its storage position and originating focus', async () => {
    const first = assignedCard('first');
    const middle = assignedCard('middle');
    const last = assignedCard('last');
    const harness = createStorageHarness([first, middle, last]);
    await renderLibrary(root, harness.storage);
    act(() => getButton(getCard(container, 'Learning middle'), 'delete').click());
    await act(async () => Promise.resolve());

    expect(harness.state()).toEqual([first, last]);
    expect(container.textContent).not.toContain('Learning middle');
    const undo = getButton(container, 'v2_library_restore');
    expect(document.activeElement).toBe(undo);

    await act(async () => undo.click());

    expect(harness.state()).toEqual([first, middle, last]);
    const restoredDelete = getButton(getCard(container, 'Learning middle'), 'delete');
    expect(document.activeElement).toBe(restoredDelete);
  });

  it('reports delete and undo failures without losing the current recovery state', async () => {
    const card = assignedCard('delete-failure');
    const harness = createStorageHarness([card]);
    harness.storage.delete = vi.fn(async () => {
      throw new Error('Injected delete failure');
    });
    await renderLibrary(root, harness.storage);

    await act(async () => getButton(getCard(container, 'Learning delete-failure'), 'delete').click());
    expect(container.textContent).toContain('v2_library_delete_error');
    expect(container.textContent).toContain('Learning delete-failure');

    harness.storage.delete = vi.fn(async () => {
      harness.state().splice(0, 1);
      return { card, index: 0 };
    });
    await act(async () => getButton(getCard(container, 'Learning delete-failure'), 'delete').click());
    harness.storage.restore = vi.fn(async () => {
      throw new Error('Injected restore failure');
    });
    await act(async () => getButton(container, 'v2_library_restore').click());

    expect(container.textContent).toContain('v2_library_restore_error');
    expect(container.textContent).toContain('v2_library_deleted');
    expect(container.textContent).not.toContain('Learning delete-failure');
  });

  it('refreshes canonical cards without remounting query, focus, or undo state', async () => {
    const first = assignedCard('refresh-first');
    const deleted = assignedCard('refresh-deleted');
    const harness = createStorageHarness([first, deleted]);
    await act(async () => {
      root.render(<LearningCardLibrary refreshRevision={0} storage={harness.storage} />);
      await Promise.resolve();
    });
    const search = getInput(container, 'v2_library_search_label');
    changeInput(search, 'Learning');
    search.focus();

    await act(async () =>
      getButton(getCard(container, 'Learning refresh-deleted'), 'delete').click()
    );
    const undo = getButton(container, 'v2_library_restore');

    await act(async () => {
      root.render(<LearningCardLibrary refreshRevision={1} storage={harness.storage} />);
      await Promise.resolve();
    });

    expect(getInput(container, 'v2_library_search_label')).toBe(search);
    expect(search.value).toBe('Learning');
    expect(getButton(container, 'v2_library_restore')).toBe(undo);
    expect(harness.storage.get).toHaveBeenCalledTimes(2);
  });
});

const DEFAULT_QUERY: LearningCardLibraryQuery = {
  role: 'all',
  searchText: '',
  sort: 'latest',
  studyState: 'all',
};

const select = (cards: LearningCard[], override: Partial<LearningCardLibraryQuery> = {}) =>
  getVisibleLearningCards(cards, { ...DEFAULT_QUERY, ...override });

const assignedCard = (
  suffix: string,
  studyState: LearningCard['studyState'] = 'active',
  createdAt = '2026-08-02T00:00:00.000Z'
): LearningCard => ({
  id: `card-${suffix}`,
  content: {
    learning: { text: `Learning ${suffix}`, language: 'en' },
    support: { text: `Support ${suffix}`, language: 'ko' },
  },
  source: {
    url: `https://www.coupangplay.com/play/${suffix}`,
    startTime: 10,
    endTime: 12,
    title: `Title ${suffix}`,
  },
  studyState,
  createdAt,
});

const unassignedCard = (
  suffix: string,
  studyState: LearningCard['studyState'] = 'completed',
  createdAt = '2026-08-03T00:00:00.000Z'
): LearningCard => ({
  id: `card-${suffix}`,
  content: { unassigned: { text: `Unassigned ${suffix}`, language: 'und' } },
  source: { url: `https://www.coupangplay.com/play/${suffix}`, startTime: 20 },
  studyState,
  createdAt,
});

function createStorageHarness(initialCards: LearningCard[]) {
  const cards = structuredClone(initialCards);
  const storage: V2LearningCardStorageApi = {
    get: vi.fn(async () => structuredClone(cards)),
    add: vi.fn(async (card) => {
      cards.push(structuredClone(card));
      return structuredClone(card);
    }),
    update: vi.fn(async (id, card) => {
      const index = cards.findIndex((current) => current.id === id);
      if (index < 0) throw new Error('Missing card');
      cards[index] = structuredClone(card);
      return structuredClone(card);
    }),
    delete: vi.fn(async (id) => {
      const index = cards.findIndex((card) => card.id === id);
      if (index < 0) throw new Error('Missing card');
      const [card] = cards.splice(index, 1);
      return structuredClone({ card, index });
    }),
    restore: vi.fn(async (deletion: DeletedLearningCard) => {
      cards.splice(Math.min(deletion.index, cards.length), 0, structuredClone(deletion.card));
      return structuredClone(deletion.card);
    }),
  };
  return { storage, state: () => structuredClone(cards) };
}

async function renderLibrary(root: Root, storage: V2LearningCardStorageApi) {
  await act(async () => {
    root.render(<LearningCardLibrary storage={storage} />);
    await Promise.resolve();
  });
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

function getCard(container: HTMLElement, text: string) {
  const article = Array.from(container.querySelectorAll('article')).find((candidate) =>
    candidate.textContent?.includes(text)
  );
  if (!article) throw new Error(`Expected card containing: ${text}`);
  return article;
}

function getInput(container: HTMLElement, accessibleName: string) {
  const input = container.querySelector<HTMLInputElement>(`input[aria-label='${accessibleName}']`);
  if (!input) throw new Error(`Expected input: ${accessibleName}`);
  return input;
}

function getTextarea(container: HTMLElement, id: string) {
  const textarea = container.querySelector<HTMLTextAreaElement>(`#${id}`);
  if (!textarea) throw new Error(`Expected textarea: ${id}`);
  return textarea;
}

function getSelect(container: HTMLElement, accessibleName: string) {
  const select = container.querySelector<HTMLSelectElement>(`select[aria-label='${accessibleName}']`);
  if (!select) throw new Error(`Expected select: ${accessibleName}`);
  return select;
}

function getSelectById(container: HTMLElement, id: string) {
  const select = container.querySelector<HTMLSelectElement>(`#${id}`);
  if (!select) throw new Error(`Expected select: ${id}`);
  return select;
}

function changeInput(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  act(() => {
    const prototype =
      input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (!setter) throw new Error('Expected native value setter');
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function changeSelect(select: HTMLSelectElement, value: string) {
  act(() => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function submitEditor(container: HTMLElement) {
  const form = container.querySelector('form');
  if (!form) throw new Error('Expected editor form');
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
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
