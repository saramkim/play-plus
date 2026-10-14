import { act } from 'react';

import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Modal } from './modal';
import { modal } from './modal-service';

let container: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<Modal />));
});
afterEach(async () => {
  await act(async () => { modal.hide(); root.unmount(); });
  container.remove();
});
const button = (text: string) => Array.from(container.querySelectorAll('button')).find((b) => b.textContent === text)!;
const show = async (onConfirm: () => void | Promise<void>, errorMessage?: (error: unknown) => string) => {
  await act(async () => modal.confirm({ title: 'Delete', message: 'Confirm deletion', onConfirm, errorMessage }));
};

describe('asynchronous confirmation', () => {
  it('blocks repeated confirmation and every dismissal until successful completion', async () => {
    let resolve!: () => void;
    const onConfirm = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
    await show(onConfirm);
    await act(async () => { button('confirm').click(); button('confirm').click(); });
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(Array.from(container.querySelectorAll('button')).every((b) => b.disabled)).toBe(true);
    await act(async () => {
      button('cancel').click();
      container.querySelector<HTMLButtonElement>('button.absolute')!.click();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      modal.hide();
    });
    expect(container.textContent).toContain('Confirm deletion');
    await act(async () => resolve());
    expect(container.textContent).toBe('');
  });

  it.each(['throw', 'reject'])('keeps a failed %s open with a retry and custom recovery error', async (mode) => {
    const onConfirm = vi.fn<() => void | Promise<void>>().mockImplementationOnce(() => {
      if (mode === 'throw') throw new Error('failed');
      return Promise.reject(new Error('failed'));
    });
    await show(onConfirm, () => 'Recovery failed');
    await act(async () => button('confirm').click());
    expect(container.querySelector('[role=alert]')?.textContent).toBe('Recovery failed');
    expect(button('confirm').disabled).toBe(false);
    await act(async () => button('confirm').click());
    expect(onConfirm).toHaveBeenCalledTimes(2);
    expect(container.textContent).toBe('');
  });

  it('does not close or unlock a replacement modal when the old operation finishes', async () => {
    let resolveOld!: () => void;
    let resolveNew!: () => void;
    await show(() => new Promise<void>((resolve) => { resolveOld = resolve; }));
    await act(async () => button('confirm').click());
    await show(() => new Promise<void>((resolve) => { resolveNew = resolve; }));
    await act(async () => button('confirm').click());
    await act(async () => resolveOld());
    expect(button('confirm').disabled).toBe(true);
    await act(async () => modal.hide());
    expect(container.textContent).toContain('Confirm deletion');
    await act(async () => resolveNew());
    expect(container.textContent).toBe('');
  });

  it('preserves immediate synchronous completion and ordinary Escape dismissal', async () => {
    const onConfirm = vi.fn();
    await show(onConfirm);
    await act(async () => button('confirm').click());
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(container.textContent).toBe('');
    await show(onConfirm);
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(container.textContent).toBe('');
  });
});
