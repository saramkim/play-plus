import { act } from 'react';

import { DEFAULT_V2_SYNC_STORAGE } from '@storage/v2/default';
import { createRoot, Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { FirstEntry, V2_ONBOARDING_COMPLETE_KEY } from './first-entry';

describe('v2 first entry', () => {
  let container: HTMLDivElement;
  let root: Root;
  let syncValues: Record<string, unknown>;
  let localValues: Record<string, unknown>;

  beforeAll(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    syncValues = structuredClone(DEFAULT_V2_SYNC_STORAGE);
    localValues = { migrationState: createMigrationState() };
    chrome.storage.sync.get = vi.fn(
      async (keys?: string | string[] | null) => readKeys(syncValues, keys)
    ) as unknown as typeof chrome.storage.sync.get;
    vi.mocked(chrome.storage.sync.set).mockImplementation(async (items) => {
      Object.assign(syncValues, structuredClone(items));
    });
    chrome.storage.local.get = vi.fn(
      async (keys?: string | string[] | null) => readKeys(localValues, keys)
    ) as unknown as typeof chrome.storage.local.get;
    vi.mocked(chrome.storage.local.set).mockImplementation(async (items) => {
      Object.assign(localValues, structuredClone(items));
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  afterAll(() => vi.unstubAllGlobals());

  it('writes the marker and removes legacy Web Storage only after confirmation succeeds', async () => {
    localStorage.setItem('isOnboardingComplete', 'true');
    localStorage.setItem('page-store', 'legacy-page');
    localStorage.setItem('vite-ui-theme', 'dark');
    const migrationWrite = deferred<void>();
    vi.mocked(chrome.storage.local.set).mockImplementation(async (items) => {
      if (Object.prototype.hasOwnProperty.call(items, 'migrationState')) {
        await migrationWrite.promise;
      }
      Object.assign(localValues, structuredClone(items));
    });
    const completionSnapshot = vi.fn();
    await renderFirstEntry(root, container, () => {
      completionSnapshot({
        marker: localStorage.getItem(V2_ONBOARDING_COMPLETE_KEY),
        oldOnboarding: localStorage.getItem('isOnboardingComplete'),
        oldPage: localStorage.getItem('page-store'),
        theme: localStorage.getItem('vite-ui-theme'),
      });
    });
    let submit = getButton(container, 'confirm_languages');
    expect(submit.disabled).toBe(true);

    await act(async () => {
      container.querySelector<HTMLInputElement>("input[type='radio']")?.click();
      await Promise.resolve();
    });
    await vi.waitFor(() => expect(getButton(container, 'confirm_languages').disabled).toBe(false));
    submit = getButton(container, 'confirm_languages');
    act(() => submit.closest('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    await vi.waitFor(() => expect(chrome.storage.local.set).toHaveBeenCalled());

    expect(localStorage.getItem(V2_ONBOARDING_COMPLETE_KEY)).toBeNull();
    expect(localStorage.getItem('isOnboardingComplete')).toBe('true');
    expect(localStorage.getItem('page-store')).toBe('legacy-page');
    expect(localStorage.getItem('vite-ui-theme')).toBe('dark');
    expect(completionSnapshot).not.toHaveBeenCalled();

    await act(async () => migrationWrite.resolve());
    expect(localStorage.getItem(V2_ONBOARDING_COMPLETE_KEY)).toBe('true');
    expect(localStorage.getItem('isOnboardingComplete')).toBeNull();
    expect(localStorage.getItem('page-store')).toBeNull();
    expect(localStorage.getItem('vite-ui-theme')).toBe('dark');
    expect(completionSnapshot).toHaveBeenCalledWith({
      marker: 'true',
      oldOnboarding: null,
      oldPage: null,
      theme: 'dark',
    });
    expect((syncValues.shortcuts as typeof DEFAULT_V2_SYNC_STORAGE.shortcuts).saveCard).toBe('KeyS');
    expect((localValues.migrationState as ReturnType<typeof createMigrationState>).shortcutConfirmations).toEqual([]);
  });

  it('keeps legacy state and the new marker absent when confirmation persistence fails', async () => {
    localStorage.setItem('isOnboardingComplete', 'true');
    localStorage.setItem('page-store', 'legacy-page');
    localStorage.setItem('vite-ui-theme', 'system');
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('write failed'));
    const onComplete = vi.fn();
    await renderFirstEntry(root, container, onComplete);

    await act(async () => {
      container.querySelector<HTMLInputElement>("input[type='radio']")?.click();
      await Promise.resolve();
    });
    const submit = getButton(container, 'confirm_languages');
    await act(async () =>
      submit.closest('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    );

    expect(container.querySelector("[role='alert']")?.textContent).toContain(
      'v2_first_entry_load_error'
    );
    expect(localStorage.getItem(V2_ONBOARDING_COMPLETE_KEY)).toBeNull();
    expect(localStorage.getItem('isOnboardingComplete')).toBe('true');
    expect(localStorage.getItem('page-store')).toBe('legacy-page');
    expect(localStorage.getItem('vite-ui-theme')).toBe('system');
    expect(onComplete).not.toHaveBeenCalled();
  });
});

const createMigrationState = () => ({
  status: 'complete' as const,
  sourceVersion: '1.11.0' as const,
  shortcutConfirmations: [
    {
      field: 'saveCard' as const,
      candidates: [{ source: 'savePrimary' as const, shortcut: 'KeyS' }],
      reason: 'multiple-candidates' as const,
    },
  ],
  unavailableRegisteredSubtitles: [],
});

const readKeys = (
  values: Record<string, unknown>,
  keys?: string | string[] | null
) => {
  if (keys === undefined || keys === null) return structuredClone(values);
  const requested = Array.isArray(keys) ? keys : [keys];
  return Object.fromEntries(
    requested
      .filter((key) => Object.prototype.hasOwnProperty.call(values, key))
      .map((key) => [key, structuredClone(values[key])])
  );
};

const renderFirstEntry = async (
  root: Root,
  container: HTMLElement,
  onComplete: () => void | Promise<void>
) => {
  await act(async () => {
    root.render(<FirstEntry onComplete={onComplete} />);
    await Promise.resolve();
  });
  await vi.waitFor(() => expect(container.querySelector('form')).not.toBeNull());
};

const getButton = (scope: ParentNode, name: string) => {
  const button = Array.from(scope.querySelectorAll('button')).find(
    (candidate) => candidate.textContent === name || candidate.getAttribute('aria-label') === name
  );
  if (!button) throw new Error(`Expected button: ${name}`);
  return button;
};

const deferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};
