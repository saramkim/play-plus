import { describe, expect, it } from 'vitest';

import {
  cleanListeningSpokenText,
  hasListeningSpokenContent,
  normalizeListeningWhitespace,
  removeListeningNonSpokenWrappers,
} from '@/listening/domain/spoken-text';

describe('listening spoken-text cleanup', () => {
  it.each([
    ['[music]', ''],
    ['(whispering)', ''],
    ['［door closes］', ''],
    ['（laughs）', ''],
    ['【applause】', ''],
  ])('removes the supported wrapper pair in %s', (input, expected) => {
    expect(removeListeningNonSpokenWrappers(input)).toBe(expected);
  });

  it('removes nested and multiple complete outermost spans left to right', () => {
    expect(removeListeningNonSpokenWrappers('[music (soft)] Hello 【noise】 world')).toBe(
      ' Hello  world'
    );
  });

  it('retains mixed unwrapped text and strips markup before wrapper parsing', () => {
    expect(cleanListeningSpokenText('<i>Hello</i> [quietly] brave\n\tworld')).toBe(
      'Hello brave world'
    );
  });

  it.each([
    '[unclosed text',
    '(mismatched]',
    '[(crossed])',
    'unsupported {wrapper}',
  ])('preserves malformed or unsupported wrapper text: %s', (input) => {
    expect(removeListeningNonSpokenWrappers(input)).toBe(input);
  });

  it('continues removing later independent valid spans after malformed text', () => {
    expect(removeListeningNonSpokenWrappers('[broken) text 【noise】 spoken')).toBe(
      '[broken) text  spoken'
    );
  });

  it('normalizes Unicode whitespace after wrapper removal', () => {
    expect(normalizeListeningWhitespace('  Hello\r\n\tworld\u00a0again  ')).toBe(
      'Hello world again'
    );
    expect(cleanListeningSpokenText('Hello [noise]   world')).toBe('Hello world');
  });

  it.each(['', '   ', '...?!', '♪ ♫', '【music】'])('rejects separator-only text: %s', (input) => {
    expect(hasListeningSpokenContent(cleanListeningSpokenText(input))).toBe(false);
  });

  it.each(['Hello!', '안녕', '１２３', '— Привет'])('accepts Unicode letters or numbers: %s', (input) => {
    expect(hasListeningSpokenContent(cleanListeningSpokenText(input))).toBe(true);
  });
});
