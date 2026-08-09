import { describe, expect, it } from 'vitest';

import {
  countListeningGraphemes,
  splitListeningGraphemes,
  splitListeningGraphemesFallback,
} from './grapheme';

describe('listening grapheme segmentation', () => {
  it.each([
    ['e\u0301', ['e\u0301']],
    ['👍🏽', ['👍🏽']],
    ['👨‍👩‍👧‍👦', ['👨‍👩‍👧‍👦']],
    ['🇰🇷🇳🇿', ['🇰🇷', '🇳🇿']],
    ['한', ['한']],
    ['\r\na', ['\r\n', 'a']],
  ])('keeps %s in deterministic user-perceived units', (input, expected) => {
    expect(splitListeningGraphemes(input)).toEqual(expected);
    expect(splitListeningGraphemesFallback(input)).toEqual(expected);
  });

  it('counts no-space scripts by grapheme rather than UTF-16 code unit', () => {
    expect(countListeningGraphemes('한글👍🏽')).toBe(3);
    expect(splitListeningGraphemesFallback('한글👍🏽')).toEqual(['한', '글', '👍🏽']);
  });

  it('keeps the fallback equivalent to Intl.Segmenter for representative mission text', () => {
    const input = 'Cafe\u0301 한글 👩🏽‍💻 🇰🇷';

    expect(splitListeningGraphemesFallback(input)).toEqual(splitListeningGraphemes(input));
  });
});
