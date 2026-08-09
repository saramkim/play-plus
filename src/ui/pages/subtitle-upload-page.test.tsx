import { act } from 'react';

import { SubtitleId } from '@storage/subtitle';
import { TabInfo } from '@storage/tab';
import type { V2LearningCardStorageApi } from '@storage/v2/learning-card-storage';
import {
  V2RegisteredSubtitleMetadata,
  V2UnavailableRegisteredSubtitle,
} from '@storage/v2/type';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SubtitleUploadPage as SubtitleUploadPageImpl } from './subtitle-upload-page';

const learningProfile = { learningLanguage: 'en', supportLanguage: 'ko' } as const;
const learningCardStorage = {} as V2LearningCardStorageApi;

function SubtitleUploadPage({ learningProfile: profile }: { learningProfile: typeof learningProfile }) {
  return (
    <SubtitleUploadPageImpl
      cardRevision={0}
      learningCardStorage={learningCardStorage}
      learningProfile={profile}
    />
  );
}
type MutationRollback = () => void | Promise<void>;
type MutationGuard = (
  id: SubtitleId
) => void | MutationRollback | Promise<void | MutationRollback>;

const testState = vi.hoisted(() => ({
  acquireNavigationLock: vi.fn(),
  legacyNavigationLocked: false,
  navigationLockTokens: new Set<symbol>(),
  navigationLocked: false,
  setNavigationLocked: vi.fn(),
  useAsSubtitle: vi.fn(async () => true),
  editSubtitle: vi.fn(async () => {}),
  updateDelay: vi.fn(async () => {}),
  deleteSubtitle: vi.fn(),
  reload: vi.fn(async () => {}),
  beforeDelete: undefined as MutationGuard | undefined,
  beforeLanguageChange: undefined as
    | ((id: SubtitleId, language: V2RegisteredSubtitleMetadata['language']) =>
        | void
        | MutationRollback
        | Promise<void | MutationRollback>)
    | undefined,
  subtitles: [] as V2RegisteredSubtitleMetadata[],
  unavailableSubtitles: [] as V2UnavailableRegisteredSubtitle[],
  activeTab: { id: 1, url: 'https://www.coupangplay.com/content/1' } as chrome.tabs.Tab | null,
  tabInfo: {
    connectionStatus: 'connected',
    videoStatus: 'detected',
  } as TabInfo | null,
  isAvailable: true,
  loading: false,
  loadError: false,
  pendingRoles: { learning: false, support: false },
}));

const existingSubtitle: V2RegisteredSubtitleMetadata = {
  id: 'subtitle-00000000-0000-0000-0000-000000000001',
  title: 'Existing subtitle',
  language: 'en',
  savedAt: '2026-08-01T00:00:00.000Z',
};

const addedSubtitle: V2RegisteredSubtitleMetadata = {
  id: 'subtitle-00000000-0000-0000-0000-000000000002',
  title: 'New subtitle',
  language: 'ko',
  savedAt: '2026-08-01T00:01:00.000Z',
};

vi.mock('@/ui/features/subtitle-upload/subtitle-adder', () => ({
  SubtitleAdder: ({
    initialSource,
    focusFirstControl,
    onAdded,
    onBusyChange,
  }: {
    initialSource: 'file' | 'online';
    focusFirstControl: boolean;
    onAdded: (subtitle: V2RegisteredSubtitleMetadata) => void;
    onBusyChange: (busy: boolean) => void;
  }) => (
    <section
      data-testid='subtitle-adder'
      data-source={initialSource}
      data-focus-first={String(focusFirstControl)}
    >
      <button onClick={() => onBusyChange(true)}>start-busy</button>
      <button
        onClick={() => {
          testState.subtitles = [...testState.subtitles, addedSubtitle];
          onAdded(addedSubtitle);
        }}
      >
        finish-add
      </button>
      <button onClick={() => onAdded(addedSubtitle)}>finish-add-without-storage</button>
    </section>
  ),
}));

vi.mock('@/ui/features/subtitle-overview/subtitle-overview', () => ({
  SubtitleOverview: ({
    learningProfile: profile,
    cardRevision,
    learningCardStorage: overviewStorage,
    onChangeSource,
    sourceTitles,
  }: {
    learningProfile: typeof learningProfile;
    cardRevision: number;
    learningCardStorage: V2LearningCardStorageApi;
    onChangeSource: (role: 'learning' | 'support') => void;
    sourceTitles: Record<string, string>;
  }) => (
    <section
      data-testid='subtitle-overview'
      data-learning-language={profile.learningLanguage}
      data-card-revision={cardRevision}
      data-storage-forwarded={String(overviewStorage === learningCardStorage)}
      data-support-language={profile.supportLanguage}
      data-source-title={sourceTitles[existingSubtitle.id]}
    >
      subtitle overview
      <button onClick={() => onChangeSource('learning')}>change-overview-source</button>
    </section>
  ),
}));

vi.mock('@/ui/features/subtitle-overview/registered-subtitle-preview', () => ({
  RegisteredSubtitlePreview: ({
    subtitleId,
    subtitle,
    onBack,
  }: {
    subtitleId: SubtitleId;
    subtitle: V2RegisteredSubtitleMetadata | undefined;
    onBack: () => void;
  }) => (
    <section
      data-testid='registered-subtitle-preview'
      data-subtitle-id={subtitleId}
      data-subtitle-title={subtitle?.title}
    >
      registered subtitle preview
      <button onClick={onBack}>preview-back</button>
    </section>
  ),
}));

vi.mock('@/ui/features/subtitle-upload/use-uploaded-subtitles', () => ({
  useUploadedSubtitles: (
    _activeTab: chrome.tabs.Tab | null,
    beforeDelete: MutationGuard,
    beforeLanguageChange: (
      id: SubtitleId,
      language: V2RegisteredSubtitleMetadata['language']
    ) => void | MutationRollback | Promise<void | MutationRollback>
  ) => {
    testState.beforeDelete = beforeDelete;
    testState.beforeLanguageChange = beforeLanguageChange;
    return {
      subtitles: testState.subtitles,
      unavailableSubtitles: testState.unavailableSubtitles,
      editSubtitle: testState.editSubtitle,
      updateDelay: testState.updateDelay,
      deleteSubtitle: testState.deleteSubtitle,
      loading: testState.loading,
      loadError: testState.loadError,
      reload: testState.reload,
    };
  },
}));

vi.mock('@/ui/features/subtitle/use-subtitle-settings', () => ({
  isSubtitleRoleLanguage: (
    role: 'learning' | 'support',
    language: string,
    profile: typeof learningProfile
  ) =>
    role === 'learning'
      ? language === profile.learningLanguage
      : language === profile.supportLanguage,
  useSubtitleSettings: () => ({
    useAsSubtitle: testState.useAsSubtitle,
    pendingRoles: testState.pendingRoles,
    isAvailable: testState.isAvailable,
    isRoleAvailable: (role: 'learning' | 'support', language: string) =>
      testState.isAvailable &&
      (role === 'learning'
        ? language === learningProfile.learningLanguage
        : language === learningProfile.supportLanguage),
  }),
}));

vi.mock('@/ui/store/page-store', () => ({
  usePageStore: (
    selector: (state: {
      acquireNavigationLock: () => () => void;
      navigationLocked: boolean;
      setNavigationLocked: (locked: boolean) => void;
    }) => unknown
  ) => selector({
    acquireNavigationLock: testState.acquireNavigationLock,
    navigationLocked: testState.navigationLocked,
    setNavigationLocked: testState.setNavigationLocked,
  }),
}));

vi.mock('@/ui/store/tab-store', () => ({
  useTabStore: (
    selector: (state: { activeTab: chrome.tabs.Tab | null; tabInfo: TabInfo | null }) => unknown
  ) => selector({ activeTab: testState.activeTab, tabInfo: testState.tabInfo }),
}));

describe('SubtitleUploadPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    testState.subtitles = [];
    testState.unavailableSubtitles = [];
    testState.activeTab = { id: 1, url: 'https://www.coupangplay.com/content/1' } as chrome.tabs.Tab;
    testState.tabInfo = { connectionStatus: 'connected', videoStatus: 'detected' };
    testState.isAvailable = true;
    testState.loading = false;
    testState.loadError = false;
    testState.pendingRoles = { learning: false, support: false };
    testState.legacyNavigationLocked = false;
    testState.navigationLockTokens.clear();
    testState.navigationLocked = false;
    testState.setNavigationLocked.mockImplementation((locked: boolean) => {
      testState.legacyNavigationLocked = locked;
      testState.navigationLocked = locked || testState.navigationLockTokens.size > 0;
    });
    testState.acquireNavigationLock.mockImplementation(() => {
      const token = Symbol('navigation-lock');
      testState.navigationLockTokens.add(token);
      testState.navigationLocked = true;

      let released = false;
      return () => {
        if (released) return;
        released = true;
        testState.navigationLockTokens.delete(token);
        testState.navigationLocked =
          testState.legacyNavigationLocked || testState.navigationLockTokens.size > 0;
      };
    });
    testState.beforeDelete = undefined;
    testState.beforeLanguageChange = undefined;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it('defaults to Add subtitles and keeps its draft mounted across subview changes', () => {
    act(() => root.render(<SubtitleUploadPage learningProfile={learningProfile} />));

    const addSubview = getButton(container, 'v2_subtitles_add_tab');
    const overviewSubview = getButton(container, 'v2_subtitles_overview_tab');
    expect(addSubview.getAttribute('aria-pressed')).toBe('true');
    expect(overviewSubview.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector("[data-testid='subtitle-overview']")).toBeNull();

    act(() => getButton(container, 'find_online').click());
    const draft = container.querySelector("[data-testid='subtitle-adder']");
    if (!draft) throw new Error('Expected the add-subtitle draft');

    act(() => overviewSubview.click());
    expect(addSubview.getAttribute('aria-pressed')).toBe('false');
    expect(overviewSubview.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector("[data-testid='subtitle-overview']")?.getAttribute('data-learning-language')).toBe('en');

    act(() => addSubview.click());
    expect(container.querySelector("[data-testid='subtitle-adder']")).toBe(draft);
  });

  it('disables both subviews and keeps the current selection while navigation is locked', () => {
    testState.navigationLocked = true;
    act(() => root.render(<SubtitleUploadPage learningProfile={learningProfile} />));

    const addSubview = getButton(container, 'v2_subtitles_add_tab');
    const overviewSubview = getButton(container, 'v2_subtitles_overview_tab');
    expect(addSubview.disabled).toBe(true);
    expect(overviewSubview.disabled).toBe(true);

    act(() => overviewSubview.click());
    expect(addSubview.getAttribute('aria-pressed')).toBe('true');
    expect(overviewSubview.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector("[data-testid='subtitle-overview']")).toBeNull();
  });

  it('locks Manage search, sorting, and Add while a subtitle mutation is pending', () => {
    testState.subtitles = [existingSubtitle];
    testState.navigationLocked = true;
    act(() => root.render(<SubtitleUploadPage learningProfile={learningProfile} />));

    const searchInput = container.querySelector<HTMLInputElement>("input[aria-label='search']");
    if (!searchInput) throw new Error('Expected the registered-subtitle search input');

    expect(searchInput.disabled).toBe(true);
    expect(getButton(container, 'search').disabled).toBe(true);
    expect(getButton(container, 'latest').disabled).toBe(true);
    expect(getButton(container, 'oldest').disabled).toBe(true);
    expect(getButton(container, 'v2_local_subtitles_add').disabled).toBe(true);
  });

  it('keeps fixed Manage regions around one compact list scroll owner', () => {
    testState.subtitles = [existingSubtitle, addedSubtitle];
    act(() => root.render(<SubtitleUploadPage learningProfile={learningProfile} />));

    const scrollOwners = container.querySelectorAll("[data-scroll-owner='local-subtitles']");
    expect(scrollOwners).toHaveLength(1);

    const scrollOwner = scrollOwners[0];
    const listMode = scrollOwner.parentElement;
    const roleSummary = container.querySelector("[aria-labelledby='current-tab-subtitles-heading']");
    const listHeader = container.querySelector("input[aria-label='search']")?.closest('header');
    const headerWrapper = listHeader?.parentElement;
    const footer = getButton(container, 'v2_local_subtitles_add').closest('footer');
    const list = scrollOwner.querySelector('ul');
    if (!listMode || !roleSummary || !listHeader || !headerWrapper || !footer || !list) {
      throw new Error('Expected the complete Manage list structure');
    }

    expect(Array.from(listMode.children)).toEqual([
      roleSummary,
      headerWrapper,
      scrollOwner,
      footer,
    ]);
    expect(listMode.classList.contains('p-3')).toBe(true);
    expect(headerWrapper.classList.contains('pt-1.5')).toBe(true);
    expect(scrollOwner.classList.contains('px-1')).toBe(true);
    expect(scrollOwner.classList.contains('py-1.5')).toBe(true);
    expect(list.classList.contains('gap-2')).toBe(true);
    expect(footer.classList.contains('pt-2')).toBe(true);
  });

  it('keeps the role summary mounted while an explicit search shows one matching card', () => {
    testState.subtitles = [existingSubtitle, addedSubtitle];
    act(() => root.render(<SubtitleUploadPage learningProfile={learningProfile} />));

    const searchInput = container.querySelector<HTMLInputElement>("input[aria-label='search']");
    if (!searchInput) throw new Error('Expected the registered-subtitle search input');

    act(() => {
      setInputValue(searchInput, 'Existing');
      getButton(container, 'search').click();
    });

    const cards = container.querySelectorAll("[data-scroll-owner='local-subtitles'] li");
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain(existingSubtitle.title);
    expect(cards[0].textContent).not.toContain(addedSubtitle.title);
    expect(container.querySelectorAll('[data-subtitle-role]')).toHaveLength(2);
    expect(container.querySelectorAll("[data-scroll-owner='local-subtitles']")).toHaveLength(1);
    expect(getButton(container, 'clear_search')).toBeDefined();
  });

  it('shows a recoverable no-results state and truly clears the registered-subtitle search', () => {
    testState.subtitles = [existingSubtitle, addedSubtitle];
    act(() => root.render(<SubtitleUploadPage learningProfile={learningProfile} />));

    const searchInput = container.querySelector<HTMLInputElement>("input[aria-label='search']");
    if (!searchInput) throw new Error('Expected the registered-subtitle search input');
    act(() => getButton(container, 'oldest').click());
    act(() => {
      setInputValue(searchInput, 'missing subtitle');
      getButton(container, 'search').click();
    });

    expect(container.querySelector("[role='status']")?.textContent).toBe('no_search_results');
    expect(container.querySelectorAll('li')).toHaveLength(0);
    expect(container.querySelectorAll("[data-scroll-owner='local-subtitles']")).toHaveLength(1);

    const clearButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'clear_search'
    );
    if (!clearButton) throw new Error('Expected the no-results Clear search action');
    act(() => clearButton.click());

    expect(searchInput.value).toBe('');
    expect(document.activeElement).toBe(searchInput);
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(getButton(container, 'oldest').getAttribute('aria-pressed')).toBe('true');
  });

  it('does not persist the selected subview across page mounts', () => {
    act(() => root.render(<SubtitleUploadPage learningProfile={learningProfile} />));
    act(() => getButton(container, 'v2_subtitles_overview_tab').click());
    expect(container.querySelector("[data-testid='subtitle-overview']")).not.toBeNull();

    act(() => root.unmount());
    root = createRoot(container);
    act(() => root.render(<SubtitleUploadPage learningProfile={learningProfile} />));

    expect(getButton(container, 'v2_subtitles_add_tab').getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector("[data-testid='subtitle-overview']")).toBeNull();
  });

  it('passes registered source titles and returns Change to the existing role manager', () => {
    testState.subtitles = [existingSubtitle];
    testState.tabInfo = {
      connectionStatus: 'connected',
      videoStatus: 'detected',
      learningSubtitleId: existingSubtitle.id,
    };
    act(() => root.render(<SubtitleUploadPage learningProfile={learningProfile} />));
    act(() => getButton(container, 'v2_subtitles_overview_tab').click());

    const overview = container.querySelector<HTMLElement>("[data-testid='subtitle-overview']");
    expect(overview?.dataset.sourceTitle).toBe(existingSubtitle.title);

    act(() => getButton(container, 'change-overview-source').click());

    expect(container.querySelector("[data-testid='subtitle-overview']")).toBeNull();
    expect(getButton(container, 'v2_subtitles_add_tab').getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement?.getAttribute('data-subtitle-role')).toBe('learning');
  });

  it('keeps Change focus intent until the role manager finishes loading', () => {
    testState.loading = true;
    testState.tabInfo = {
      connectionStatus: 'connected',
      videoStatus: 'detected',
      learningSubtitleId: existingSubtitle.id,
    };
    act(() => root.render(<SubtitleUploadPage learningProfile={learningProfile} />));
    act(() => getButton(container, 'v2_subtitles_overview_tab').click());

    act(() => getButton(container, 'change-overview-source').click());
    expect(container.textContent).toContain('v2_local_subtitles_loading');
    expect(document.activeElement?.getAttribute('data-subtitle-role')).toBeNull();

    testState.loading = false;
    testState.subtitles = [existingSubtitle];
    act(() => root.render(<SubtitleUploadPage learningProfile={learningProfile} />));

    expect(document.activeElement?.getAttribute('data-subtitle-role')).toBe('learning');
  });

  it('opens either explicit add source and restores focus after Back', () => {
    act(() => root.render(<SubtitleUploadPage learningProfile={learningProfile} />));

    expect(findButton(container, 'analyze')).toBeUndefined();
    expect(container.querySelectorAll("[data-scroll-owner='local-subtitles']")).toHaveLength(1);

    const onlineButton = getButton(container, 'find_online');
    act(() => onlineButton.click());

    expect(container.querySelector("[data-testid='subtitle-adder']")?.getAttribute('data-source')).toBe('online');
    expect(container.querySelector("[data-testid='subtitle-adder']")?.getAttribute('data-focus-first')).toBe('true');
    expect(container.querySelectorAll("[data-scroll-owner='local-subtitles']")).toHaveLength(1);

    act(() => getButton(container, 'v2_local_subtitles_back').click());
    expect(document.activeElement).toBe(getButton(container, 'find_online'));

    act(() => getButton(container, 'add_from_file').click());
    expect(container.querySelector("[data-testid='subtitle-adder']")?.getAttribute('data-source')).toBe('file');
  });

  it('focuses the add heading from the list and locks navigation while busy', () => {
    testState.subtitles = [existingSubtitle];
    act(() => root.render(<SubtitleUploadPage learningProfile={learningProfile} />));

    act(() => getButton(container, 'v2_local_subtitles_add').click());
    expect(document.activeElement).toBe(container.querySelector('h2'));

    act(() => getButton(container, 'start-busy').click());
    expect(getButton(container, 'v2_local_subtitles_back').disabled).toBe(true);
    expect(getButton(container, 'v2_subtitles_add_tab').disabled).toBe(true);
    expect(getButton(container, 'v2_subtitles_overview_tab').disabled).toBe(true);
    expect(testState.setNavigationLocked).toHaveBeenLastCalledWith(true);
  });

  it('keeps subviews locked until concurrent edit and sync operations settle', async () => {
    const editDeferred = createDeferred<void>();
    const syncDeferred = createDeferred<void>();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    testState.subtitles = [existingSubtitle, addedSubtitle];
    testState.editSubtitle.mockImplementationOnce(() => editDeferred.promise);
    testState.updateDelay.mockImplementationOnce(() => syncDeferred.promise);
    act(() => root.render(<SubtitleUploadPage learningProfile={learningProfile} />));

    const cards = Array.from(container.querySelectorAll('li'));
    const editCard = cards.find((card) => card.textContent?.includes(existingSubtitle.title));
    const syncCard = cards.find((card) => card.textContent?.includes(addedSubtitle.title));
    if (!editCard || !syncCard) throw new Error('Expected edit and sync subtitle cards');

    act(() => {
      getButton(editCard, 'v2_local_subtitles_edit_details').click();
      getButton(syncCard, 'v2_local_subtitles_sync').click();
    });
    act(() => {
      getButton(editCard, 'save').click();
      getButton(syncCard, 'save').click();
    });
    act(() => root.render(<SubtitleUploadPage learningProfile={learningProfile} />));

    const addSubview = getButton(container, 'v2_subtitles_add_tab');
    const overviewSubview = getButton(container, 'v2_subtitles_overview_tab');
    expect(testState.acquireNavigationLock).toHaveBeenCalledTimes(2);
    expect(testState.navigationLockTokens.size).toBe(2);
    expect(addSubview.disabled).toBe(true);
    expect(overviewSubview.disabled).toBe(true);
    act(() => overviewSubview.click());
    expect(addSubview.getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      editDeferred.resolve();
      await editDeferred.promise;
      await Promise.resolve();
    });
    expect(testState.navigationLockTokens.size).toBe(1);
    expect(getButton(container, 'v2_subtitles_overview_tab').disabled).toBe(true);

    await act(async () => {
      syncDeferred.reject(new Error('Injected sync failure'));
      await syncDeferred.promise.catch(() => undefined);
      await Promise.resolve();
    });
    act(() => root.render(<SubtitleUploadPage learningProfile={learningProfile} />));
    expect(testState.navigationLockTokens.size).toBe(0);
    expect(getButton(container, 'v2_subtitles_add_tab').disabled).toBe(false);
    expect(getButton(container, 'v2_subtitles_overview_tab').disabled).toBe(false);
    consoleError.mockRestore();
  });

  it('creates one navigation token for a duplicate Edit submit and supports retry after failure', async () => {
    const editDeferred = createDeferred<void>();
    testState.subtitles = [existingSubtitle];
    testState.editSubtitle.mockImplementationOnce(() => editDeferred.promise).mockResolvedValueOnce(undefined);
    act(() => root.render(<SubtitleUploadPage learningProfile={learningProfile} />));

    const card = container.querySelector('li');
    if (!card) throw new Error('Expected the registered-subtitle card');
    act(() => getButton(card, 'v2_local_subtitles_edit_details').click());

    const initialSave = getButton(card, 'save');
    act(() => {
      initialSave.click();
      initialSave.click();
    });

    expect(testState.editSubtitle).toHaveBeenCalledOnce();
    expect(testState.acquireNavigationLock).toHaveBeenCalledOnce();
    expect(testState.navigationLockTokens.size).toBe(1);
    expect(card.querySelector('form')?.getAttribute('aria-busy')).toBe('true');
    expect(getButton(card, 'saving').disabled).toBe(true);

    await act(async () => {
      editDeferred.reject(new Error('Injected edit failure'));
      await editDeferred.promise.catch(() => undefined);
      await Promise.resolve();
    });

    expect(testState.navigationLockTokens.size).toBe(0);
    expect(card.querySelector("[role='alert']")?.textContent).toBe('error_try_later');
    expect(document.activeElement).toBe(getButton(card, 'save'));

    await act(async () => {
      getButton(card, 'save').click();
      await Promise.resolve();
    });

    expect(testState.editSubtitle).toHaveBeenCalledTimes(2);
    expect(testState.acquireNavigationLock).toHaveBeenCalledTimes(2);
    expect(testState.navigationLockTokens.size).toBe(0);
    expect(document.activeElement).toBe(getButton(card, 'v2_local_subtitles_edit_details'));
  });

  it('returns to the list and focuses a newly added subtitle', () => {
    testState.subtitles = [existingSubtitle];
    act(() => root.render(<SubtitleUploadPage learningProfile={learningProfile} />));

    act(() => getButton(container, 'v2_local_subtitles_add').click());
    act(() => getButton(container, 'finish-add').click());

    const addedItem = Array.from(container.querySelectorAll('li')).find((item) =>
      item.textContent?.includes(addedSubtitle.title)
    );
    expect(document.activeElement).toBe(addedItem);
    expect(addedItem?.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('uses canonical role names and returns a selected role to the default track', async () => {
    testState.subtitles = [existingSubtitle];
    testState.tabInfo = {
      connectionStatus: 'connected',
      videoStatus: 'detected',
      learningSubtitleId: existingSubtitle.id,
    };
    act(() => root.render(<SubtitleUploadPage learningProfile={learningProfile} />));

    const learningRow = container.querySelector("[data-subtitle-role='learning']");
    expect(learningRow?.textContent).toContain('learning_subtitle');
    expect(container.querySelector("[data-subtitle-role='primary']")).toBeNull();

    await act(async () =>
      getButton(container, 'learning_subtitle: v2_local_subtitles_default_short').click()
    );
    expect(testState.useAsSubtitle).toHaveBeenCalledWith({
      role: 'learning',
      subtitleId: null,
      previousSubtitleId: existingSubtitle.id,
    });
    expect(document.activeElement).toBe(learningRow);
  });

  it('enables role selection only when the registered subtitle language matches', () => {
    testState.subtitles = [existingSubtitle, addedSubtitle];
    act(() => root.render(<SubtitleUploadPage learningProfile={learningProfile} />));

    const cards = Array.from(container.querySelectorAll('li'));
    const englishCard = cards.find((card) => card.textContent?.includes(existingSubtitle.title));
    const koreanCard = cards.find((card) => card.textContent?.includes(addedSubtitle.title));
    if (!englishCard || !koreanCard) throw new Error('Expected both local subtitle cards');

    expect(getButton(englishCard, 'learning_subtitle').disabled).toBe(false);
    expect(getButton(englishCard, 'support_subtitle').disabled).toBe(true);
    expect(getButton(koreanCard, 'learning_subtitle').disabled).toBe(true);
    expect(getButton(koreanCard, 'support_subtitle').disabled).toBe(false);
  });

  it('previews any registered subtitle without assigning a role and restores focus on Back', () => {
    testState.subtitles = [existingSubtitle];
    testState.activeTab = null;
    testState.tabInfo = null;
    testState.isAvailable = false;
    act(() => root.render(<SubtitleUploadPage learningProfile={learningProfile} />));

    const previewButton = getButton(container, 'v2_local_subtitles_preview');
    act(() => previewButton.click());

    const preview = container.querySelector<HTMLElement>(
      "[data-testid='registered-subtitle-preview']"
    );
    expect(preview?.dataset.subtitleId).toBe(existingSubtitle.id);
    expect(preview?.dataset.subtitleTitle).toBe(existingSubtitle.title);
    expect(testState.useAsSubtitle).not.toHaveBeenCalled();

    act(() => getButton(container, 'preview-back').click());
    expect(document.activeElement).toBe(previewButton);

    act(() => previewButton.click());
    act(() => getButton(container, 'v2_subtitles_overview_tab').click());
    expect(container.querySelector("[data-testid='subtitle-overview']")).not.toBeNull();
    expect(container.querySelector("[data-testid='registered-subtitle-preview']")).toBeNull();
  });

  it('clears every selected canonical role before deletion and provides rollback', async () => {
    testState.subtitles = [existingSubtitle];
    testState.tabInfo = {
      connectionStatus: 'connected',
      videoStatus: 'detected',
      learningSubtitleId: existingSubtitle.id,
      supportSubtitleId: existingSubtitle.id,
    };
    act(() => root.render(<SubtitleUploadPage learningProfile={learningProfile} />));

    let rollback: void | MutationRollback;
    await act(async () => {
      rollback = await testState.beforeDelete?.(existingSubtitle.id);
    });

    expect(testState.useAsSubtitle).toHaveBeenNthCalledWith(1, {
      role: 'learning',
      subtitleId: null,
      previousSubtitleId: existingSubtitle.id,
    });
    expect(testState.useAsSubtitle).toHaveBeenNthCalledWith(2, {
      role: 'support',
      subtitleId: null,
      previousSubtitleId: existingSubtitle.id,
    });

    await act(async () => rollback?.());
    expect(testState.useAsSubtitle).toHaveBeenNthCalledWith(3, {
      role: 'support',
      subtitleId: existingSubtitle.id,
      previousSubtitleId: null,
    });
    expect(testState.useAsSubtitle).toHaveBeenNthCalledWith(4, {
      role: 'learning',
      subtitleId: existingSubtitle.id,
      previousSubtitleId: null,
    });
  });

  it('clears only selected roles that become invalid after a language edit', async () => {
    testState.subtitles = [existingSubtitle];
    testState.tabInfo = {
      connectionStatus: 'connected',
      videoStatus: 'detected',
      learningSubtitleId: existingSubtitle.id,
      supportSubtitleId: existingSubtitle.id,
    };
    act(() => root.render(<SubtitleUploadPage learningProfile={learningProfile} />));

    await act(async () => testState.beforeLanguageChange?.(existingSubtitle.id, 'ko'));

    expect(testState.useAsSubtitle).toHaveBeenCalledOnce();
    expect(testState.useAsSubtitle).toHaveBeenCalledWith({
      role: 'learning',
      subtitleId: null,
      previousSubtitleId: existingSubtitle.id,
    });
  });

  it('shows unavailable migrated entries only as generic reason counts', () => {
    testState.unavailableSubtitles = [
      {
        reason: 'invalid-metadata',
        originalIndex: 0,
        rawMetadata: { title: 'private subtitle text' },
      },
      { reason: 'missing-body', originalIndex: 1 },
    ];
    act(() => root.render(<SubtitleUploadPage learningProfile={learningProfile} />));

    const notice = container.querySelector("[data-testid='unavailable-migrated-subtitles']");
    expect(notice?.textContent).toContain('v2_local_subtitles_unavailable_title');
    expect(notice?.textContent).toContain('v2_local_subtitles_unavailable_invalid_metadata: 1');
    expect(notice?.textContent).toContain('v2_local_subtitles_unavailable_missing_body: 1');
    expect(notice?.textContent).not.toContain('private subtitle text');
    expect(notice?.querySelector('button')).toBeNull();
    expect(container.querySelectorAll('button')).toHaveLength(4);
    expect(getButton(container, 'add_from_file')).toBeDefined();
    expect(getButton(container, 'find_online')).toBeDefined();
  });

  it('shows a retryable error instead of silently replacing invalid local state', async () => {
    testState.loadError = true;
    act(() => root.render(<SubtitleUploadPage learningProfile={learningProfile} />));

    expect(container.querySelector('[role=alert]')?.textContent).toContain(
      'v2_local_subtitles_load_error'
    );
    await act(async () => getButton(container, 'v2_retry').click());
    expect(testState.reload).toHaveBeenCalledOnce();
  });
});

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

function getButton(container: HTMLElement, accessibleName: string) {
  const button = findButton(container, accessibleName);
  if (!button) throw new Error(`Expected button: ${accessibleName}`);
  return button;
}

function findButton(container: HTMLElement, accessibleName: string) {
  return Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.getAttribute('aria-label') === accessibleName || candidate.textContent === accessibleName
  );
}

function setInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
