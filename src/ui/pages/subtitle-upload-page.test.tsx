import { act } from 'react';

import { SubtitleMetadata } from '@storage/type';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SubtitleUploadPage } from './subtitle-upload-page';

const testState = vi.hoisted(() => ({
  setNavigationLocked: vi.fn(),
  subtitles: [] as SubtitleMetadata[],
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
    editSubtitle: vi.fn(),
    updateDelay: vi.fn(),
    deleteSubtitle: vi.fn(),
    loading: false,
  }),
}));

vi.mock('@/ui/features/subtitle/use-subtitle-settings', () => ({
  useSubtitleSettings: () => ({ useAsSubtitle: vi.fn(), isAvailable: true }),
}));

vi.mock('@/ui/store/page-store', () => ({
  usePageStore: (selector: (state: { setNavigationLocked: (locked: boolean) => void; setPage: () => void }) => unknown) =>
    selector({ setNavigationLocked: testState.setNavigationLocked, setPage: vi.fn() }),
}));

vi.mock('@/ui/store/tab-store', () => ({
  useTabStore: (selector: (state: { activeTab: null; tabInfo: null }) => unknown) =>
    selector({ activeTab: null, tabInfo: null }),
}));

describe('SubtitleUploadPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    testState.subtitles = [];
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
});

function getButton(container: HTMLElement, accessibleName: string) {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.getAttribute('aria-label') === accessibleName || candidate.textContent === accessibleName
  );
  if (!button) throw new Error(`Expected button: ${accessibleName}`);
  return button;
}
