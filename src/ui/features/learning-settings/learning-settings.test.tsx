import { act } from 'react';

import { DEFAULT_V2_SYNC_STORAGE } from '@storage/v2/default';
import { createRoot, Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { LearningProfileConfirmation } from './learning-profile-confirmation';
import { SubtitleDisplayForm } from './subtitle-display-form';

describe('v2 learning settings components', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        disconnect() {}
        observe() {}
        unobserve() {}
      }
    );
  });

  beforeEach(() => {
    vi.mocked(chrome.i18n.getMessage).mockImplementation((key) => key);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  afterAll(() => vi.unstubAllGlobals());

  it('confirms learning and optional support languages without legacy role wording', async () => {
    const onConfirm = vi.fn();
    act(() =>
      root.render(
        <LearningProfileConfirmation
          value={DEFAULT_V2_SYNC_STORAGE.learningProfile}
          onConfirm={onConfirm}
        />
      )
    );

    expect(container.textContent).toContain('learning_profile_confirmation_title');
    expect(container.textContent).toContain('learning_language');
    expect(container.textContent).toContain('support_language');
    expect(container.textContent).toContain('no_support_language');
    expect(container.textContent).not.toContain('primary');
    expect(container.textContent).not.toContain('secondary');

    const selects = Array.from(container.querySelectorAll('select'));
    expect(selects).toHaveLength(2);
    expect(selects.map(({ value }) => value)).toEqual(['en', 'ko']);

    await act(async () => {
      selects[1].value = '';
      selects[1].dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    await act(async () => {
      container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(onConfirm).toHaveBeenCalledWith(
      { learningLanguage: 'en', supportLanguage: null },
      expect.anything()
    );
  });

  it('disables support display without clearing its canonical appearance', async () => {
    const onSubmit = vi.fn();
    const value = structuredClone(DEFAULT_V2_SYNC_STORAGE.subtitleDisplay);
    value.support.appearance = {
      ...value.support.appearance,
      color: '#123456',
      positionOffset: 137,
    };

    act(() =>
      root.render(
        <SubtitleDisplayForm
          learningProfile={{ learningLanguage: 'en', supportLanguage: null }}
          value={value}
          onSubmit={onSubmit}
        />
      )
    );

    const learning = getRoleFieldset(container, 'learning');
    const support = getRoleFieldset(container, 'support');
    expect(learning.disabled).toBe(false);
    expect(support.disabled).toBe(true);
    expect(support.getAttribute('aria-disabled')).toBe('true');
    expect(support.textContent).toContain('support_subtitle');
    expect(support.querySelector<HTMLInputElement>("input[type='color']")?.value).toBe('#123456');
    expect(support.querySelector<HTMLInputElement>("input[type='number']")?.value).toBe('137');
    expect(support.querySelectorAll('button[aria-expanded]')).toHaveLength(1);
    expect(support.querySelector<HTMLButtonElement>('button[aria-expanded]')?.matches(':disabled')).toBe(true);
    expect(
      [
        'position_reference',
        'position_offset',
        'subtitle_color',
        'subtitle_size',
        'font_weight',
        'background_opacity',
        'allow_line_break',
      ].every((label) => support.textContent?.includes(label))
    ).toBe(true);
    expect(container.textContent).not.toContain('primary');
    expect(container.textContent).not.toContain('secondary');

    await act(async () => {
      container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(onSubmit).toHaveBeenCalledWith(value, expect.anything());
  });
});

const getRoleFieldset = (container: HTMLElement, role: 'learning' | 'support') => {
  const fieldset = container.querySelector<HTMLFieldSetElement>(`fieldset[data-subtitle-role='${role}']`);
  if (!fieldset) throw new Error(`${role} subtitle fieldset not found`);
  return fieldset;
};
