import { act } from 'react';

import { SavedSubtitle, SavedSubtitleReviewStatus } from '@storage/type';
import { createRoot, Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ReviewPage } from './review-page';

const testState = vi.hoisted(() => ({
  subtitles: [] as SavedSubtitle[],
  deleteSubtitle: vi.fn(),
  updateReviewStatus: vi.fn(),
  sendMessage: vi.fn(),
  showError: vi.fn(),
}));

vi.mock('@/ui/features/subtitle/use-saved-subtitle', () => ({
  useSavedSubtitle: () => ({
    subtitles: testState.subtitles,
    deleteSubtitle: testState.deleteSubtitle,
    updateReviewStatus: testState.updateReviewStatus,
    loading: false,
  }),
}));

vi.mock('@/ui/components/copy-button', () => ({
  CopyButton: ({ content }: { content: string }) => (
    <button type='button' aria-label='copy' data-content={content}>
      copy
    </button>
  ),
}));

vi.mock('@utils/message/index', () => ({ sendMessage: testState.sendMessage }));
vi.mock('sonner', () => ({ toast: { error: testState.showError } }));

describe('ReviewPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chrome.i18n.getMessage).mockImplementation((key, substitutions) => {
      const values = Array.isArray(substitutions) ? substitutions : substitutions ? [substitutions] : [];
      return [key, ...values].join(':');
    });
    testState.subtitles = [];
    testState.updateReviewStatus.mockImplementation(
      async (id: string, reviewStatus: SavedSubtitleReviewStatus) => {
        const card = testState.subtitles.find((subtitle) => subtitle.id === id);
        return card ? { ...card, reviewStatus } : undefined;
      }
    );
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  afterAll(() => vi.unstubAllGlobals());

  it('starts a fixed New and Learning queue and resets the second subtitle on navigation', () => {
    const first = createCard('new-card', 'new', 'First primary', 'First secondary');
    const mastered = createCard('mastered-card', 'mastered', 'Completed primary');
    const second = createCard('learning-card', 'learning', 'Second primary', 'Second secondary');
    testState.subtitles = [first, mastered, second];

    act(() => root.render(<ReviewPage />));

    expect(container.textContent).toContain('First primary');
    expect(container.textContent).not.toContain('First secondary');
    expect(container.textContent).not.toContain('Completed primary');
    expect(container.textContent).toContain('1 / 2');
    expect(container.textContent).toContain('review_queue_summary:1:1');
    expect(container.textContent).toContain('review_status_new');
    expect(container.textContent).toContain('review_status_new_description');
    expect(getButton(container, 'review_start_learning')).toBeDefined();
    expect(getButton(container, 'review_already_know')).toBeDefined();

    testState.subtitles = [
      { ...first, reviewStatus: 'mastered' },
      mastered,
      { ...second, reviewStatus: 'mastered' },
    ];
    act(() => root.render(<ReviewPage />));
    expect(container.textContent).toContain('First primary');
    expect(container.textContent).toContain('1 / 2');

    const revealButton = getButton(container, 'review_show_second_subtitle');
    expect(revealButton.getAttribute('aria-expanded')).toBe('false');
    act(() => revealButton.click());
    expect(container.textContent).toContain('First secondary');
    expect(getButton(container, 'review_hide_second_subtitle').getAttribute('aria-expanded')).toBe('true');

    act(() => getButton(container, 'review_skip').click());
    expect(container.textContent).toContain('Second primary');
    expect(container.textContent).not.toContain('Second secondary');
    expect(container.textContent).toContain('2 / 2');
    expect(document.activeElement?.textContent).toContain('Second primary');

    act(() => getButton(container, 'previous').click());
    expect(container.textContent).toContain('First primary');
    expect(container.textContent).not.toContain('First secondary');
  });

  it('locks judgments until persistence resolves and then advances', async () => {
    const first = createCard('new-card', 'new', 'First primary');
    const second = createCard('learning-card', 'learning', 'Second primary');
    testState.subtitles = [first, second];
    let resolveUpdate: ((card: SavedSubtitle) => void) | undefined;
    const pendingUpdate = new Promise<SavedSubtitle>((resolve) => {
      resolveUpdate = resolve;
    });
    testState.updateReviewStatus.mockReturnValueOnce(pendingUpdate);

    act(() => root.render(<ReviewPage />));

    const gotItButton = getButton(container, 'review_already_know');
    await act(async () => {
      gotItButton.click();
      await Promise.resolve();
    });

    expect(gotItButton.disabled).toBe(true);
    gotItButton.click();
    expect(testState.updateReviewStatus).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('First primary');

    await act(async () => {
      resolveUpdate?.({ ...first, reviewStatus: 'mastered' });
      await pendingUpdate;
    });

    expect(testState.updateReviewStatus).toHaveBeenCalledWith('new-card', 'mastered');
    expect(container.textContent).toContain('Second primary');
  });

  it('keeps the current card visible when a review status cannot be saved', async () => {
    testState.subtitles = [createCard('new-card', 'new', 'First primary')];
    testState.updateReviewStatus.mockResolvedValueOnce(undefined);
    act(() => root.render(<ReviewPage />));

    await act(async () => getButton(container, 'review_start_learning').click());

    expect(container.textContent).toContain('First primary');
    expect(container.textContent).not.toContain('review_complete_title');
    expect(testState.showError).toHaveBeenCalledWith('review_status_update_failed');
  });

  it('offers a completed-only session after the pending queue ends', () => {
    testState.subtitles = [
      createCard('new-card', 'new', 'Pending primary'),
      createCard('mastered-card', 'mastered', 'Completed primary'),
    ];
    act(() => root.render(<ReviewPage />));

    act(() => getButton(container, 'review_skip').click());
    expect(container.textContent).toContain('review_complete_title');
    expect(document.activeElement?.textContent).toBe('review_complete_title');

    act(() => getButton(container, 'review_review_completed').click());
    expect(container.textContent).toContain('Completed primary');
    expect(container.textContent).not.toContain('Pending primary');
    expect(container.textContent).toContain('1 / 1');
    expect(container.textContent).toContain('review_completed_session');
    expect(container.textContent).toContain('review_status_mastered');
    expect(container.textContent).toContain('review_status_mastered_description');
    expect(getButton(container, 'review_learn_again')).toBeDefined();
    expect(getButton(container, 'review_still_remember')).toBeDefined();
  });

  it('shows the saved status and matching actions when a judged card is revisited', async () => {
    const first = createCard('new-card', 'new', 'First primary');
    const second = createCard('learning-card', 'learning', 'Second primary');
    testState.subtitles = [first, second];
    act(() => root.render(<ReviewPage />));

    await act(async () => getButton(container, 'review_start_learning').click());

    expect(testState.updateReviewStatus).toHaveBeenCalledWith('new-card', 'learning');
    expect(container.textContent).toContain('Second primary');
    expect(container.textContent).toContain('review_queue_summary:2:0');

    act(() => getButton(container, 'previous').click());

    expect(container.textContent).toContain('First primary');
    expect(container.textContent).toContain('review_status_learning');
    expect(container.textContent).toContain('review_status_learning_description');
    expect(getButton(container, 'review_keep_learning')).toBeDefined();
    expect(getButton(container, 'review_remember')).toBeDefined();
  });

  it('keeps search, filters, status editing, delete, copy, and video actions in Library', () => {
    const card = createCard('new-card', 'new', 'Primary text', 'Secondary text');
    testState.subtitles = [card];
    act(() => root.render(<ReviewPage />));

    act(() => getButton(container, 'review_mode_library').click());

    expect(container.querySelector("input[aria-label='search']")).not.toBeNull();
    expect(container.querySelector("[aria-label='review_status_filter']")).not.toBeNull();
    expect(getButton(container, 'latest').getAttribute('aria-pressed')).toBe('true');
    expect(container.textContent).toContain('Primary text');
    expect(container.textContent).toContain('Secondary text');
    expect(getButton(container, 'review_status_change:review_status_new')).toBeDefined();
    expect(getButton(container, 'copy').getAttribute('data-content')).toBe('Primary text');

    act(() => getButton(container, 'view_video').click());
    expect(testState.sendMessage).toHaveBeenCalledWith('viewVideo', {
      url: card.url,
      startTime: card.startTime,
    });

    act(() => getButton(container, 'delete').click());
    expect(testState.deleteSubtitle).toHaveBeenCalledWith('new-card');
  });

  it('clears Library search and status filters from the filtered empty state', () => {
    testState.subtitles = [createCard('new-card', 'new', 'Saved primary')];
    act(() => root.render(<ReviewPage />));
    act(() => getButton(container, 'review_mode_library').click());

    const input = container.querySelector("input[aria-label='search']");
    if (!(input instanceof HTMLInputElement)) throw new Error('Expected search input');
    act(() => {
      input.value = 'missing';
      input.closest('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain('review_status_empty');
    act(() => getButton(container, 'clear_filters').click());
    expect(container.textContent).toContain('Saved primary');
    expect(container.querySelector<HTMLInputElement>("input[aria-label='search']")?.value).toBe('');
  });
});

function createCard(
  id: string,
  reviewStatus: SavedSubtitleReviewStatus,
  primaryText: string,
  secondaryText?: string
): SavedSubtitle {
  return {
    id,
    primary: { text: primaryText, language: 'en' },
    ...(secondaryText ? { secondary: { text: secondaryText, language: 'ko' as const } } : {}),
    reviewStatus,
    savedAt: '2026-08-02T00:00:00.000Z',
    url: `https://www.coupangplay.com/play/${id}`,
    startTime: 42,
  };
}

function getButton(container: HTMLElement, accessibleName: string) {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.getAttribute('aria-label') === accessibleName || candidate.textContent === accessibleName
  );
  if (!button) throw new Error(`Expected button: ${accessibleName}`);
  return button;
}
