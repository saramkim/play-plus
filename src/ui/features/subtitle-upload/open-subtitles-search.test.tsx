import { act } from 'react';

import { V2RegisteredSubtitleMetadata } from '@storage/v2/type';
import { sendMessage } from '@utils/message';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { requestOpenSubtitlesPermission } from './open-subtitles-permission';
import { OpenSubtitlesSearch } from './open-subtitles-search';
import { registerSubtitleText } from './subtitle-registration';

const toastSuccessMock = vi.hoisted(() => vi.fn());

vi.mock('@utils/message', () => ({ sendMessage: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: toastSuccessMock } }));
vi.mock('./open-subtitles-permission', () => ({ requestOpenSubtitlesPermission: vi.fn() }));
vi.mock('./subtitle-registration', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./subtitle-registration')>();
  return { ...actual, registerSubtitleText: vi.fn() };
});

const candidate = {
  fileId: 42,
  fileName: 'The.Matrix.1999.srt',
  language: 'en' as const,
  featureTitle: 'The Matrix',
};

const secondCandidate = {
  fileId: 43,
  fileName: 'The.Matrix.1999.WEB.srt',
  language: 'en' as const,
  featureTitle: 'The Matrix',
};

const addedSubtitle: V2RegisteredSubtitleMetadata = {
  id: 'subtitle-00000000-0000-4000-8000-000000000000',
  title: 'The Matrix',
  language: 'en',
  savedAt: '2026-08-01T00:00:00.000Z',
};

const setInputValue = (input: HTMLInputElement, value: string) => {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('OpenSubtitlesSearch', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('does not request permission or provider data until explicit Search', async () => {
    await act(async () => {
      root.render(<OpenSubtitlesSearch focusOnMount onAdded={vi.fn()} onBusyChange={vi.fn()} />);
    });

    const titleInput = getTitleInput(container);
    expect(document.activeElement).toBe(titleInput);
    expect(container.querySelector('details')?.open).toBe(false);
    expect(container.textContent).toContain('opensubtitles_search_privacy');
    expect(container.textContent).toContain('opensubtitles_search_permission');
    expect(container.textContent).toContain('opensubtitles_attribution');
    expect(requestOpenSubtitlesPermission).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();

    await act(async () => setInputValue(titleInput, 'The Matrix'));

    expect(requestOpenSubtitlesPermission).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('locks the workflow while requesting permission and sends no request after denial', async () => {
    let resolvePermission: (granted: boolean) => void = () => undefined;
    const permission = new Promise<boolean>((resolve) => {
      resolvePermission = resolve;
    });
    vi.mocked(requestOpenSubtitlesPermission).mockReturnValue(permission);
    const onBusyChange = vi.fn();
    await renderSearch(root, onBusyChange);

    const titleInput = getTitleInput(container);
    await act(async () => setInputValue(titleInput, 'The Matrix'));
    await act(async () => {
      getSearchForm(container).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(container.firstElementChild?.getAttribute('aria-busy')).toBe('true');
    expect(titleInput.disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>('[role="combobox"]')?.disabled).toBe(true);
    expect(container.querySelector('summary')?.getAttribute('aria-disabled')).toBe('true');
    expect(onBusyChange).toHaveBeenLastCalledWith(true);
    expect(sendMessage).not.toHaveBeenCalled();

    await act(async () => {
      resolvePermission(false);
      await permission;
    });

    expect(container.firstElementChild?.getAttribute('aria-busy')).toBe('false');
    expect(titleInput.disabled).toBe(false);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('error_online_permission_denied');
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('searches only submitted fields and paginates without duplicating file results', async () => {
    vi.mocked(requestOpenSubtitlesPermission).mockResolvedValue(true);
    vi.mocked(sendMessage)
      .mockResolvedValueOnce({
        success: true,
        data: { totalCount: 2, totalPages: 2, page: 1, candidates: [candidate] },
      } as never)
      .mockResolvedValueOnce({
        success: true,
        data: { totalCount: 2, totalPages: 2, page: 2, candidates: [candidate, secondCandidate] },
      } as never);
    await renderSearch(root);

    await act(async () => setInputValue(getTitleInput(container), '  The Matrix  '));
    await act(async () => {
      getSearchForm(container).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(sendMessage).toHaveBeenNthCalledWith(1, 'searchOpenSubtitles', {
      query: 'The Matrix',
      language: 'en',
      page: 1,
    });
    expect(container.querySelectorAll('[data-online-subtitle-result]')).toHaveLength(1);
    expect(container.textContent).toContain('show_more');

    await act(async () => getButton(container, 'show_more').click());

    expect(sendMessage).toHaveBeenNthCalledWith(2, 'searchOpenSubtitles', {
      query: 'The Matrix',
      language: 'en',
      page: 2,
    });
    expect(container.querySelectorAll('[data-online-subtitle-result]')).toHaveLength(2);
    expect(requestOpenSubtitlesPermission).toHaveBeenCalledTimes(2);

    await act(async () => setInputValue(getTitleInput(container), 'The Matrix Reloaded'));

    expect(container.querySelectorAll('[data-online-subtitle-result]')).toHaveLength(0);
    expect(container.textContent).not.toContain('show_more');
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it('shows provider quota failures without discarding retryable search fields', async () => {
    vi.mocked(requestOpenSubtitlesPermission).mockResolvedValue(true);
    vi.mocked(sendMessage).mockResolvedValue({ success: false, code: 'RATE_LIMIT' } as never);
    await renderSearch(root);

    const titleInput = getTitleInput(container);
    await act(async () => setInputValue(titleInput, 'The Matrix'));
    await act(async () => {
      getSearchForm(container).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toBe('error_online_rate_limit');
    expect(titleInput.value).toBe('The Matrix');
    expect(titleInput.disabled).toBe(false);
  });

  it.each([
    {
      name: 'successful results',
      firstResult: { totalCount: 1, totalPages: 1, page: 1, candidates: [candidate] },
      initialState: 'result',
    },
    {
      name: 'an empty result',
      firstResult: { totalCount: 0, totalPages: 0, page: 1, candidates: [] },
      initialState: 'empty',
    },
  ])('clears $name before a new Search fails', async ({ firstResult, initialState }) => {
    vi.mocked(requestOpenSubtitlesPermission).mockResolvedValue(true);
    vi.mocked(sendMessage)
      .mockResolvedValueOnce({ success: true, data: firstResult } as never)
      .mockResolvedValueOnce({ success: false, code: 'NETWORK' } as never);
    await renderSearch(root);

    await act(async () => setInputValue(getTitleInput(container), 'The Matrix'));
    await act(async () => {
      getSearchForm(container).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    if (initialState === 'result') {
      expect(container.querySelectorAll('[data-online-subtitle-result]')).toHaveLength(1);
    } else {
      expect(container.textContent).toContain('no_search_results');
    }

    await act(async () => {
      getSearchForm(container).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(container.querySelectorAll('[data-online-subtitle-result]')).toHaveLength(0);
    expect(container.textContent).not.toContain('no_search_results');
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('error_online_network');
  });

  it('registers the selected file through the existing local seam without assigning a role', async () => {
    vi.mocked(requestOpenSubtitlesPermission).mockResolvedValue(true);
    vi.mocked(sendMessage)
      .mockResolvedValueOnce({
        success: true,
        data: { totalCount: 1, totalPages: 1, page: 1, candidates: [candidate] },
      } as never)
      .mockResolvedValueOnce({
        success: true,
        data: {
          fileId: candidate.fileId,
          fileName: candidate.fileName,
          text: '1\n00:00:00,000 --> 00:00:01,000\nHello',
          fromCache: false,
          quota: { requests: 1, remaining: 4, resetTimeUtc: null },
        },
      } as never);
    vi.mocked(registerSubtitleText).mockResolvedValue(addedSubtitle);
    const onAdded = vi.fn();
    await act(async () => {
      root.render(<OpenSubtitlesSearch onAdded={onAdded} onBusyChange={vi.fn()} />);
    });

    await act(async () => setInputValue(getTitleInput(container), 'The Matrix'));
    await act(async () => {
      getSearchForm(container).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await act(async () => getButton(container, 'add_online_subtitle').click());

    expect(sendMessage).toHaveBeenNthCalledWith(2, 'downloadOpenSubtitle', {
      fileId: candidate.fileId,
      language: 'en',
    });
    expect(registerSubtitleText).toHaveBeenCalledWith({
      fileName: candidate.fileName,
      title: 'The.Matrix.1999',
      language: 'en',
      text: '1\n00:00:00,000 --> 00:00:01,000\nHello',
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('success_add_subtitle_remaining');
    expect(onAdded).toHaveBeenCalledWith(addedSubtitle);
  });

  it('re-gates Add after permission revocation without requesting a download', async () => {
    vi.mocked(requestOpenSubtitlesPermission)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    vi.mocked(sendMessage).mockResolvedValueOnce({
      success: true,
      data: { totalCount: 1, totalPages: 1, page: 1, candidates: [candidate] },
    } as never);
    await renderSearch(root);

    await act(async () => setInputValue(getTitleInput(container), 'The Matrix'));
    await act(async () => {
      getSearchForm(container).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await act(async () => getButton(container, 'add_online_subtitle').click());

    expect(requestOpenSubtitlesPermission).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(registerSubtitleText).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      'error_online_permission_denied'
    );
  });
});

const renderSearch = async (root: Root, onBusyChange = vi.fn()) => {
  await act(async () => {
    root.render(<OpenSubtitlesSearch onAdded={vi.fn()} onBusyChange={onBusyChange} />);
  });
};

function getTitleInput(container: HTMLElement) {
  const input = container.querySelector<HTMLInputElement>('[aria-label="search_title"]');
  if (!input) throw new Error('Expected title input');
  return input;
}

function getSearchForm(container: HTMLElement) {
  const form = container.querySelector('form');
  if (!form) throw new Error('Expected search form');
  return form;
}

function getButton(container: HTMLElement, name: string) {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.getAttribute('aria-label') === name || candidate.textContent === name
  );
  if (!button) throw new Error(`Expected button: ${name}`);
  return button;
}
