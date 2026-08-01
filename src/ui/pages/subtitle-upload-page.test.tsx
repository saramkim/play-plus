import { act } from 'react';

import { TabInfo } from '@storage/tab';
import { SubtitleMetadata } from '@storage/type';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SubtitleUploadPage } from './subtitle-upload-page';

const testState = vi.hoisted(() => ({
  setNavigationLocked: vi.fn(),
  setPage: vi.fn(),
  useAsSubtitle: vi.fn(async () => true),
  editSubtitle: vi.fn(async () => {}),
  updateDelay: vi.fn(async () => {}),
  deleteSubtitle: vi.fn(),
  subtitles: [] as SubtitleMetadata[],
  activeTab: { id: 1, url: 'https://www.coupangplay.com/content/1' } as chrome.tabs.Tab | null,
  tabInfo: {
    connectionStatus: 'connected',
    videoStatus: 'detected',
  } as TabInfo | null,
  isAvailable: true,
  primaryEnabled: true,
  secondaryEnabled: true,
  pendingRoles: { primary: false, secondary: false },
}));

const existingSubtitle = {
  id: 'subtitle-00000000-0000-0000-0000-000000000001',
  title: 'Existing subtitle',
  language: 'en',
  savedAt: '2026-08-01T00:00:00.000Z',
} as SubtitleMetadata;

const addedSubtitle = {
  id: 'subtitle-00000000-0000-0000-0000-000000000002',
  title: 'New subtitle',
  language: 'ko',
  savedAt: '2026-08-01T00:01:00.000Z',
} as SubtitleMetadata;

vi.mock('@/ui/features/subtitle-upload/subtitle-adder', () => ({
  SubtitleAdder: ({
    initialSource,
    onAdded,
    onBusyChange,
  }: {
    initialSource: 'file' | 'online';
    onAdded: (subtitle: SubtitleMetadata) => void;
    onBusyChange: (busy: boolean) => void;
  }) => (
    <section data-testid='subtitle-adder' data-source={initialSource}>
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
  useUploadedSubtitles: () => ({
    subtitles: testState.subtitles,
    editSubtitle: testState.editSubtitle,
    updateDelay: testState.updateDelay,
    deleteSubtitle: testState.deleteSubtitle,
    loading: false,
  }),
}));

vi.mock('@/ui/features/subtitle/use-subtitle-settings', () => ({
  useSubtitleSettings: () => ({
    useAsSubtitle: testState.useAsSubtitle,
    pendingRoles: testState.pendingRoles,
    isAvailable: testState.isAvailable,
  }),
}));

vi.mock('@/ui/store/config-store', () => ({
  useConfigStore: (selector: (state: { configs: Record<string, unknown> }) => unknown) =>
    selector({
      configs: {
        primarySubtitle: { enabled: testState.primaryEnabled, language: 'en' },
        secondarySubtitle: { enabled: testState.secondaryEnabled, language: 'ko' },
      },
    }),
}));

vi.mock('@/ui/store/page-store', () => ({
  usePageStore: (selector: (state: { setNavigationLocked: (locked: boolean) => void; setPage: () => void }) => unknown) =>
    selector({ setNavigationLocked: testState.setNavigationLocked, setPage: testState.setPage }),
}));

vi.mock('@/ui/store/tab-store', () => ({
  useTabStore: (selector: (state: { activeTab: chrome.tabs.Tab | null; tabInfo: TabInfo | null }) => unknown) =>
    selector({ activeTab: testState.activeTab, tabInfo: testState.tabInfo }),
}));

describe('SubtitleUploadPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    testState.subtitles = [];
    testState.activeTab = { id: 1, url: 'https://www.coupangplay.com/content/1' } as chrome.tabs.Tab;
    testState.tabInfo = { connectionStatus: 'connected', videoStatus: 'detected' };
    testState.isAvailable = true;
    testState.primaryEnabled = true;
    testState.secondaryEnabled = true;
    testState.pendingRoles = { primary: false, secondary: false };
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

  it('opens the requested empty-state source and restores focus after Back', () => {
    act(() => root.render(<SubtitleUploadPage />));

    const onlineButton = getButton(container, 'find_online');
    act(() => onlineButton.click());

    expect(container.querySelector("[data-testid='subtitle-adder']")?.getAttribute('data-source')).toBe('online');

    act(() => getButton(container, 'back_to_subtitles').click());

    expect(document.activeElement).toBe(getButton(container, 'find_online'));
  });

  it('focuses the add heading from the list and locks Back while busy', () => {
    testState.subtitles = [existingSubtitle];
    act(() => root.render(<SubtitleUploadPage />));

    act(() => getButton(container, 'subtitle_upload').click());

    expect(document.activeElement).toBe(container.querySelector('h2'));

    act(() => getButton(container, 'start-busy').click());

    expect(getButton(container, 'back_to_subtitles').disabled).toBe(true);
    expect(testState.setNavigationLocked).toHaveBeenLastCalledWith(true);
  });

  it('returns to the list and focuses the newly added subtitle', () => {
    testState.subtitles = [existingSubtitle];
    act(() => root.render(<SubtitleUploadPage />));

    act(() => getButton(container, 'subtitle_upload').click());
    act(() => getButton(container, 'finish-add').click());

    const addedItem = Array.from(container.querySelectorAll('li')).find((item) =>
      item.textContent?.includes(addedSubtitle.title)
    );
    expect(addedItem).toBeDefined();
    expect(document.activeElement).toBe(addedItem);
    expect(addedItem?.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('uses a stable list focus when the stored subtitle update is delayed', () => {
    vi.useFakeTimers();
    testState.subtitles = [existingSubtitle];
    act(() => root.render(<SubtitleUploadPage />));

    act(() => getButton(container, 'subtitle_upload').click());
    act(() => getButton(container, 'finish-add-without-storage').click());
    act(() => vi.advanceTimersByTime(1500));

    expect(document.activeElement).toBe(getButton(container, 'subtitle_upload'));
  });

  it('shows explicit role state and returns a selected role to the default track', async () => {
    testState.subtitles = [existingSubtitle];
    testState.tabInfo = {
      connectionStatus: 'connected',
      videoStatus: 'detected',
      primarySubtitle: existingSubtitle.id,
      secondarySubtitle: existingSubtitle.id,
    };
    act(() => root.render(<SubtitleUploadPage />));

    expect(container.textContent).toContain('current_tab_subtitles');
    expect(container.textContent).toContain('primary_selected');
    expect(container.textContent).toContain('secondary_selected');
    expect(getButton(container, 'return_primary_to_default').getAttribute('aria-pressed')).toBeNull();
    expect(getButton(container, 'return_secondary_to_default').getAttribute('aria-pressed')).toBeNull();

    const primaryRoleRow = container.querySelector("[data-subtitle-role='primary']");
    if (!(primaryRoleRow instanceof HTMLElement)) throw new Error('Expected primary role row');

    await act(async () => getButton(container, 'return_primary_to_default').click());

    expect(testState.useAsSubtitle).toHaveBeenCalledWith({
      role: 'primary',
      subtitleId: null,
      delay: 0,
      previousSubtitleId: existingSubtitle.id,
      previousDelay: 0,
    });
    expect(document.activeElement).toBe(primaryRoleRow);
  });

  it('keeps the Default action focused when returning to the default track fails', async () => {
    testState.subtitles = [existingSubtitle];
    testState.tabInfo = {
      connectionStatus: 'connected',
      videoStatus: 'detected',
      primarySubtitle: existingSubtitle.id,
    };
    testState.useAsSubtitle.mockResolvedValueOnce(false);
    act(() => root.render(<SubtitleUploadPage />));

    const defaultButton = getButton(container, 'return_primary_to_default');
    defaultButton.focus();
    await act(async () => defaultButton.click());

    expect(document.activeElement).toBe(defaultButton);
    expect(findButton(container, 'return_primary_to_default')).toBe(defaultButton);
  });

  it('keeps the current-tab summary independent from list search', () => {
    testState.subtitles = [existingSubtitle, addedSubtitle];
    testState.tabInfo = {
      connectionStatus: 'connected',
      videoStatus: 'detected',
      primarySubtitle: addedSubtitle.id,
    };
    act(() => root.render(<SubtitleUploadPage />));

    const input = container.querySelector('header input');
    if (!(input instanceof HTMLInputElement)) throw new Error('Expected search input');
    act(() => {
      input.value = existingSubtitle.title;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.closest('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    const summary = container.querySelector("[aria-labelledby='current-tab-subtitles-heading']");
    expect(summary?.textContent).toContain(addedSubtitle.title);
    expect(container.querySelectorAll('li')).toHaveLength(1);
  });

  it('separates display-off and unavailable states from role selection', () => {
    testState.subtitles = [existingSubtitle];
    testState.primaryEnabled = false;
    testState.isAvailable = false;
    testState.activeTab = null;
    testState.tabInfo = null;
    act(() => root.render(<SubtitleUploadPage />));

    expect(container.textContent).toContain('display_off');
    expect(container.textContent).toContain('subtitle_role_unavailable');
    expect(getButton(container, 'use_as_primary').matches(':disabled')).toBe(true);
    expect(getButton(container, 'use_as_secondary').matches(':disabled')).toBe(true);
  });

  it('keeps pending state scoped to one role and exposes missing selections', () => {
    testState.subtitles = [existingSubtitle];
    testState.tabInfo = {
      connectionStatus: 'connected',
      videoStatus: 'detected',
      primarySubtitle: addedSubtitle.id,
    };
    testState.pendingRoles = { primary: true, secondary: false };
    act(() => root.render(<SubtitleUploadPage />));

    expect(container.textContent).toContain('selected_subtitle_missing');
    expect(getButton(container, 'use_as_primary').disabled).toBe(true);
    expect(getButton(container, 'use_as_secondary').disabled).toBe(false);
    expect(getButton(container, 'use_as_primary').getAttribute('aria-pressed')).toBe('false');
  });

  it('renders current-tab status as a compact tray above search', () => {
    testState.subtitles = [existingSubtitle];
    act(() => root.render(<SubtitleUploadPage />));

    const summary = container.querySelector("[aria-labelledby='current-tab-subtitles-heading']");
    const searchHeader = container.querySelector('header:has(input)');
    if (!summary || !searchHeader) throw new Error('Expected summary and search header');

    expect(summary.className).toContain('bg-muted/40');
    expect(summary.className).not.toContain('border');
    expect(summary.className).not.toContain('rounded');
    expect(summary.className).not.toContain('shadow');
    expect(summary.compareDocumentPosition(searchHeader) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(summary.querySelector('h2')?.className).toContain('sr-only');
    expect(findButton(container, 'subtitle_setting')).toBeUndefined();
    expect(summary.querySelector('dl')?.className).toContain('divide-y');
    const primaryRole = summary.querySelector("[data-subtitle-role='primary']");
    expect(primaryRole?.className).toContain('grid-cols-[auto_minmax(0,1fr)]');
    expect(primaryRole?.querySelector('dd')?.className).toContain('grid-cols-[minmax(0,1fr)_auto]');
  });

  it('uses compact action rows and expands Edit when Delete is unavailable', () => {
    testState.subtitles = [existingSubtitle];
    act(() => root.render(<SubtitleUploadPage />));

    const editButton = getButton(container, 'edit_subtitle_details');
    const deleteButton = getButton(container, 'delete');
    expect(editButton.parentElement).toBe(deleteButton.parentElement);
    expect(container.querySelector(`#subtitle-title-${existingSubtitle.id}`)?.className).toContain('line-clamp-2');

    testState.tabInfo = {
      connectionStatus: 'connected',
      videoStatus: 'detected',
      primarySubtitle: existingSubtitle.id,
    };
    act(() => root.render(<SubtitleUploadPage />));

    expect(findButton(container, 'delete')).toBeUndefined();
    expect(getButton(container, 'edit_subtitle_details').className).toContain('col-span-2');
  });

  it('isolates Edit mode, ignores outside clicks, and restores focus on Cancel', () => {
    testState.subtitles = [existingSubtitle];
    act(() => root.render(<SubtitleUploadPage />));

    const editButton = getButton(container, 'edit_subtitle_details');
    act(() => editButton.click());

    expect(document.activeElement?.textContent).toBe('edit_subtitle_details');
    expect(findButton(container, 'use_as_primary')).toBeUndefined();
    expect(findButton(container, 'analyze')).toBeUndefined();
    expect(findButton(container, 'sync')).toBeUndefined();
    expect(findButton(container, 'delete')).toBeUndefined();

    act(() => document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
    expect(container.textContent).toContain('edit_subtitle_details');

    act(() => getButton(container, 'cancel').click());
    expect(document.activeElement).toBe(getButton(container, 'edit_subtitle_details'));
  });

  it('isolates Sync mode and restores focus on Cancel', () => {
    testState.subtitles = [existingSubtitle];
    act(() => root.render(<SubtitleUploadPage />));

    const syncButton = getButton(container, 'sync');
    act(() => syncButton.click());

    expect(document.activeElement?.textContent).toBe('sync_adjustment');
    expect(container.textContent).toContain(existingSubtitle.title);
    expect(container.textContent).toContain('sync_value');
    expect(container.textContent).not.toContain('added_date');
    expect(container.textContent).not.toContain('primary_subtitle');
    expect(container.textContent).not.toContain('secondary_subtitle');
    expect(findButton(container, 'use_as_primary')).toBeUndefined();
    expect(findButton(container, 'analyze')).toBeUndefined();
    expect(findButton(container, 'edit_subtitle_details')).toBeUndefined();

    act(() => getButton(container, 'cancel').click());
    expect(document.activeElement).toBe(getButton(container, 'sync'));
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
