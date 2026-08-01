import { act } from 'react';

import { SubtitleMetadata } from '@storage/type';
import { sendMessage } from '@utils/message';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { requestOpenSubtitlesPermission } from './open-subtitles-permission';
import { OpenSubtitlesSearch } from './open-subtitles-search';
import { registerSubtitleText } from './subtitle-registration';

vi.mock('@utils/message', () => ({ sendMessage: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
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

const addedSubtitle = {
  id: 'subtitle-00000000-0000-0000-0000-000000000000',
  title: 'The Matrix',
  language: 'en',
  savedAt: '2026-08-01T00:00:00.000Z',
} as SubtitleMetadata;

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

  it('focuses the title and keeps advanced filters collapsed', async () => {
    await act(async () => {
      root.render(
        <OpenSubtitlesSearch focusOnMount onAdded={vi.fn()} onBusyChange={vi.fn()} />
      );
    });

    const titleInput = container.querySelector<HTMLInputElement>('[aria-label="search_title"]');
    const details = container.querySelector('details');

    expect(document.activeElement).toBe(titleInput);
    expect(details?.open).toBe(false);
    expect(details?.textContent).toContain('advanced_search');
    expect(container.textContent).toContain('opensubtitles_search_privacy');
  });

  it('clears stale results and pagination when a field changes', async () => {
    vi.mocked(requestOpenSubtitlesPermission).mockResolvedValue(true);
    vi.mocked(sendMessage).mockResolvedValueOnce({
      success: true,
      data: { totalCount: 2, totalPages: 2, page: 1, candidates: [candidate] },
    } as never);
    const onBusyChange = vi.fn();

    await act(async () => {
      root.render(<OpenSubtitlesSearch onAdded={vi.fn()} onBusyChange={onBusyChange} />);
    });

    const titleInput = container.querySelector<HTMLInputElement>('[aria-label="search_title"]');
    const form = container.querySelector('form');
    expect(titleInput).not.toBeNull();
    expect(form).not.toBeNull();

    await act(async () => {
      setInputValue(titleInput!, 'The Matrix');
    });
    await act(async () => {
      form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(container.querySelector('[data-online-subtitle-result]')).not.toBeNull();
    expect(container.textContent).toContain('show_more');
    expect(onBusyChange).toHaveBeenCalledWith(true);
    expect(onBusyChange).toHaveBeenLastCalledWith(false);

    vi.mocked(sendMessage).mockResolvedValueOnce({ success: false, code: 'NETWORK' } as never);
    await act(async () => {
      form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(container.querySelector('[data-online-subtitle-result]')).not.toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('error_online_network');

    await act(async () => {
      setInputValue(titleInput!, 'The Matrix Reloaded');
    });

    expect(container.querySelector('[data-online-subtitle-result]')).toBeNull();
    expect(container.textContent).not.toContain('show_more');
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('locks the workflow while requesting search permission and unlocks after denial', async () => {
    let resolvePermission: (granted: boolean) => void = () => undefined;
    const permission = new Promise<boolean>((resolve) => {
      resolvePermission = resolve;
    });
    vi.mocked(requestOpenSubtitlesPermission).mockReturnValue(permission);
    const onBusyChange = vi.fn();

    await act(async () => {
      root.render(<OpenSubtitlesSearch onAdded={vi.fn()} onBusyChange={onBusyChange} />);
    });

    const titleInput = container.querySelector<HTMLInputElement>('[aria-label="search_title"]');
    const form = container.querySelector('form');
    await act(async () => {
      setInputValue(titleInput!, 'The Matrix');
      form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(container.firstElementChild?.getAttribute('aria-busy')).toBe('true');
    expect(titleInput?.disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>('[role="combobox"]')?.disabled).toBe(true);
    expect(container.querySelector('summary')?.getAttribute('aria-disabled')).toBe('true');
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    expect(onBusyChange).toHaveBeenLastCalledWith(true);
    expect(sendMessage).not.toHaveBeenCalled();

    await act(async () => {
      resolvePermission(false);
      await permission;
    });

    expect(container.firstElementChild?.getAttribute('aria-busy')).toBe('false');
    expect(titleInput?.disabled).toBe(false);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('error_online_permission_denied');
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
  });

  it('passes registered subtitle metadata to onAdded', async () => {
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
        },
      } as never);
    let resolveRegistration: (subtitle: SubtitleMetadata) => void = () => undefined;
    const registration = new Promise<SubtitleMetadata>((resolve) => {
      resolveRegistration = resolve;
    });
    vi.mocked(registerSubtitleText).mockReturnValue(registration);
    const onAdded = vi.fn();
    const onBusyChange = vi.fn();

    await act(async () => {
      root.render(<OpenSubtitlesSearch onAdded={onAdded} onBusyChange={onBusyChange} />);
    });

    const titleInput = container.querySelector<HTMLInputElement>('[aria-label="search_title"]');
    const form = container.querySelector('form');
    await act(async () => {
      setInputValue(titleInput!, 'The Matrix');
    });
    await act(async () => {
      form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    const addButton = container.querySelector<HTMLButtonElement>('[aria-label="add_online_subtitle"]');
    expect(addButton).not.toBeNull();
    await act(async () => {
      addButton!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(registerSubtitleText).toHaveBeenCalledWith({
      fileName: candidate.fileName,
      title: 'The.Matrix.1999',
      language: candidate.language,
      text: '1\n00:00:00,000 --> 00:00:01,000\nHello',
    });
    expect(container.firstElementChild?.getAttribute('aria-busy')).toBe('true');
    expect(titleInput?.disabled).toBe(true);
    expect(addButton?.disabled).toBe(true);
    expect(onBusyChange).toHaveBeenLastCalledWith(true);

    await act(async () => {
      resolveRegistration(addedSubtitle);
      await registration;
    });

    expect(onAdded).toHaveBeenCalledWith(addedSubtitle);
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
  });
});
