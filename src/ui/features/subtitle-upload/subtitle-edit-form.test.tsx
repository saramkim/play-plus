import { act } from 'react';

import type { SubtitleId } from '@storage/subtitle';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { SubtitleEditForm } from './subtitle-edit-form';

const SUBTITLE_ID = 'subtitle-00000000-0000-4000-8000-000000000001' as SubtitleId;

describe('SubtitleEditForm', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));

  beforeEach(() => {
    vi.clearAllMocks();
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

  it('blocks duplicate submissions and disables every form control while pending', async () => {
    const deferred = createDeferred<void>();
    const closeEditMode = vi.fn();
    const onEdit = vi.fn(() => deferred.promise);
    renderForm(root, { closeEditMode, onEdit });

    const form = getForm(container);
    act(() => {
      submit(form);
      submit(form);
    });

    expect(onEdit).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledWith(SUBTITLE_ID, 'Original title', 'en');
    expect(form.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector('[role=status]')?.textContent).toBe('saving');
    expect(getTitleInput(container).disabled).toBe(true);
    expect(Array.from(container.querySelectorAll('button')).every((button) => button.disabled)).toBe(true);

    await act(async () => {
      deferred.resolve();
      await deferred.promise;
      await Promise.resolve();
    });

    expect(closeEditMode).toHaveBeenCalledOnce();
    expect(form.hasAttribute('aria-busy')).toBe(false);
    expect(getButton(container, 'save').disabled).toBe(false);
  });

  it('keeps the draft and editor open, exposes an inline error, and focuses Save after rejection', async () => {
    const closeEditMode = vi.fn();
    const onEdit = vi
      .fn<React.ComponentProps<typeof SubtitleEditForm>['onEdit']>()
      .mockRejectedValueOnce(new Error('Injected storage failure'))
      .mockResolvedValueOnce(undefined);
    renderForm(root, { closeEditMode, onEdit });

    const titleInput = getTitleInput(container);
    act(() => setInputValue(titleInput, 'Retained draft'));

    await act(async () => {
      submit(getForm(container));
      await Promise.resolve();
      await Promise.resolve();
    });

    const alert = container.querySelector<HTMLElement>('[role=alert]');
    const saveButton = getButton(container, 'save');
    expect(alert?.textContent).toBe('error_try_later');
    expect(getForm(container).getAttribute('aria-describedby')).toBe(alert?.id);
    expect(titleInput.value).toBe('Retained draft');
    expect(closeEditMode).not.toHaveBeenCalled();
    expect(saveButton.disabled).toBe(false);
    expect(document.activeElement).toBe(saveButton);

    await act(async () => {
      submit(getForm(container));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onEdit).toHaveBeenNthCalledWith(2, SUBTITLE_ID, 'Retained draft', 'en');
    expect(closeEditMode).toHaveBeenCalledOnce();
  });
});

function renderForm(
  root: Root,
  overrides: Partial<React.ComponentProps<typeof SubtitleEditForm>> = {}
) {
  act(() =>
    root.render(
      <SubtitleEditForm
        id={SUBTITLE_ID}
        initialTitle='Original title'
        initialLanguage='en'
        onEdit={async () => undefined}
        closeEditMode={() => undefined}
        {...overrides}
      />
    )
  );
}

const getForm = (container: HTMLElement) => {
  const form = container.querySelector('form');
  if (!form) throw new Error('Expected subtitle edit form');
  return form;
};

const getTitleInput = (container: HTMLElement) => {
  const input = container.querySelector<HTMLInputElement>("input[aria-label='subtitle_title']");
  if (!input) throw new Error('Expected subtitle title input');
  return input;
};

const getButton = (container: HTMLElement, accessibleName: string) => {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.getAttribute('aria-label') === accessibleName || candidate.textContent === accessibleName
  );
  if (!button) throw new Error(`Expected button: ${accessibleName}`);
  return button;
};

const setInputValue = (input: HTMLInputElement, value: string) => {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

const submit = (form: HTMLFormElement) => {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
};

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}
