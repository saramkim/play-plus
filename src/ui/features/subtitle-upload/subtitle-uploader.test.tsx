import { act } from 'react';

import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { modal } from '@/ui/components/modal';

import { SubtitleUploader } from './subtitle-uploader';

vi.mock('@/ui/components/modal', () => ({ modal: { alert: vi.fn() } }));
vi.mock('@/ui/components/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: () => null,
  SelectItem: () => null,
}));

let container: HTMLDivElement;
let root: Root;
let stored: Record<string, unknown>;

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  stored = {
    registeredSubtitles: [{ id: 'subtitle-existing', title: 'Keep me', language: 'ko', savedAt: '2026-01-01' }],
    'subtitle-existing': [{ start: 2, end: 3, text: 'unchanged' }],
  };
  vi.mocked(chrome.storage.local.get).mockImplementation((keys: unknown, callback?: (items: unknown) => void) => {
    const values = { [String(keys)]: stored[String(keys)] };
    if (callback) callback(values);
    return Promise.resolve(values);
  });
  vi.mocked(chrome.storage.local.set).mockImplementation(async (items) => {
    Object.assign(stored, items);
  });
  vi.mocked(chrome.storage.local.set).mockClear();
  vi.mocked(modal.alert).mockClear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<SubtitleUploader />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const selectFile = async (content: string, name = 'fixture.srt') => {
  const input = container.querySelector('input[type=file]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { configurable: true, value: [new File([content], name)] });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
};

const submit = async () => {
  await act(async () => {
    container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      const writes = vi.mocked(chrome.storage.local.set).mock.calls.length;
      const alerts = vi.mocked(modal.alert).mock.calls.length;
      expect(writes + alerts).toBeGreaterThan(0);
    });
  });
};

describe('subtitle upload validation', () => {
  it.each(['error', 'abort'])('recovers from a file read %s without changing stored data', async (event) => {
    vi.spyOn(FileReader.prototype, 'readAsArrayBuffer').mockImplementation(function (this: FileReader) {
      queueMicrotask(() => this.dispatchEvent(new ProgressEvent(event)));
    });
    const before = structuredClone(stored);
    await selectFile('1\n00:00:01,000 --> 00:00:02,000\nvalid');
    await submit();
    expect(stored).toEqual(before);
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    expect(modal.alert).toHaveBeenCalledWith({ title: 'error', message: 'error_try_later' });
    expect(container.querySelector<HTMLButtonElement>('button[type=submit]')?.disabled).toBe(false);
  });

  it.each(['', '1\nbad --> bad\ninvalid'])('rejects empty parsed SRT without any storage writes and keeps the draft', async (text) => {
    const before = structuredClone(stored);
    await selectFile(text);
    await submit();
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    expect(stored).toEqual(before);
    expect(modal.alert).toHaveBeenCalledWith({ title: 'error', message: 'error_empty_subtitle' });
    expect(container.querySelector('form')).not.toBeNull();
    expect(container.querySelector<HTMLButtonElement>('button[type=submit]')?.disabled).toBe(false);
  });

  it.each([
    ['fixture.srt', '1\nbad --> bad\ninvalid\n\n2\n00:00:01,000 --> 00:00:02,000\nvalid'],
    ['fixture.vtt', 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nvalid'],
    ['fixture.smi', '<SYNC Start=1000><P>valid<SYNC Start=3000><P>&nbsp;'],
  ])('registers valid %s using the original storage shape and preserves existing data', async (name, text) => {
    const previous = structuredClone(stored);
    await selectFile(text, name);
    await submit();
    const list = stored.registeredSubtitles as { id: string; title: string; language: string }[];
    expect(list).toHaveLength(2);
    expect(list[0]).toEqual((previous.registeredSubtitles as unknown[])[0]);
    expect(stored['subtitle-existing']).toEqual(previous['subtitle-existing']);
    expect(Object.keys(list[1]).sort()).toEqual(['id', 'language', 'savedAt', 'title']);
    expect(list[1]).toMatchObject({ title: 'fixture', language: 'en' });
    expect(stored[list[1].id]).toEqual([{ start: 1, end: name.endsWith('.smi') ? 3 : 2, text: 'valid' }]);
    expect(modal.alert).not.toHaveBeenCalled();
    expect(container.querySelector('form')).toBeNull();
  });
});
