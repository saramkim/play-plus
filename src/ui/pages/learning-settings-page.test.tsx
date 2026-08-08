import { act } from 'react';

import { DEFAULT_V2_SYNC_STORAGE } from '@storage/v2/default';
import { V2SyncStorageApi, V2SyncStorageKey } from '@storage/v2/sync-storage';
import { V2SyncStorage } from '@storage/v2/type';
import { createRoot, Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createLearningSettingsStore } from '@/ui/features/learning-settings/learning-settings-store';

import { LearningSettingsPage } from './learning-settings-page';

vi.mock('@/ui/features/subtitle/use-subtitle-settings', () => ({
  useSubtitleSettings: () => ({ useAsSubtitle: vi.fn(async () => true) }),
}));

vi.mock('@/ui/store/tab-store', () => ({
  useTabStore: (selector: (state: { activeTab: null; tabInfo: null }) => unknown) =>
    selector({ activeTab: null, tabInfo: null }),
}));

describe('LearningSettingsPage', () => {
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
    vi.mocked(chrome.i18n.getMessage).mockImplementation((key, substitutions) => {
      const values = Array.isArray(substitutions) ? substitutions : [substitutions];
      if (key === 'v2_shortcut_conflict_error') return `${key}:${values[0] ?? ''}`;
      if (key === 'v2_shortcut_capture_label') return `Shortcut for ${values[0]}: ${values[1]}`;
      if (key === 'v2_shortcut_unassigned') return 'Unassigned';
      return key;
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) act(() => root.unmount());
    container?.remove();
  });

  afterAll(() => vi.unstubAllGlobals());

  it('puts Edit beside the language heading and removes per-action playback controls', async () => {
    const store = createLearningSettingsStore(createStorage());
    await renderPage(root, store);

    const scrollOwners = container.querySelectorAll<HTMLElement>("[data-scroll-owner='learning-settings']");
    expect(scrollOwners).toHaveLength(1);
    const forms = Array.from(container.querySelectorAll('form'));
    expect(forms).toHaveLength(3);

    const profileHeader = forms[0].querySelector<HTMLElement>("[data-slot='form-header']");
    expect(profileHeader?.querySelector('h2')?.textContent).toBe('learning_languages');
    expect(profileHeader?.querySelector('button')?.textContent).toBe('edit');
    expect(forms[0].querySelectorAll('select')).toHaveLength(0);
    expect(
      Array.from(container.querySelectorAll('h2')).filter(({ textContent }) => textContent === 'learning_languages')
    ).toHaveLength(1);
    expect(container.textContent).not.toContain('v2_learning_playback_controls');

    const shortcutForm = forms[2];
    expect(Array.from(shortcutForm.querySelectorAll('h2, h3')).map(({ textContent }) => textContent)).toEqual([
      'shortcuts',
      'playback_speed',
    ]);
    expect(shortcutForm.querySelectorAll("[data-slot='switch']")).toHaveLength(2);
    expect(shortcutForm.querySelectorAll("input[type='checkbox']")).toHaveLength(2);
    const shortcutCaptures = Array.from(
      shortcutForm.querySelectorAll<HTMLButtonElement>("button[data-slot='shortcut-capture']")
    );
    expect(shortcutCaptures).toHaveLength(7);
    expect(shortcutCaptures.every(({ classList }) => classList.contains('w-28') && classList.contains('shrink-0'))).toBe(
      true
    );
    expect(shortcutCaptures.every((capture) => capture.closest('label')?.classList.contains('min-w-0'))).toBe(true);
    expect(shortcutForm.textContent).toContain('v2_shortcut_capture_hint');

    const cueInputs = [
      getShortcutControl(container, 'v2_previous_learning_cue shortcuts'),
      getShortcutControl(container, 'v2_next_learning_cue shortcuts'),
      getShortcutControl(container, 'v2_repeat_current_learning_cue shortcuts'),
    ];
    expect(cueInputs.every(({ disabled }) => disabled)).toBe(true);
    act(() => getButton(container, 'shortcuts').click());
    expect(cueInputs.every(({ disabled }) => !disabled)).toBe(true);

    act(() => getButtonByText(profileHeader ?? container, 'edit').click());
    const selects = forms[0].querySelectorAll('select');
    expect(selects).toHaveLength(2);
    expect(document.activeElement).toBe(selects[0]);
  });

  it('formats key labels while preserving raw event.code for shifted symbols', async () => {
    const setMany = vi.fn(async () => undefined);
    const store = createLearningSettingsStore(createStorage({ setMany }));
    await renderPage(root, store);

    const shortcutForm = Array.from(container.querySelectorAll('form'))[2];
    const save = getSubmitButton(shortcutForm);
    const previous = getShortcutControl(container, 'v2_previous_learning_cue shortcuts');
    expect(previous.value).toBe('←');
    expect(save.disabled).toBe(true);

    act(() => getButton(container, 'shortcuts').click());
    act(() => dispatchShortcut(previous, 'KeyA', 'a'));
    expect(previous.value).toBe('A');
    act(() => dispatchShortcut(previous, 'Digit1', '!', true));
    expect(previous.value).toBe('1');
    await vi.waitFor(() => expect(save.disabled).toBe(false));

    await act(async () => {
      save.click();
      await Promise.resolve();
    });

    expect(setMany).toHaveBeenCalledWith({
      playbackSpeed: DEFAULT_V2_SYNC_STORAGE.playbackSpeed,
      shortcuts: {
        ...DEFAULT_V2_SYNC_STORAGE.shortcuts,
        enabled: true,
        previousCue: 'Digit1',
      },
    });
    await vi.waitFor(() => expect(save.disabled).toBe(true));
  });

  it('exposes the friendly value in the accessible name and contains long visual labels', async () => {
    const store = createLearningSettingsStore(createStorage());
    store.setState({ shortcuts: { ...DEFAULT_V2_SYNC_STORAGE.shortcuts, enabled: true } });
    await renderPage(root, store);

    const saveCard = getShortcutControl(container, 'v2_save_learning_card shortcuts');
    const previous = getShortcutControl(container, 'v2_previous_learning_cue shortcuts');
    expect(saveCard.getAttribute('aria-label')).toBe('Shortcut for v2_save_learning_card: Unassigned');
    expect(saveCard.title).toBe('Unassigned');
    expect(previous.getAttribute('aria-label')).toBe('Shortcut for v2_previous_learning_cue: ←');

    act(() => dispatchShortcut(saveCard, 'LaunchAssistantPanel'));
    expect(saveCard.value).toBe('Launch Assistant Panel');
    expect(saveCard.title).toBe('Launch Assistant Panel');
    expect(saveCard.getAttribute('aria-label')).toBe(
      'Shortcut for v2_save_learning_card: Launch Assistant Panel'
    );
    expect(saveCard.classList.contains('overflow-hidden')).toBe(true);
    const visualValue = saveCard.querySelector<HTMLElement>("[data-slot='shortcut-capture-value']");
    expect(visualValue?.textContent).toBe('Launch Assistant Panel');
    expect(visualValue?.classList.contains('truncate')).toBe(true);
    expect(visualValue?.classList.contains('min-w-0')).toBe(true);
    expect(visualValue?.classList.contains('max-w-full')).toBe(true);
  });

  it('explains duplicate and reserved keys on the affected fields', async () => {
    const store = createLearningSettingsStore(createStorage());
    await renderPage(root, store);

    const shortcutForm = Array.from(container.querySelectorAll('form'))[2];
    const save = getSubmitButton(shortcutForm);
    const saveCard = getShortcutControl(container, 'v2_save_learning_card shortcuts');
    const previous = getShortcutControl(container, 'v2_previous_learning_cue shortcuts');
    act(() => getButton(container, 'shortcuts').click());
    expect(save.disabled).toBe(false);

    act(() => dispatchShortcut(saveCard, 'ArrowLeft'));
    expect(saveCard.getAttribute('aria-invalid')).toBe('true');
    expect(previous.getAttribute('aria-invalid')).toBe('true');
    expect(shortcutForm.querySelectorAll('[role=alert]')).toHaveLength(2);
    expect(shortcutForm.textContent).toContain('v2_shortcut_conflict_error:v2_previous_learning_cue');
    expect(shortcutForm.textContent).toContain('v2_shortcut_conflict_error:v2_save_learning_card');
    expect(save.disabled).toBe(true);

    act(() => dispatchShortcut(saveCard, 'Backspace'));
    expect(saveCard.value).toBe('');
    expect(saveCard.getAttribute('aria-invalid')).toBeNull();
    expect(previous.getAttribute('aria-invalid')).toBeNull();
    expect(save.disabled).toBe(false);

    act(() => dispatchShortcut(saveCard, 'Space', ' '));
    expect(saveCard.getAttribute('aria-invalid')).toBe('true');
    expect(saveCard.getAttribute('aria-describedby')).toBeTruthy();
    expect(shortcutForm.textContent).toContain('v2_shortcut_reserved_error');
    expect(save.disabled).toBe(true);
  });

  it('lets Tab leave a formatted shortcut input without changing its raw draft', async () => {
    const store = createLearningSettingsStore(createStorage());
    store.setState({ shortcuts: { ...DEFAULT_V2_SYNC_STORAGE.shortcuts, enabled: true } });
    await renderPage(root, store);

    const shortcut = getShortcutControl(container, 'v2_save_learning_card shortcuts');
    const previousControl = getButton(container, 'shortcuts');
    const nextControl = getShortcutControl(container, 'v2_previous_learning_cue shortcuts');
    const originalValue = shortcut.value;

    const tab = dispatchTabWithBrowserFocus(shortcut, nextControl);
    expect(tab.defaultPrevented).toBe(false);
    expect(shortcut.value).toBe(originalValue);
    expect(document.activeElement).toBe(nextControl);

    const shiftTab = dispatchTabWithBrowserFocus(shortcut, previousControl, true);
    expect(shiftTab.defaultPrevented).toBe(false);
    expect(shortcut.value).toBe(originalValue);
    expect(document.activeElement).toBe(previousControl);

    let divergentKey!: KeyboardEvent;
    act(() => {
      divergentKey = dispatchShortcut(shortcut, 'KeyA', 'Tab');
    });
    expect(divergentKey.defaultPrevented).toBe(true);
    expect(shortcut.value).toBe('A');
  });

  it('adopts an independent external shortcut update and clears dirty failure state', async () => {
    const store = createLearningSettingsStore(
      createStorage({ setMany: vi.fn(async () => Promise.reject(new Error('Injected failure'))) })
    );
    await renderPage(root, store);

    const shortcutForm = Array.from(container.querySelectorAll('form'))[2];
    const save = getSubmitButton(shortcutForm);
    const shortcutMaster = getButton(container, 'shortcuts');
    const saveCard = getShortcutControl(container, 'v2_save_learning_card shortcuts');
    act(() => shortcutMaster.click());
    await vi.waitFor(() => expect(save.disabled).toBe(false));

    await act(async () => {
      save.click();
      await Promise.resolve();
    });
    expect(shortcutForm.querySelector('[role=alert]')?.textContent).toBe('error_try_later');

    act(() => {
      store.setState({
        shortcuts: { ...DEFAULT_V2_SYNC_STORAGE.shortcuts, enabled: true, saveCard: 'KeyA' },
      });
    });
    await vi.waitFor(() => expect(saveCard.value).toBe('A'));
    expect(shortcutMaster.getAttribute('data-state')).toBe('checked');
    expect(shortcutForm.querySelector('[role=alert]')).toBeNull();
    expect(save.disabled).toBe(true);
  });

  it('does not restore a stale shortcut error when a superseded save later rejects', async () => {
    const pendingSave = createDeferred<void>();
    const store = createLearningSettingsStore(
      createStorage({ setMany: vi.fn(() => pendingSave.promise) })
    );
    await renderPage(root, store);

    const shortcutForm = Array.from(container.querySelectorAll('form'))[2];
    const save = getSubmitButton(shortcutForm);
    const shortcutMaster = getButton(container, 'shortcuts');
    const saveCard = getShortcutControl(container, 'v2_save_learning_card shortcuts');
    act(() => shortcutMaster.click());
    await vi.waitFor(() => expect(save.disabled).toBe(false));
    await act(async () => {
      save.click();
      await Promise.resolve();
    });

    act(() => {
      store.setState({
        shortcuts: { ...DEFAULT_V2_SYNC_STORAGE.shortcuts, enabled: true, saveCard: 'KeyA' },
      });
    });
    await vi.waitFor(() => expect(saveCard.value).toBe('A'));

    await act(async () => {
      pendingSave.reject(new Error('Superseded failure'));
      await pendingSave.promise.catch(() => undefined);
      await Promise.resolve();
    });
    expect(shortcutForm.querySelector('[role=alert]')).toBeNull();
    expect(saveCard.value).toBe('A');
    expect(save.disabled).toBe(true);
  });

  it('preserves pending edits through failure, retry, and the submitted storage echo', async () => {
    const firstSave = createDeferred<void>();
    const secondSave = createDeferred<void>();
    const setMany = vi
      .fn()
      .mockImplementationOnce(() => firstSave.promise)
      .mockImplementationOnce(() => secondSave.promise);
    const store = createLearningSettingsStore(createStorage({ setMany }));
    await renderPage(root, store);

    const shortcutForm = Array.from(container.querySelectorAll('form'))[2];
    const save = getSubmitButton(shortcutForm);
    const shortcutMaster = getButton(container, 'shortcuts');
    const speedMaster = getButton(container, 'playback_speed');
    act(() => shortcutMaster.click());

    await act(async () => {
      save.click();
      await Promise.resolve();
    });
    expect(shortcutForm.getAttribute('aria-busy')).toBe('true');
    expect(save.disabled).toBe(true);
    expect(save.textContent).toContain('saving');
    act(() => speedMaster.click());

    await act(async () => {
      firstSave.reject(new Error('Injected failure'));
      await firstSave.promise.catch(() => undefined);
      await Promise.resolve();
    });
    expect(shortcutForm.getAttribute('aria-busy')).toBeNull();
    expect(shortcutForm.querySelector('[role=alert]')?.textContent).toBe('error_try_later');
    expect(shortcutMaster.getAttribute('data-state')).toBe('checked');
    expect(speedMaster.getAttribute('data-state')).toBe('checked');
    expect(save.disabled).toBe(false);

    await act(async () => {
      save.click();
      await Promise.resolve();
    });
    act(() => speedMaster.click());
    await act(async () => {
      secondSave.resolve();
      await secondSave.promise;
      await Promise.resolve();
    });
    expect(speedMaster.getAttribute('data-state')).toBe('unchecked');
    await vi.waitFor(() => expect(save.disabled).toBe(false));

    act(() => speedMaster.click());
    await vi.waitFor(() => expect(save.disabled).toBe(true));
  });
});

const renderPage = async (root: Root, store: ReturnType<typeof createLearningSettingsStore>) => {
  await act(async () => {
    root.render(<LearningSettingsPage store={store} />);
    await Promise.resolve();
  });
};

const createStorage = (overrides: Partial<V2SyncStorageApi> = {}): V2SyncStorageApi => {
  const get = async <K extends V2SyncStorageKey>(key: K): Promise<V2SyncStorage[K]> =>
    structuredClone(DEFAULT_V2_SYNC_STORAGE[key]);
  return {
    get,
    getAll: async () => structuredClone(DEFAULT_V2_SYNC_STORAGE),
    set: async () => undefined,
    setMany: async () => undefined,
    subscribe: () => ({ remove: () => undefined }),
    ...overrides,
  };
};

const dispatchTabWithBrowserFocus = (from: HTMLElement, to: HTMLElement, shiftKey = false) => {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    code: 'Tab',
    key: 'Tab',
    shiftKey,
  });
  act(() => {
    from.focus();
    if (from.dispatchEvent(event)) to.focus();
  });
  return event;
};

const getButton = (container: HTMLElement, name: string) => {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) => candidate.getAttribute('aria-label') === name
  );
  if (!button) throw new Error(`Expected button: ${name}`);
  return button;
};

const getButtonByText = (container: HTMLElement, text: string) => {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) => candidate.textContent === text
  );
  if (!button) throw new Error(`Expected button: ${text}`);
  return button;
};

const getShortcutControl = (container: HTMLElement, name: string) => {
  const action = name.replace(/ shortcuts$/, '');
  const control = Array.from(
    container.querySelectorAll<HTMLButtonElement>("button[data-slot='shortcut-capture']")
  ).find((candidate) => candidate.closest('label')?.firstElementChild?.textContent === action);
  if (!control) throw new Error(`Expected shortcut control: ${name}`);
  return control;
};

const dispatchShortcut = (control: HTMLElement, code: string, key = code, shiftKey = false) => {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, code, key, shiftKey });
  control.dispatchEvent(event);
  return event;
};

const getSubmitButton = (container: HTMLElement) => {
  const button = container.querySelector<HTMLButtonElement>("button[type='submit']");
  if (!button) throw new Error('Submit button not found');
  return button;
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
