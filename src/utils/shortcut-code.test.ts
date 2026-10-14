import { describe, expect, it } from 'vitest';

import { formatShortcutCode } from './shortcut-code';

describe('formatShortcutCode', () => {
  it.each([
    ['KeyA', 'A'],
    ['Digit1', '1'],
    ['ArrowLeft', '←'],
    ['ArrowRight', '→'],
    ['F12', 'F12'],
    ['Backquote', '`'],
    ['Minus', '-'],
    ['BracketLeft', '['],
    ['Slash', '/'],
  ])('formats %s as %s', (code, expected) => {
    expect(formatShortcutCode(code)).toBe(expected);
  });

  it('distinguishes numpad keys and localizes their prefix', () => {
    expect(formatShortcutCode('Numpad1', 'en-US')).toBe('Num 1');
    expect(formatShortcutCode('Numpad1', 'ko-KR')).toBe('숫자패드 1');
    expect(formatShortcutCode('NumpadAdd', 'en')).toBe('Num +');
    expect(formatShortcutCode('NumpadEnter', 'ko')).toBe('숫자패드 Enter');
  });

  it('uses readable stable labels for named, media, international, and future codes', () => {
    expect(formatShortcutCode('ShiftLeft')).toBe('Left Shift');
    expect(formatShortcutCode('MediaPlayPause')).toBe('Media Play/Pause');
    expect(formatShortcutCode('AudioVolumeUp')).toBe('Volume Up');
    expect(formatShortcutCode('IntlYen')).toBe('Intl ¥');
    expect(formatShortcutCode('Lang2')).toBe('Language 2');
    expect(formatShortcutCode('LaunchAssistantPanel')).toBe('Launch Assistant Panel');
  });

  it('keeps an empty unassigned code empty', () => {
    expect(formatShortcutCode('')).toBe('');
  });
});
