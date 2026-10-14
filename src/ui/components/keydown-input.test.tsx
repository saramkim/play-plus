import { act } from 'react';

import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KeydownInput } from './keydown-input';

let root: Root;
let container: HTMLDivElement;
const onChange = vi.fn();
const render = (value: string) => act(() => root.render(<KeydownInput value={value} onChange={onChange} />));
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.assign(chrome.i18n, { getUILanguage: vi.fn(() => 'ko-KR') });
  onChange.mockClear();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe('shortcut display without code changes', () => {
  it('displays readable labels but compares and emits the original physical key codes', () => {
    render('KeyA');
    const input = container.querySelector('input')!;
    expect(input.value).toBe('A');
    expect(input.readOnly).toBe(true);
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true })));
    expect(onChange).not.toHaveBeenCalled();
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: '1', code: 'Numpad1', bubbles: true })));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('Numpad1');
    render('Numpad1'); expect(input.value).toBe('숫자패드 1');
    render('Digit1'); expect(input.value).toBe('1');
    render('ArrowLeft'); expect(input.value).toBe('←');
  });

  it('retains clear and empty behavior without adding key capture restrictions', () => {
    render('ShiftLeft');
    expect(container.querySelector('input')!.value).toBe('Left Shift');
    act(() => container.querySelector('button')!.click());
    expect(onChange).toHaveBeenCalledExactlyOnceWith('');
    render('');
    const input = container.querySelector('input')!;
    expect(input.value).toBe(''); expect(container.querySelector('button')).toBeNull();
    onChange.mockClear();
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true })));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('Tab');
  });
});
