import { act } from 'react';

import { createPortal } from 'react-dom';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SubtitleEditForm } from './subtitle-edit-form';

vi.mock('@/ui/components/select', () => ({
  Select: ({ children, disabled }: { children: React.ReactNode; disabled: boolean }) => <fieldset disabled={disabled}>{children}</fieldset>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ ref, children }: { ref: React.Ref<HTMLDivElement>; children: React.ReactNode }) => createPortal(<div ref={ref} data-testid='language-menu'>{children}</div>, document.body),
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
let container: HTMLDivElement;
let root: Root;
const close = vi.fn();
const edit = vi.fn<() => Promise<unknown>>();
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  close.mockReset(); edit.mockReset();
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<SubtitleEditForm id='subtitle-00000000-0000-0000-0000-000000000001' initialTitle='Draft' initialLanguage='ko' onEdit={edit} closeEditMode={close} />));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const submit = () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

describe('subtitle edit completion', () => {
  it('guards same-render duplicate submissions, pending input and outside clicks, then closes on success', async () => {
    let resolve!: () => void;
    edit.mockImplementation(() => new Promise<void>((done) => { resolve = done; }));
    await act(async () => { submit(); submit(); });
    expect(edit).toHaveBeenCalledExactlyOnceWith('subtitle-00000000-0000-0000-0000-000000000001', 'Draft', 'ko');
    expect(container.querySelector('input')?.disabled).toBe(true);
    expect(container.querySelector('fieldset')?.disabled).toBe(true);
    await act(async () => document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
    expect(close).not.toHaveBeenCalled();
    await act(async () => resolve());
    expect(close).toHaveBeenCalledOnce();
  });
  it('keeps the draft on failure, permits retry and preserves portal/outside click behavior', async () => {
    edit.mockRejectedValueOnce(new Error('storage')).mockResolvedValueOnce(undefined);
    await act(async () => submit());
    expect(close).not.toHaveBeenCalled();
    expect(container.querySelector('input')?.value).toBe('Draft');
    expect(container.querySelector('[role=alert]')?.textContent).toBe('error_try_later');
    await act(async () => document.querySelector('[data-testid=language-menu]')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
    expect(close).not.toHaveBeenCalled();
    await act(async () => submit());
    expect(edit).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledOnce();
    await act(async () => document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
    expect(close).toHaveBeenCalledTimes(2);
  });
});
