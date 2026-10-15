import { act } from 'react';

import { PAGE_NAME } from '@utils/constants';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { App } from './app';
import { sendFeedback } from './features/feedback/client';

vi.mock('./features/feedback/config', () => ({ feedbackConfig: { origin: 'https://feedback.test', privacyUrl: 'https://privacy.test' } }));
vi.mock('./features/feedback/client', async (original) => ({ ...await original<typeof import('./features/feedback/client')>(), requestFeedbackPermission: vi.fn().mockResolvedValue(true), sendFeedback: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./components/modal', () => ({ modal: vi.fn() }));
vi.mock('./layout/connection-status', () => ({ ConnectionStatus: () => <div>connection</div> }));
vi.mock('./layout/header', () => ({ Header: () => <div>header</div> }));
vi.mock('./layout/footer', () => ({ Footer: ({ onFeedback }: { onFeedback: (trigger: HTMLElement) => void }) => <button data-feedback-menu-trigger onClick={(event) => onFeedback(event.currentTarget)}>menu</button> }));
vi.mock('./pages/review-page', () => ({ ReviewPage: () => <div>review</div> }));
vi.mock('./pages/subtitle-analysis-page', () => ({ SubtitleAnalysisPage: () => <div>analysis</div> }));
vi.mock('./pages/subtitle-setting-page', () => ({ SubtitleSettingPage: () => <div>settings</div> }));
vi.mock('./pages/subtitle-upload-page', () => ({ SubtitleUploadPage: () => <div>upload</div> }));
vi.mock('./pages/video-setting-page', () => ({ VideoSettingPage: () => <div>video</div> }));
vi.mock('./store/config-store', () => ({ useConfigStore: (select: (state: unknown) => unknown) => select({ loading: false, initializeConfigs: async () => ({ remove: vi.fn() }) }) }));
vi.mock('./store/tab-store', () => ({ useTabStore: (select: (state: unknown) => unknown) => select({ initialize: async () => vi.fn() }) }));
vi.mock('./store/page-store', () => ({ usePageStore: (select: (state: unknown) => unknown) => select({ currentPage: PAGE_NAME.SUBTITLE_SETTING }) }));

let root: Root;
let container: HTMLDivElement;
const button = (label: string) => Array.from(container.querySelectorAll('button')).find((item) => item.textContent === label)!;
const click = async (label: string) => {
  await act(async () => button(label).click());
  await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });
};
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks(); localStorage.clear(); localStorage.setItem('isOnboardingComplete', 'true');
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<App />));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

it('restores banner focus on cancel and menu focus after success removes the banner', async () => {
  await click('feedback_open');
  expect(document.activeElement).toBe(container.querySelector('textarea'));
  await click('feedback_cancel');
  expect(document.activeElement).toBe(button('feedback_open'));
  await click('feedback_open');
  const textarea = container.querySelector('textarea')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'feedback');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await click('feedback_send');
  expect(sendFeedback).toHaveBeenCalledOnce();
  await click('feedback_close');
  expect(document.activeElement).toBe(button('menu'));
  expect(container.textContent).toContain('settings');
});

it('refocuses an already-open form from the persistent menu', async () => {
  await click('menu');
  button('menu').focus();
  await click('menu');
  expect(document.activeElement).toBe(container.querySelector('textarea'));
  await click('feedback_cancel');
  expect(document.activeElement).toBe(button('menu'));
  expect(sendFeedback).not.toHaveBeenCalled();
});
