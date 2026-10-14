import { act } from 'react';

import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SubtitleDelayForm } from './subtitle-delay-form';

let container: HTMLDivElement;
let root: Root;
let mounted: boolean;
const onUpdateDelay = vi.fn();
const closeEditMode = vi.fn();

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  onUpdateDelay.mockReset();
  closeEditMode.mockReset();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  mounted = true;
});

afterEach(() => {
  if (mounted) act(() => root.unmount());
  vi.clearAllTimers();
  vi.useRealTimers();
  container.remove();
});

const renderForm = (initialDelay?: number) => act(() => root.render(
  <SubtitleDelayForm initialDelay={initialDelay} onUpdateDelay={onUpdateDelay} closeEditMode={closeEditMode} />
));
const value = () => Number(container.querySelector('input')!.value);
const stepButton = (direction: 'minus' | 'plus') => container.querySelectorAll('button')[direction === 'minus' ? 0 : 1];
const mouse = (button: Element, type: string) => act(() => {
  button.dispatchEvent(new MouseEvent(type, { bubbles: true }));
});
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe('subtitle delay stepping', () => {
  it('preserves the 0.1 second step, 300 ms hold delay and 50 ms repeat interval', () => {
    renderForm(-0.2);
    mouse(stepButton('plus'), 'mousedown');
    expect(value()).toBe(-0.1);
    advance(300);
    expect(value()).toBe(-0.1);
    advance(50);
    expect(value()).toBe(0);
    advance(100);
    expect(value()).toBe(0.2);
    mouse(stepButton('plus'), 'mouseup');
    advance(1000);
    expect(value()).toBe(0.2);
    expect(vi.getTimerCount()).toBe(0);
    expect(onUpdateDelay).not.toHaveBeenCalled();
  });

  it('preserves minus stepping and stopping when the mouse leaves', () => {
    renderForm();
    mouse(stepButton('minus'), 'mousedown');
    advance(400);
    expect(value()).toBe(-0.3);
    mouse(stepButton('minus'), 'mouseout');
    advance(1000);
    expect(value()).toBe(-0.3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([100, 450])('clears all timers when unmounted after %i ms', (elapsed) => {
    renderForm();
    mouse(stepButton('plus'), 'mousedown');
    advance(elapsed);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    act(() => root.unmount());
    mounted = false;
    expect(vi.getTimerCount()).toBe(0);
    advance(1000);
    expect(vi.getTimerCount()).toBe(0);
    expect(onUpdateDelay).not.toHaveBeenCalled();
  });

  it.each([100, 450])('stops a cancelled pointer after %i ms', (elapsed) => {
    renderForm();
    const button = stepButton('plus');
    mouse(button, 'mousedown');
    advance(elapsed);
    const before = value();
    act(() => button.dispatchEvent(new Event('pointercancel', { bubbles: true })));
    advance(1000);
    expect(value()).toBe(before);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([100, 450])('stops when the window loses focus after %i ms', (elapsed) => {
    renderForm();
    mouse(stepButton('minus'), 'mousedown');
    advance(elapsed);
    const before = value();
    act(() => window.dispatchEvent(new Event('blur')));
    advance(1000);
    expect(value()).toBe(before);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('replaces an existing hold instead of accumulating timers', () => {
    renderForm();
    mouse(stepButton('plus'), 'mousedown');
    advance(200);
    mouse(stepButton('minus'), 'mousedown');
    expect(value()).toBe(0);
    expect(vi.getTimerCount()).toBe(1);
    advance(150);
    expect(value()).toBe(0);
    advance(200);
    expect(value()).toBe(-0.1);
    mouse(stepButton('minus'), 'mouseup');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops stepping on submit and sends the current draft once', () => {
    renderForm(1.2);
    mouse(stepButton('plus'), 'mousedown');
    advance(400);
    act(() => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(onUpdateDelay).toHaveBeenCalledExactlyOnceWith(1.5);
    advance(1000);
    expect(value()).toBe(1.5);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves outside-click closing and reopens without old hold timers', () => {
    closeEditMode.mockImplementation(() => root.render(null));
    renderForm(2);
    mouse(stepButton('plus'), 'mousedown');
    advance(400);
    act(() => document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
    expect(closeEditMode).toHaveBeenCalledOnce();
    expect(onUpdateDelay).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    renderForm(2);
    advance(1000);
    expect(value()).toBe(2);
    mouse(stepButton('plus'), 'mousedown');
    advance(350);
    expect(value()).toBe(2.2);
    mouse(stepButton('plus'), 'mouseup');
    expect(vi.getTimerCount()).toBe(0);
  });
});
