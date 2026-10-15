import { act } from 'react';

import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { MoreMenu } from './more-menu';

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

it('opens feedback only after the real dropdown releases the hidden page', async () => {
  const onFeedback = vi.fn((trigger: HTMLElement) => {
    expect(trigger).toBe(container.querySelector('button'));
    expect(container.closest('[aria-hidden="true"]')).toBeNull();
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });
  await act(async () => root.render(<MoreMenu onFeedback={onFeedback} />));
  const trigger = container.querySelector('button')!;
  await act(async () => {
    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
  expect(document.querySelector('[role="menu"]')).not.toBeNull();
  expect(container.getAttribute('aria-hidden')).toBe('true');
  expect(onFeedback).not.toHaveBeenCalled();
  const item = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
    .find((element) => element.textContent === 'feedback_open')!;
  await act(async () => item.click());
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  expect(onFeedback).toHaveBeenCalledOnce();
});
