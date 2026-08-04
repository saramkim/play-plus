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

  it('lets Tab and Shift+Tab leave a shortcut input without changing its draft', async () => {
    const store = createLearningSettingsStore(createStorage());
    store.setState({
      shortcuts: { ...DEFAULT_V2_SYNC_STORAGE.shortcuts, enabled: true },
    });
    await act(async () => {
      root.render(<LearningSettingsPage store={store} />);
      await Promise.resolve();
    });

    const shortcut = getInput(container, 'v2_save_learning_card shortcuts');
    const previousControl = getButton(container, 'shortcuts');
    const nextControl = getInput(container, 'v2_previous_learning_cue shortcuts');
    const originalValue = shortcut.value;

    const tab = dispatchTabWithBrowserFocus(shortcut, nextControl);
    expect(tab.defaultPrevented).toBe(false);
    expect(shortcut.value).toBe(originalValue);
    expect(document.activeElement).toBe(nextControl);

    const shiftTab = dispatchTabWithBrowserFocus(shortcut, previousControl, true);
    expect(shiftTab.defaultPrevented).toBe(false);
    expect(shortcut.value).toBe(originalValue);
    expect(document.activeElement).toBe(previousControl);
  });
});

const createStorage = (): V2SyncStorageApi => {
  const get = async <K extends V2SyncStorageKey>(key: K): Promise<V2SyncStorage[K]> =>
    structuredClone(DEFAULT_V2_SYNC_STORAGE[key]);
  return {
    get,
    getAll: async () => structuredClone(DEFAULT_V2_SYNC_STORAGE),
    set: async () => undefined,
    setMany: async () => undefined,
    subscribe: () => ({ remove: () => undefined }),
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

const getInput = (container: HTMLElement, name: string) => {
  const input = container.querySelector<HTMLInputElement>(`input[aria-label='${name}']`);
  if (!input) throw new Error(`Expected input: ${name}`);
  return input;
};
