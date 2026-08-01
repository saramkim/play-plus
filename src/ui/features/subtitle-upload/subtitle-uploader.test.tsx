import { act } from 'react';

import { SubtitleMetadata } from '@storage/type';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SubtitleUploader } from './subtitle-uploader';

const registerSubtitleTextMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());

vi.mock('./subtitle-registration', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./subtitle-registration')>();
  return { ...actual, registerSubtitleText: registerSubtitleTextMock };
});

vi.mock('@utils/subtitle-decode', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@utils/subtitle-decode')>();
  return { ...actual, decodeSubtitleBytes: vi.fn(() => 'decoded subtitle') };
});

vi.mock('sonner', () => ({ toast: { success: toastSuccessMock } }));

const metadata = {
  id: 'subtitle-00000000-0000-4000-8000-000000000001',
  title: 'Lesson',
  language: 'en',
  savedAt: '2026-08-01T00:00:00.000Z',
} as SubtitleMetadata;

const flushAsyncUpdates = () =>
  act(async () => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  });

describe('SubtitleUploader', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const renderUploader = ({
    focusOnMount = false,
    onAdded = vi.fn(),
    onBusyChange = vi.fn(),
  }: {
    focusOnMount?: boolean;
    onAdded?: (subtitle: SubtitleMetadata) => void;
    onBusyChange?: (busy: boolean) => void;
  } = {}) => {
    act(() => {
      root.render(
        <SubtitleUploader
          focusOnMount={focusOnMount}
          onAdded={onAdded}
          onBusyChange={onBusyChange}
        />
      );
    });
  };

  const selectValidFile = () => {
    const fileInput = container.querySelector<HTMLInputElement>("input[type='file']");
    if (!fileInput) throw new Error('Expected file input');

    const file = new File(['subtitle'], 'lesson.srt', { type: 'application/x-subrip' });
    Object.defineProperty(file, 'arrayBuffer', {
      configurable: true,
      value: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });

    act(() => fileInput.dispatchEvent(new Event('change', { bubbles: true })));
  };

  it('focuses the file picker when requested', () => {
    renderUploader({ focusOnMount: true });

    expect(document.activeElement).toBe(
      container.querySelector<HTMLButtonElement>("button[aria-label='upload_subtitle_file']")
    );
  });

  it('locks every input while registering and returns the added metadata', async () => {
    let resolveRegistration: (subtitle: SubtitleMetadata) => void = () => undefined;
    const registration = new Promise<SubtitleMetadata>((resolve) => {
      resolveRegistration = resolve;
    });
    registerSubtitleTextMock.mockReturnValue(registration);
    const onAdded = vi.fn();
    const onBusyChange = vi.fn();
    renderUploader({ onAdded, onBusyChange });
    selectValidFile();

    const form = container.querySelector('form');
    if (!form) throw new Error('Expected registration form');

    act(() => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    await flushAsyncUpdates();

    expect(container.firstElementChild?.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector<HTMLButtonElement>("button[aria-label='upload_subtitle_file']")?.disabled).toBe(true);
    expect(container.querySelector<HTMLInputElement>("input[type='file']")?.disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>("button[role='combobox']")?.disabled).toBe(true);
    expect(container.querySelector<HTMLInputElement>("input[aria-label='subtitle_title']")?.disabled).toBe(true);
    expect(Array.from(form.querySelectorAll<HTMLButtonElement>('button')).every((button) => button.disabled)).toBe(true);
    expect(onBusyChange).toHaveBeenLastCalledWith(true);

    resolveRegistration(metadata);
    await registration;
    await flushAsyncUpdates();

    expect(onAdded).toHaveBeenCalledWith(metadata);
    expect(toastSuccessMock).toHaveBeenCalledWith('success_add_subtitle');
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
    expect(container.querySelector('form')).toBeNull();
  });

  it('keeps the selected file and title retryable after registration fails', async () => {
    registerSubtitleTextMock.mockRejectedValue(new Error('storage unavailable'));
    const onAdded = vi.fn();
    const onBusyChange = vi.fn();
    renderUploader({ onAdded, onBusyChange });
    selectValidFile();

    const form = container.querySelector('form');
    if (!form) throw new Error('Expected registration form');
    act(() => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    await flushAsyncUpdates();

    expect(container.querySelector("[role='alert']")?.textContent).toBe('error_try_later');
    expect(container.textContent).toContain('lesson.srt');
    expect(container.querySelector<HTMLInputElement>("input[aria-label='subtitle_title']")?.value).toBe('lesson');
    expect(container.querySelector<HTMLInputElement>("input[aria-label='subtitle_title']")?.disabled).toBe(false);
    expect(onAdded).not.toHaveBeenCalled();
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
  });
});
