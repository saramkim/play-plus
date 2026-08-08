import { act } from 'react';

import { DEFAULT_V2_SYNC_STORAGE } from '@storage/v2/default';
import { createRoot, Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { LearningProfileConfirmation } from './learning-profile-confirmation';
import { LearningProfileForm } from './learning-profile-form';
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
    await act(async () =>
      root.render(
        <LearningProfileConfirmation
          value={DEFAULT_V2_SYNC_STORAGE.learningProfile}
          onConfirm={onConfirm}
        />
      )
    );
    await act(async () => Promise.resolve());

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

  it('keeps the language Edit action in the summary heading and restores focus after Cancel', async () => {
    const onSubmit = vi.fn();
    await act(async () => {
      root.render(
        <LearningProfileForm
          settingsPresentation
          submitRequiresDirty
          value={DEFAULT_V2_SYNC_STORAGE.learningProfile}
          onSubmit={onSubmit}
        />
      );
      await Promise.resolve();
    });

    const form = getForm(container);
    const header = form.querySelector<HTMLElement>("[data-slot='form-header']");
    if (!header) throw new Error('Profile header not found');
    const edit = getButtonByText(header, 'edit');
    expect(header.querySelector('h2')?.textContent).toBe('learning_languages');
    expect(form.querySelectorAll('select')).toHaveLength(0);
    expect(form.textContent).toContain('english');
    expect(form.textContent).toContain('korean');

    act(() => edit.click());
    const selects = Array.from(form.querySelectorAll<HTMLSelectElement>('select'));
    expect(selects).toHaveLength(2);
    expect(document.activeElement).toBe(selects[0]);

    await act(async () => {
      selects[0].value = 'ja';
      selects[0].dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });
    expect(getSubmitButton(form).disabled).toBe(false);

    act(() => getButtonByText(form, 'cancel').click());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(form.querySelectorAll('select')).toHaveLength(0);
    expect(form.textContent).toContain('english');
    expect(document.activeElement).toBe(getButtonByText(form, 'edit'));
  });

  it('preserves a profile draft through a pending failure and retry', async () => {
    const failedSave = createDeferred<void>();
    const onSubmit = vi
      .fn()
      .mockImplementationOnce(() => failedSave.promise)
      .mockImplementationOnce(async () => undefined);
    await act(async () => {
      root.render(
        <LearningProfileForm
          settingsPresentation
          submitRequiresDirty
          value={DEFAULT_V2_SYNC_STORAGE.learningProfile}
          onSubmit={onSubmit}
        />
      );
      await Promise.resolve();
    });

    const form = getForm(container);
    act(() => getButtonByText(form, 'edit').click());
    const learningLanguage = form.querySelector<HTMLSelectElement>('select');
    if (!learningLanguage) throw new Error('Learning language select not found');
    await act(async () => {
      learningLanguage.value = 'ja';
      learningLanguage.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });
    const save = getSubmitButton(form);
    await act(async () => {
      save.click();
      await Promise.resolve();
    });
    expect(form.getAttribute('aria-busy')).toBe('true');
    expect(save.disabled).toBe(true);
    expect(learningLanguage.disabled).toBe(false);

    await act(async () => {
      learningLanguage.value = 'es';
      learningLanguage.dispatchEvent(new Event('change', { bubbles: true }));
      failedSave.reject(new Error('Injected failure'));
      await failedSave.promise.catch(() => undefined);
      await Promise.resolve();
    });
    expect(learningLanguage.value).toBe('es');
    expect(form.querySelector('[role=alert]')?.textContent).toBe('error_try_later');
    expect(save.disabled).toBe(false);

    await act(async () => {
      save.click();
      await Promise.resolve();
    });
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(form.querySelectorAll('select')).toHaveLength(0);
    expect(form.textContent).toContain('spanish');
    expect(document.activeElement).toBe(getButtonByText(form, 'edit'));
  });

  it('keeps a different external profile that arrives while a save is pending', async () => {
    const pendingSave = createDeferred<void>();
    const onSubmit = vi.fn(() => pendingSave.promise);
    const initialValue = structuredClone(DEFAULT_V2_SYNC_STORAGE.learningProfile);
    await act(async () => {
      root.render(
        <LearningProfileForm
          settingsPresentation
          submitRequiresDirty
          value={initialValue}
          onSubmit={onSubmit}
        />
      );
      await Promise.resolve();
    });

    const form = getForm(container);
    act(() => getButtonByText(form, 'edit').click());
    const learningLanguage = form.querySelector<HTMLSelectElement>('select');
    if (!learningLanguage) throw new Error('Learning language select not found');
    await act(async () => {
      learningLanguage.value = 'ja';
      learningLanguage.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
      getSubmitButton(form).click();
      await Promise.resolve();
    });

    const externalValue = { ...initialValue, learningLanguage: 'fr' as const };
    await act(async () => {
      root.render(
        <LearningProfileForm
          settingsPresentation
          submitRequiresDirty
          value={externalValue}
          onSubmit={onSubmit}
        />
      );
      await Promise.resolve();
    });
    expect(learningLanguage.value).toBe('fr');

    await act(async () => {
      pendingSave.resolve();
      await pendingSave.promise;
      await Promise.resolve();
    });
    expect(learningLanguage.value).toBe('fr');
    expect(getSubmitButton(form).disabled).toBe(true);

    act(() => getButtonByText(form, 'cancel').click());
    expect(form.textContent).toContain('french');
    expect(form.textContent).not.toContain('japanese');
  });

  it('does not restore a stale profile error when a superseded save later rejects', async () => {
    const pendingSave = createDeferred<void>();
    const onSubmit = vi.fn(() => pendingSave.promise);
    const initialValue = structuredClone(DEFAULT_V2_SYNC_STORAGE.learningProfile);
    await act(async () => {
      root.render(
        <LearningProfileForm
          settingsPresentation
          submitRequiresDirty
          value={initialValue}
          onSubmit={onSubmit}
        />
      );
      await Promise.resolve();
    });

    const form = getForm(container);
    act(() => getButtonByText(form, 'edit').click());
    const learningLanguage = form.querySelector<HTMLSelectElement>('select');
    if (!learningLanguage) throw new Error('Learning language select not found');
    await act(async () => {
      learningLanguage.value = 'ja';
      learningLanguage.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
      getSubmitButton(form).click();
      await Promise.resolve();
    });

    const externalValue = { ...initialValue, learningLanguage: 'fr' as const };
    await act(async () => {
      root.render(
        <LearningProfileForm
          settingsPresentation
          submitRequiresDirty
          value={externalValue}
          onSubmit={onSubmit}
        />
      );
      await Promise.resolve();
    });

    await act(async () => {
      pendingSave.reject(new Error('Superseded failure'));
      await pendingSave.promise.catch(() => undefined);
      await Promise.resolve();
    });
    expect(form.querySelector('[role=alert]')).toBeNull();
    expect(learningLanguage.value).toBe('fr');
    expect(getSubmitButton(form).disabled).toBe(true);
  });

  it('disables support display without clearing its canonical appearance', async () => {
    const onSubmit = vi.fn();
    const value = structuredClone(DEFAULT_V2_SYNC_STORAGE.subtitleDisplay);
    value.support.appearance = {
      ...value.support.appearance,
      color: '#123456',
      positionOffset: 137,
    };

    await act(async () =>
      root.render(
        <SubtitleDisplayForm
          learningProfile={{ learningLanguage: 'en', supportLanguage: null }}
          value={value}
          onSubmit={onSubmit}
        />
      )
    );
    await act(async () => Promise.resolve());

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

    expect(getSubmitButton(container).disabled).toBe(true);
    const learningVisibility = learning.querySelector<HTMLButtonElement>("button[role='switch']");
    if (!learningVisibility) throw new Error('Learning visibility switch not found');
    act(() => learningVisibility.click());
    await vi.waitFor(() => expect(getSubmitButton(container).disabled).toBe(false));

    await act(async () => {
      getSubmitButton(container).click();
      await Promise.resolve();
    });

    expect(onSubmit).toHaveBeenCalledWith(
      { ...value, learning: { ...value.learning, visibility: 'hidden' } },
      expect.anything()
    );
  });

  it('marks and reverts every learning subtitle appearance input as dirty', async () => {
    const value = structuredClone(DEFAULT_V2_SYNC_STORAGE.subtitleDisplay);
    await act(async () => {
      root.render(
        <SubtitleDisplayForm
          learningProfile={DEFAULT_V2_SYNC_STORAGE.learningProfile}
          value={value}
          onSubmit={vi.fn()}
        />
      );
      await Promise.resolve();
    });

    const learning = getRoleFieldset(container, 'learning');
    const save = getSubmitButton(container);
    const disclosure = learning.querySelector<HTMLButtonElement>('button[aria-expanded]');
    if (!disclosure) throw new Error('Learning appearance disclosure not found');
    act(() => disclosure.click());

    const visibility = learning.querySelector<HTMLButtonElement>("button[role='switch']");
    const top = learning.querySelector<HTMLButtonElement>("button[aria-label='top']");
    const bottom = learning.querySelector<HTMLButtonElement>("button[aria-label='bottom']");
    const offset = learning.querySelector<HTMLInputElement>("input[type='number']");
    const color = learning.querySelector<HTMLInputElement>("input[type='color']");
    const sliders = Array.from(learning.querySelectorAll<HTMLElement>("[role='slider']"));
    const lineBreak = learning.querySelector<HTMLButtonElement>("button[aria-label='allow_line_break']");
    if (!visibility || !top || !bottom || !offset || !color || !lineBreak) {
      throw new Error('Expected all learning appearance controls');
    }
    expect(sliders).toHaveLength(3);

    await expectDirtyThenClean('visibility', save, () => visibility.click(), () => visibility.click());
    await expectDirtyThenClean('position reference', save, () => top.click(), () => bottom.click());
    await expectDirtyThenClean(
      'position offset',
      save,
      () => dispatchInput(offset, '181'),
      () => dispatchInput(offset, '180')
    );
    await expectDirtyThenClean(
      'color',
      save,
      () => dispatchInput(color, '#000000'),
      () => dispatchInput(color, '#ffffff')
    );
    for (const [index, slider] of sliders.entries()) {
      await expectDirtyThenClean(
        `slider ${index}`,
        save,
        () => dispatchSliderKey(slider, 'ArrowRight'),
        () => dispatchSliderKey(slider, 'ArrowLeft')
      );
    }
    await expectDirtyThenClean('line break', save, () => lineBreak.click(), () => lineBreak.click());
  });

  it('keeps a different external subtitle display that arrives while a save is pending', async () => {
    const pendingSave = createDeferred<void>();
    const onSubmit = vi.fn(() => pendingSave.promise);
    const initialValue = structuredClone(DEFAULT_V2_SYNC_STORAGE.subtitleDisplay);
    await act(async () => {
      root.render(
        <SubtitleDisplayForm
          learningProfile={DEFAULT_V2_SYNC_STORAGE.learningProfile}
          value={initialValue}
          onSubmit={onSubmit}
        />
      );
      await Promise.resolve();
    });

    const learning = getRoleFieldset(container, 'learning');
    const learningVisibility = learning.querySelector<HTMLButtonElement>("button[role='switch']");
    const color = learning.querySelector<HTMLInputElement>("input[type='color']");
    if (!learningVisibility || !color) throw new Error('Expected learning subtitle controls');
    act(() => learningVisibility.click());
    await vi.waitFor(() => expect(getSubmitButton(container).disabled).toBe(false));
    await act(async () => {
      getSubmitButton(container).click();
      await Promise.resolve();
    });

    const externalValue = structuredClone(initialValue);
    externalValue.learning.appearance.color = '#123456';
    await act(async () => {
      root.render(
        <SubtitleDisplayForm
          learningProfile={DEFAULT_V2_SYNC_STORAGE.learningProfile}
          value={externalValue}
          onSubmit={onSubmit}
        />
      );
      await Promise.resolve();
    });
    expect(learningVisibility.getAttribute('data-state')).toBe('checked');
    expect(color.value).toBe('#123456');

    await act(async () => {
      pendingSave.resolve();
      await pendingSave.promise;
      await Promise.resolve();
    });
    expect(learningVisibility.getAttribute('data-state')).toBe('checked');
    expect(color.value).toBe('#123456');
    expect(getSubmitButton(container).disabled).toBe(true);
  });

  it('does not restore a stale subtitle error when a superseded save later rejects', async () => {
    const pendingSave = createDeferred<void>();
    const onSubmit = vi.fn(() => pendingSave.promise);
    const initialValue = structuredClone(DEFAULT_V2_SYNC_STORAGE.subtitleDisplay);
    await act(async () => {
      root.render(
        <SubtitleDisplayForm
          learningProfile={DEFAULT_V2_SYNC_STORAGE.learningProfile}
          value={initialValue}
          onSubmit={onSubmit}
        />
      );
      await Promise.resolve();
    });

    const learning = getRoleFieldset(container, 'learning');
    const learningVisibility = learning.querySelector<HTMLButtonElement>("button[role='switch']");
    const color = learning.querySelector<HTMLInputElement>("input[type='color']");
    if (!learningVisibility || !color) throw new Error('Expected learning subtitle controls');
    act(() => learningVisibility.click());
    await vi.waitFor(() => expect(getSubmitButton(container).disabled).toBe(false));
    await act(async () => {
      getSubmitButton(container).click();
      await Promise.resolve();
    });

    const externalValue = structuredClone(initialValue);
    externalValue.learning.appearance.color = '#123456';
    await act(async () => {
      root.render(
        <SubtitleDisplayForm
          learningProfile={DEFAULT_V2_SYNC_STORAGE.learningProfile}
          value={externalValue}
          onSubmit={onSubmit}
        />
      );
      await Promise.resolve();
    });

    await act(async () => {
      pendingSave.reject(new Error('Superseded failure'));
      await pendingSave.promise.catch(() => undefined);
      await Promise.resolve();
    });
    expect(container.querySelector('[role=alert]')).toBeNull();
    expect(learningVisibility.getAttribute('data-state')).toBe('checked');
    expect(color.value).toBe('#123456');
    expect(getSubmitButton(container).disabled).toBe(true);
  });
});

const getRoleFieldset = (container: HTMLElement, role: 'learning' | 'support') => {
  const fieldset = container.querySelector<HTMLFieldSetElement>(`fieldset[data-subtitle-role='${role}']`);
  if (!fieldset) throw new Error(`${role} subtitle fieldset not found`);
  return fieldset;
};

const getForm = (container: HTMLElement) => {
  const form = container.querySelector('form');
  if (!form) throw new Error('Form not found');
  return form;
};

const getSubmitButton = (container: HTMLElement) => {
  const button = container.querySelector<HTMLButtonElement>("button[type='submit']");
  if (!button) throw new Error('Submit button not found');
  return button;
};

const getButtonByText = (container: HTMLElement, text: string) => {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) => candidate.textContent === text
  );
  if (!button) throw new Error(`Button not found: ${text}`);
  return button;
};

const dispatchInput = (input: HTMLInputElement, value: string) => {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
};

const dispatchSliderKey = (slider: HTMLElement, key: 'ArrowLeft' | 'ArrowRight') => {
  slider.focus();
  slider.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, code: key, key }));
};

const expectDirtyThenClean = async (
  label: string,
  save: HTMLButtonElement,
  change: () => void,
  revert: () => void
) => {
  await act(async () => {
    change();
    await Promise.resolve();
  });
  await vi.waitFor(() => expect(save.disabled, `${label} should be dirty`).toBe(false));
  await act(async () => {
    revert();
    await Promise.resolve();
  });
  await vi.waitFor(() => expect(save.disabled, `${label} should return to clean`).toBe(true));
};

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}
