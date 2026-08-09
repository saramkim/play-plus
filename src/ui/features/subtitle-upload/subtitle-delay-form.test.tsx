import { act } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { SubtitleDelayForm } from './subtitle-delay-form';
import { RegisteredSubtitleRefreshError } from './subtitle-mutation-error';

describe('SubtitleDelayForm', () => {
  let container: HTMLDivElement;
  let mounted: boolean;
  let root: Root;

  beforeAll(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chrome.i18n.getMessage).mockImplementation((key) => key);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    mounted = true;
  });

  afterEach(() => {
    if (mounted) act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  afterAll(() => vi.unstubAllGlobals());

  it('stops stepping, blocks duplicate submissions, and disables every form control while pending', async () => {
    vi.useFakeTimers();
    const deferred = createDeferred<void>();
    const onUpdateDelay = vi.fn(() => deferred.promise);
    renderForm(root, { onUpdateDelay });

    act(() => {
      getButton(container, 'v2_local_subtitles_increase_sync').dispatchEvent(
        new Event('pointerdown', { bubbles: true })
      );
    });
    expect(getDelayInput(container).value).toBe('0.1');
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    const form = getForm(container);
    act(() => {
      submit(form);
      submit(form);
    });

    expect(onUpdateDelay).toHaveBeenCalledOnce();
    expect(onUpdateDelay).toHaveBeenCalledWith(0.1);
    expect(vi.getTimerCount()).toBe(0);
    expect(form.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector('[role=status]')?.textContent).toBe('saving');
    expect(getDelayInput(container).disabled).toBe(true);
    expect(Array.from(container.querySelectorAll('button')).every((button) => button.disabled)).toBe(true);

    act(() => vi.advanceTimersByTime(1_000));
    expect(getDelayInput(container).value).toBe('0.1');

    await act(async () => {
      deferred.resolve();
      await deferred.promise;
      await Promise.resolve();
    });

    expect(form.hasAttribute('aria-busy')).toBe(false);
    expect(getButton(container, 'save').disabled).toBe(false);
  });

  it('cleans up a held-step timer when the form unmounts', () => {
    vi.useFakeTimers();
    renderForm(root);

    act(() => {
      getButton(container, 'v2_local_subtitles_increase_sync').dispatchEvent(
        new Event('pointerdown', { bubbles: true })
      );
    });
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    act(() => root.unmount());
    mounted = false;
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    ['ordinary mutation failure', new Error('Injected storage failure'), 'error_try_later'],
    [
      'refresh-only failure',
      new RegisteredSubtitleRefreshError(new Error('Injected refresh failure')),
      'v2_local_subtitles_refresh_error',
    ],
  ])('keeps the draft and focuses Save after %s', async (_name, failure, expectedMessage) => {
    const onUpdateDelay = vi
      .fn<React.ComponentProps<typeof SubtitleDelayForm>['onUpdateDelay']>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(undefined);
    renderForm(root, { initialDelay: 0.3, onUpdateDelay });

    const delayInput = getDelayInput(container);
    act(() => setInputValue(delayInput, '1.2'));

    await act(async () => {
      submit(getForm(container));
      await Promise.resolve();
      await Promise.resolve();
    });

    const alert = container.querySelector<HTMLElement>('[role=alert]');
    const saveButton = getButton(container, 'save');
    expect(alert?.textContent).toBe(expectedMessage);
    expect(getForm(container).getAttribute('aria-describedby')).toBe(alert?.id);
    expect(delayInput.value).toBe('1.2');
    expect(saveButton.disabled).toBe(false);
    expect(document.activeElement).toBe(saveButton);

    await act(async () => {
      submit(getForm(container));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onUpdateDelay).toHaveBeenNthCalledWith(2, 1.2);
    expect(container.querySelector('[role=alert]')).toBeNull();
  });
});

function renderForm(
  root: Root,
  overrides: Partial<React.ComponentProps<typeof SubtitleDelayForm>> = {}
) {
  act(() =>
    root.render(
      <SubtitleDelayForm
        initialDelay={0}
        onUpdateDelay={async () => undefined}
        closeEditMode={() => undefined}
        {...overrides}
      />
    )
  );
}

const getForm = (container: HTMLElement) => {
  const form = container.querySelector('form');
  if (!form) throw new Error('Expected subtitle delay form');
  return form;
};

const getDelayInput = (container: HTMLElement) => {
  const input = container.querySelector<HTMLInputElement>(
    "input[aria-label='v2_local_subtitles_sync_adjustment']"
  );
  if (!input) throw new Error('Expected subtitle delay input');
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
  input.dispatchEvent(new Event('change', { bubbles: true }));
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
