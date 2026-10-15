import { act } from 'react';

import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FeedbackSubmissionError, requestFeedbackPermission, sendFeedback } from './client';
import { feedbackConfig } from './config';
import { Feedback } from './feedback';

vi.mock('./config', () => ({ feedbackConfig: { origin: 'https://feedback.test', privacyUrl: 'https://privacy.test' } }));
vi.mock('./client', async (original) => ({ ...await original<typeof import('./client')>(), requestFeedbackPermission: vi.fn().mockResolvedValue(true), sendFeedback: vi.fn().mockResolvedValue(undefined) }));
let container: HTMLDivElement;
let root: Root;
const onClose = vi.fn();
const onOpen = vi.fn();
const render = (open = true, onboardingComplete = true) => act(async () => root.render(<Feedback open={open} onClose={onClose} onOpen={onOpen} onboardingComplete={onboardingComplete} />));
const click = async (label: string) => act(async () => { Array.from(container.querySelectorAll('button')).find((button) => button.textContent === label)!.click(); });
const submit = async () => { await click('feedback_send'); await click('feedback_confirm_send'); };
const enter = async (text: string) => act(async () => {
  const textarea = container.querySelector('textarea')!;
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, text);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
});
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(sendFeedback).mockReset().mockResolvedValue(undefined);
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe('feedback UI', () => {
  it('explains unconfigured intake without a banner, enabled send or permission request', async () => {
    const origin = feedbackConfig.origin;
    feedbackConfig.origin = '';
    try {
      await render(false);
      expect(container.querySelector('button')).toBeNull();
      await render();
      expect(container.textContent).toContain('feedback_unavailable');
      await enter('hello'); await click('feedback_send');
      expect(requestFeedbackPermission).not.toHaveBeenCalled();
      expect(sendFeedback).not.toHaveBeenCalled();
    } finally { feedbackConfig.origin = origin; }
  });
  it('hides the banner until onboarding finishes, dismisses persistently, and still permits menu access', async () => {
    await render(false, false);
    expect(container.querySelector('button')).toBeNull();
    await render(false, true);
    await click('feedback_open');
    expect(onOpen).toHaveBeenCalledOnce();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label=feedback_dismiss]')!.click());
    expect(localStorage.getItem('feedbackBannerDismissed')).toBe('true');
    await render();
    expect(container.querySelector('textarea')).not.toBeNull();
    expect(sendFeedback).not.toHaveBeenCalled();
    expect(requestFeedbackPermission).not.toHaveBeenCalled();
  });
  it.each(['   ', 'a'.repeat(1001)])('rejects invalid input without permission or network requests', async (text) => {
    await render(); await enter(text); await click('feedback_send');
    expect(container.querySelector('[role=alert]')?.textContent).toBe('feedback_length');
    expect(requestFeedbackPermission).not.toHaveBeenCalled();
    expect(container.querySelector('dialog')?.open).toBe(false);
  });
  it('waits for explicit consent and keeps the draft when returning or escaping', async () => {
    await render(); await enter('hello'); await click('feedback_send');
    const dialog = container.querySelector('dialog')!;
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain('feedback_disclosure');
    expect(dialog.querySelector('a')).toBeNull();
    expect(container.querySelector('#feedback-count')?.textContent).toBe('5/1,000');
    expect(container.querySelector('a')?.href).toBe('https://privacy.test/');
    expect(document.activeElement?.textContent).toBe('feedback_back');
    await act(async () => {
      document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    });
    expect(document.activeElement?.textContent).toBe('feedback_confirm_send');
    await act(async () => {
      document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    });
    expect(document.activeElement?.textContent).toBe('feedback_back');
    expect(requestFeedbackPermission).not.toHaveBeenCalled();
    expect(sendFeedback).not.toHaveBeenCalled();
    await click('feedback_back');
    expect(dialog.open).toBe(false);
    expect(container.querySelector('textarea')?.value).toBe('hello');
    expect(document.activeElement?.textContent).toBe('feedback_send');
    await click('feedback_send');
    await act(async () => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    });
    expect(dialog.open).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
    expect(container.querySelector('textarea')?.value).toBe('hello');
    expect(sendFeedback).not.toHaveBeenCalled();
    await submit();
    expect(requestFeedbackPermission).toHaveBeenCalledOnce();
    expect(sendFeedback).toHaveBeenCalledOnce();
  });
  it.each([' x ', '가'.repeat(1000)])('accepts trimmed boundary input and dismisses the banner after storage', async (text) => {
    await render(); await enter(text); await submit();
    expect(sendFeedback).toHaveBeenCalledWith(text.trim(), expect.any(String), expect.any(Promise));
    expect(container.textContent).toContain('feedback_success');
    expect(localStorage.getItem('feedbackBannerDismissed')).toBe('true');
    expect(document.activeElement?.textContent).toBe('feedback_success');
  });
  it('blocks double send and cancellation while pending', async () => {
    let resolve!: () => void;
    vi.mocked(sendFeedback).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    await render(); await enter('hello');
    await click('feedback_send');
    await act(async () => {
      const send = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'feedback_confirm_send')!;
      send.click(); send.click();
    });
    await click('feedback_cancel');
    expect(onClose).not.toHaveBeenCalled();
    expect(sendFeedback).toHaveBeenCalledOnce();
    expect(container.querySelector('textarea')?.disabled).toBe(true);
    await act(async () => resolve());
    expect(container.textContent).toContain('feedback_success');
  });
  it.each(['feedback_permission_denied', 'feedback_rate_limited', 'feedback_failed'] as const)('preserves the draft and retry ID after %s', async (key) => {
    vi.mocked(sendFeedback).mockRejectedValueOnce(new FeedbackSubmissionError(key));
    await render(); await enter('hello'); await submit();
    expect(container.querySelector('textarea')?.value).toBe('hello');
    expect(container.querySelector('[role=alert]')?.textContent).toBe(key);
    const id = vi.mocked(sendFeedback).mock.calls[0][1];
    await submit();
    expect(vi.mocked(sendFeedback).mock.calls[1][1]).toBe(id);
  });
  it('uses a new ID after changing a failed message', async () => {
    vi.mocked(sendFeedback).mockRejectedValueOnce(new Error('offline'));
    await render(); await enter('first'); await submit();
    const id = vi.mocked(sendFeedback).mock.calls[0][1];
    await enter('second'); await submit();
    expect(vi.mocked(sendFeedback).mock.calls[1][1]).not.toBe(id);
  });
  it('focuses input, does not submit on Enter/IME, and supports Escape cancellation', async () => {
    await render(); await enter('한글');
    const textarea = container.querySelector('textarea')!;
    expect(document.activeElement).toBe(textarea);
    await act(async () => {
      textarea.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, isComposing: true }));
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, isComposing: true }));
    });
    await click('feedback_send');
    expect(sendFeedback).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
    await act(async () => {
      textarea.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(sendFeedback).not.toHaveBeenCalled();
    await act(async () => textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
