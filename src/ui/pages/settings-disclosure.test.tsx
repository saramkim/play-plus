import { act } from 'react';

import { DEFAULT_CONFIG } from '@storage/default';
import { createRoot, Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { useConfigStore } from '@/ui/store/config-store';

import { SubtitleSettingPage } from './subtitle-setting-page';
import { VideoSettingPage } from './video-setting-page';

describe('settings card disclosure', () => {
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
    useConfigStore.setState({ configs: DEFAULT_CONFIG, loading: false });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  afterAll(() => vi.unstubAllGlobals());

  it('opens only the primary subtitle card by default', () => {
    act(() => root.render(<SubtitleSettingPage />));

    const disclosureButtons = getDisclosureButtons(container);
    expect(disclosureButtons).toHaveLength(2);
    expect(disclosureButtons.map((button) => button.getAttribute('aria-expanded'))).toEqual(['true', 'false']);
    expect(getControlledRegion(disclosureButtons[0]).hidden).toBe(false);
    expect(getControlledRegion(disclosureButtons[1]).hidden).toBe(true);
  });

  it('keeps every video card collapsed until the user opens one', () => {
    act(() => root.render(<VideoSettingPage />));

    const disclosureButtons = getDisclosureButtons(container);
    expect(disclosureButtons).toHaveLength(5);
    expect(disclosureButtons.every((button) => button.getAttribute('aria-expanded') === 'false')).toBe(true);

    act(() => disclosureButtons[1].click());

    expect(disclosureButtons[1].getAttribute('aria-expanded')).toBe('true');
    expect(getControlledRegion(disclosureButtons[1]).hidden).toBe(false);
    expect(getControlledRegion(disclosureButtons[1]).getAttribute('aria-disabled')).toBe('true');
  });

  it('hides a dirty card disclosure until its changes are resolved', async () => {
    act(() => root.render(<VideoSettingPage />));

    const disclosureButton = getDisclosureButtons(container)[0];
    act(() => disclosureButton.click());

    const shortcutInput = getControlledRegion(disclosureButton).querySelector('input');
    expect(shortcutInput).not.toBeNull();

    await act(async () => {
      shortcutInput?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code: 'KeyQ' }));
      await Promise.resolve();
    });

    expect(shortcutInput?.value).toBe('KeyQ');
    expect(getDisclosureButtons(container)).toHaveLength(4);

    const cancelButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'cancel');
    expect(cancelButton).toBeDefined();
    act(() => cancelButton?.click());
    expect(getDisclosureButtons(container)).toHaveLength(5);
  });
});

const getDisclosureButtons = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>("[data-slot='form-header'] > button[aria-expanded]"));

const getControlledRegion = (button: HTMLButtonElement) => {
  const controlsId = button.getAttribute('aria-controls');
  const region = controlsId ? document.getElementById(controlsId) : null;
  if (!(region instanceof HTMLDivElement)) throw new Error('Disclosure region not found');
  return region;
};
