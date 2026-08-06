import { act } from 'react';

import { SubtitleId } from '@storage/subtitle';
import { TabInfo } from '@storage/tab';
import {
  V2RegisteredSubtitleMetadata,
  V2UnavailableRegisteredSubtitle,
} from '@storage/v2/type';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SubtitleUploadPage } from './subtitle-upload-page';

const learningProfile = { learningLanguage: 'en', supportLanguage: 'ko' } as const;
type MutationRollback = () => void | Promise<void>;
type MutationGuard = (
  id: SubtitleId
) => void | MutationRollback | Promise<void | MutationRollback>;

const testState = vi.hoisted(() => ({
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
      loading: false,
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
    selector: (state: { setNavigationLocked: (locked: boolean) => void }) => unknown
  ) => selector({ setNavigationLocked: testState.setNavigationLocked }),
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
    testState.loadError = false;
    testState.pendingRoles = { learning: false, support: false };
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
    expect(testState.setNavigationLocked).toHaveBeenLastCalledWith(true);
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
    expect(container.querySelectorAll('button')).toHaveLength(2);
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
