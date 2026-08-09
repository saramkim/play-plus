import { act } from 'react';

import {
  DeletedLearningCard,
  V2LearningCardStorageApi,
} from '@storage/v2/learning-card-storage';
import { LearningCard } from '@storage/v2/type';
import { createRoot, Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Header } from '@/ui/layout/header';
import { usePageStore } from '@/ui/store/page-store';

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
    usePageStore.setState({
      currentPage: 'learning',
      navigationLockTokens: new Set(),
      navigationLocked: false,
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    usePageStore.setState({
      currentPage: 'learning',
      navigationLockTokens: new Set(),
      navigationLocked: false,
    });
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

  it('keeps a stable compact header while Clear resets every query dimension and focuses search', async () => {
    const harness = createStorageHarness([
      assignedCard('active'),
      assignedCard('completed', 'completed'),
      unassignedCard('legacy', 'completed'),
    ]);
    await renderLibrary(root, harness.storage);

    const section = container.querySelector<HTMLElement>(
      "section[aria-labelledby='v2-learning-library-title']"
    );
    const header = section?.querySelector<HTMLElement>('header');
    const search = getInput(container, 'v2_library_search_label');
    const clear = getButton(container, 'clear_filters');
    if (!section || !header) throw new Error('Expected compact Library shell');

    expect(Array.from(section.classList)).toEqual(expect.arrayContaining(['px-3', 'py-3']));
    expect(Array.from(header.classList)).toEqual(expect.arrayContaining(['gap-2', 'pb-2']));
    expect(search.parentElement).toBe(clear.parentElement);
    expect(clear.classList.contains('size-8')).toBe(true);
    expect(clear.getAttribute('aria-label')).toBe('clear_filters');
    expect(clear.hasAttribute('title')).toBe(false);
    expect(clear.disabled).toBe(true);

    const expectReset = () => {
      expect(getButton(container, 'clear_filters')).toBe(clear);
      expect(clear.disabled).toBe(false);
      act(() => clear.click());
      expect(getInput(container, 'v2_library_search_label').value).toBe('');
      expect(getSelect(container, 'v2_library_sort_label').value).toBe('latest');
      expect(getSelect(container, 'v2_library_state_filter').value).toBe('all');
      expect(getSelect(container, 'v2_library_role_filter').value).toBe('all');
      expect(document.activeElement).toBe(search);
      expect(clear.disabled).toBe(true);
    };

    changeInput(search, 'support');
    expectReset();
    changeSelect(getSelect(container, 'v2_library_sort_label'), 'oldest');
    expectReset();
    changeSelect(getSelect(container, 'v2_library_state_filter'), 'completed');
    expectReset();
    changeSelect(getSelect(container, 'v2_library_role_filter'), 'unassigned');
    expectReset();
  });

  it('uses compact feature-local card spacing without changing the scroll owner', async () => {
    const harness = createStorageHarness([assignedCard('spacing')]);
    await renderLibrary(root, harness.storage);

    const scrollOwner = container.querySelector("[data-scroll-owner='learning-library']");
    const listItem = scrollOwner?.querySelector('li');
    const article = listItem?.querySelector('article');
    if (!scrollOwner || !listItem || !article) throw new Error('Expected populated Library card');

    expect(container.querySelectorAll("[data-scroll-owner='learning-library']")).toHaveLength(1);
    expect(listItem.classList.contains('py-2')).toBe(true);
    expect(article.classList.contains('gap-2')).toBe(true);
  });

  it('preserves and clears composed search, sort, state, and role controls', async () => {
    const harness = createStorageHarness([
      assignedCard('active'),
      assignedCard('completed', 'completed'),
      unassignedCard('legacy', 'completed'),
    ]);
    await renderLibrary(root, harness.storage);

    const search = getInput(container, 'v2_library_search_label');
    changeInput(search, 'support');
    changeSelect(getSelect(container, 'v2_library_state_filter'), 'completed');
    changeSelect(getSelect(container, 'v2_library_role_filter'), 'unassigned');
    changeSelect(getSelect(container, 'v2_library_sort_label'), 'oldest');

    expect(container.textContent).toContain('v2_library_filtered_empty');
    const filteredEmptyClear = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'clear_filters'
    );
    if (!filteredEmptyClear) throw new Error('Expected filtered-empty Clear action');
    act(() => filteredEmptyClear.click());

    expect(search.value).toBe('');
    expect(getSelect(container, 'v2_library_state_filter').value).toBe('all');
    expect(getSelect(container, 'v2_library_role_filter').value).toBe('all');
    expect(getSelect(container, 'v2_library_sort_label').value).toBe('latest');
    expect(container.textContent).toContain('Learning active');
    expect(container.textContent).toContain('Unassigned legacy');
    expect(document.activeElement).toBe(search);
  });

  it('awaits a direct state change, disables duplicate mutations, and restores focus', async () => {
    const card = assignedCard('pending');
    const harness = createStorageHarness([card]);
    const deferred = createDeferred<LearningCard>();
    harness.storage.update = vi.fn(() => deferred.promise);
    await renderLibrary(root, harness.storage);
    changeSelect(getSelect(container, 'v2_library_sort_label'), 'oldest');
    const clear = getButton(container, 'clear_filters');
    expect(clear.disabled).toBe(false);
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
    expect(usePageStore.getState().navigationLocked).toBe(true);
    expect(clear.disabled).toBe(true);
    expect(Array.from(container.querySelectorAll('button, select')).every((control) => {
      if (control.getAttribute('aria-label')?.includes('filter')) return true;
      if (control.getAttribute('aria-label')?.includes('sort')) return true;
      return !(control instanceof HTMLButtonElement || control instanceof HTMLSelectElement) || control.disabled;
    })).toBe(true);
    expect(container.textContent).toContain('v2_library_save_pending');

    await act(async () => deferred.resolve({ ...card, studyState: 'completed' }));

    expect(stateSelect.value).toBe('completed');
    expect(document.activeElement).toBe(stateSelect);
    expect(usePageStore.getState().navigationLocked).toBe(false);
    expect(clear.disabled).toBe(false);
  });

  it('keeps filtered-empty Clear locked when an external refresh intersects a mutation', async () => {
    const card = assignedCard('refresh-pending');
    const completed = { ...card, studyState: 'completed' as const };
    const harness = createStorageHarness([card]);
    const deferred = createDeferred<LearningCard>();
    harness.storage.update = vi.fn(() => deferred.promise);
    await act(async () => {
      root.render(<LearningCardLibrary refreshRevision={0} storage={harness.storage} />);
      await Promise.resolve();
    });
    const search = getInput(container, 'v2_library_search_label');
    changeSelect(getSelect(container, 'v2_library_state_filter'), 'active');
    const stateSelect = getCard(container, 'Learning refresh-pending').querySelector<HTMLSelectElement>(
      "select[aria-label='v2_library_state_change']"
    );
    if (!stateSelect) throw new Error('Expected state select');

    await act(async () => {
      changeSelect(stateSelect, 'completed');
      await Promise.resolve();
    });
    harness.storage.get = vi.fn(async () => [completed]);
    await act(async () => {
      root.render(<LearningCardLibrary refreshRevision={1} storage={harness.storage} />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain('v2_library_filtered_empty');
    const filteredEmptyClear = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'clear_filters'
    );
    if (!filteredEmptyClear) throw new Error('Expected filtered-empty Clear action');
    expect(filteredEmptyClear.disabled).toBe(true);
    act(() => filteredEmptyClear.click());
    expect(getSelect(container, 'v2_library_state_filter').value).toBe('active');

    await act(async () => deferred.resolve(completed));
    expect(filteredEmptyClear.disabled).toBe(false);
    act(() => filteredEmptyClear.click());
    expect(getSelect(container, 'v2_library_state_filter').value).toBe('all');
    expect(document.activeElement).toBe(search);
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

  it('renders the editor first without duplicate visible content and keeps provenance below once', async () => {
    const card = assignedCard('edit-layout');
    const harness = createStorageHarness([card]);
    await renderLibrary(root, harness.storage);
    const article = getCard(container, 'Learning edit-layout');

    expect(
      Array.from(article.querySelectorAll('p')).filter(
        (paragraph) => paragraph.textContent === 'Learning edit-layout'
      )
    ).toHaveLength(1);
    expect(
      Array.from(article.querySelectorAll('p')).filter(
        (paragraph) => paragraph.textContent === 'Support edit-layout'
      )
    ).toHaveLength(1);

    act(() => getButton(article, 'edit').click());

    const editedArticle = getCard(container, 'Learning edit-layout');
    const accessibleHeading = editedArticle.querySelector('h2.sr-only');
    const visibleChildren = Array.from(editedArticle.children).filter(
      (element) => !element.classList.contains('sr-only')
    );
    expect(accessibleHeading?.id).toBe(`${card.id}-library-card-title`);
    expect(editedArticle.getAttribute('aria-labelledby')).toBe(accessibleHeading?.id);
    expect(visibleChildren[0]?.tagName).toBe('FORM');
    expect(visibleChildren[1]?.tagName).toBe('DL');
    expect(editedArticle.querySelectorAll('dl')).toHaveLength(1);
    expect(
      Array.from(editedArticle.querySelectorAll('dt')).filter(
        (term) => term.textContent === 'v2_library_source'
      )
    ).toHaveLength(1);
    expect(
      Array.from(editedArticle.querySelectorAll('p')).filter(
        (paragraph) =>
          paragraph.textContent === 'Learning edit-layout' ||
          paragraph.textContent === 'Support edit-layout'
      )
    ).toHaveLength(0);
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
    usePageStore.setState({ currentPage: 'library' });
    await act(async () => {
      root.render(
        <>
          <Header />
          <LearningCardLibrary storage={harness.storage} />
        </>
      );
      await Promise.resolve();
    });
    act(() => getButton(getCard(container, 'Learning locked-draft'), 'edit').click());
    const text = getTextarea(container, `${editingCard.id}-learning-text`);
    changeInput(text, 'Draft that must stay mounted');
    text.focus();

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
    expect(getNavigationButtons(container).every((button) => button.disabled)).toBe(true);
    expect(usePageStore.getState().navigationLocked).toBe(true);

    act(() => usePageStore.getState().setPage('review'));
    expect(usePageStore.getState().currentPage).toBe('library');
    expect(document.activeElement).toBe(text);

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
    expect(document.activeElement).toBe(text);
    expect(usePageStore.getState().navigationLocked).toBe(false);
    expect(getNavigationButtons(container).every((button) => !button.disabled)).toBe(true);
  });

  it('releases its navigation lock when an in-flight mutation is unmounted', async () => {
    const card = assignedCard('unmount-pending');
    const harness = createStorageHarness([card]);
    const deferred = createDeferred<DeletedLearningCard>();
    harness.storage.delete = vi.fn(() => deferred.promise);
    await renderLibrary(root, harness.storage);

    await act(async () => {
      getButton(getCard(container, 'Learning unmount-pending'), 'delete').click();
      await Promise.resolve();
    });
    expect(usePageStore.getState().navigationLocked).toBe(true);

    act(() => root.render(<Header />));
    expect(usePageStore.getState().navigationLocked).toBe(false);
    expect(getNavigationButtons(container).every((button) => !button.disabled)).toBe(true);

    await act(async () => deferred.resolve({ card, index: 0 }));
    expect(usePageStore.getState().navigationLocked).toBe(false);
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
    const deleteDeferred = createDeferred<void>();
    const deleteCard = harness.storage.delete;
    harness.storage.delete = vi.fn(async (id) => {
      await deleteDeferred.promise;
      return deleteCard(id);
    });
    await renderLibrary(root, harness.storage);
    await act(async () => {
      getButton(getCard(container, 'Learning middle'), 'delete').click();
      await Promise.resolve();
    });

    expect(usePageStore.getState().navigationLocked).toBe(true);
    await act(async () => deleteDeferred.resolve(undefined));

    expect(harness.state()).toEqual([first, last]);
    expect(container.textContent).not.toContain('Learning middle');
    expect(usePageStore.getState().navigationLocked).toBe(false);
    const undo = getButton(container, 'v2_library_restore');
    expect(document.activeElement).toBe(undo);

    const restoreDeferred = createDeferred<void>();
    const restoreCard = harness.storage.restore;
    harness.storage.restore = vi.fn(async (deletion) => {
      await restoreDeferred.promise;
      return restoreCard(deletion);
    });
    await act(async () => {
      undo.click();
      await Promise.resolve();
    });

    expect(usePageStore.getState().navigationLocked).toBe(true);
    await act(async () => restoreDeferred.resolve(undefined));

    expect(harness.state()).toEqual([first, middle, last]);
    expect(usePageStore.getState().navigationLocked).toBe(false);
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

  it('refreshes added canonical cards without resetting the active editor, query, or focus', async () => {
    const current = assignedCard('refresh-current');
    const added = assignedCard('refresh-added', 'active', '2026-08-03T00:00:00.000Z');
    const harness = createStorageHarness([current]);
    await act(async () => {
      root.render(<LearningCardLibrary refreshRevision={0} storage={harness.storage} />);
      await Promise.resolve();
    });
    const search = getInput(container, 'v2_library_search_label');
    changeInput(search, 'Learning');
    act(() => getButton(getCard(container, 'Learning refresh-current'), 'edit').click());
    const text = getTextarea(container, `${current.id}-learning-text`);
    changeInput(text, 'Unsaved text that survives refresh');
    text.focus();

    await act(async () => harness.storage.add(added));

    await act(async () => {
      root.render(<LearningCardLibrary refreshRevision={1} storage={harness.storage} />);
      await Promise.resolve();
    });

    expect(getInput(container, 'v2_library_search_label')).toBe(search);
    expect(search.value).toBe('Learning');
    expect(getTextarea(container, `${current.id}-learning-text`)).toBe(text);
    expect(text.value).toBe('Unsaved text that survives refresh');
    expect(document.activeElement).toBe(text);
    expect(container.textContent).toContain('Learning refresh-added');
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

function getNavigationButtons(container: HTMLElement) {
  const navigation = container.querySelector('nav');
  if (!navigation) throw new Error('Expected page navigation');
  return Array.from(navigation.querySelectorAll('button'));
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
