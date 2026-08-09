import { describe, expect, it } from 'vitest';

import {
  calculateListeningLevenshteinDistance,
  getListeningAlmostThreshold,
  judgeListeningAnswer,
  normalizeListeningAnswer,
} from './answer';
import { splitListeningGraphemes } from './grapheme';

describe('normalizeListeningAnswer', () => {
  it('strips markup and supported wrappers before multilingual normalization', () => {
    expect(
      normalizeListeningAnswer('<i>[music] HéLLo，   WORLD!</i>', 'en-US')
    ).toEqual({
      readable: 'héllo world',
      compact: 'hélloworld',
    });
  });

  it('applies NFKC and preserves actual letters and numbers', () => {
    expect(normalizeListeningAnswer('ＡＢＣ １２３ 안녕', 'ko')).toEqual({
      readable: 'ａｂｃ 123 안녕'.normalize('NFKC'),
      compact: 'ａｂｃ123안녕'.normalize('NFKC'),
    });
  });

  it('uses locale-aware case folding with a stable invalid-locale fallback', () => {
    expect(normalizeListeningAnswer('I İ', 'tr').readable).toBe('ı i');
    expect(normalizeListeningAnswer('HELLO', 'english').readable).toBe('hello');
    expect(normalizeListeningAnswer('HELLO', 'not_a_locale').readable).toBe('hello');
  });

  it('applies deterministic full folds for sharp s and Greek final sigma', () => {
    expect(normalizeListeningAnswer('Straße ẞ', 'de').readable).toBe('strasse ss');
    expect(normalizeListeningAnswer('ΟΣ ος οσ', 'el').readable).toBe('οσ οσ οσ');
  });

  it('canonicalizes smart punctuation and hyphens before removing punctuation', () => {
    expect(normalizeListeningAnswer('I’ll re‑enter', 'en').compact).toBe(
      normalizeListeningAnswer("I'll re-enter", 'en').compact
    );
  });
});

describe('judgeListeningAnswer', () => {
  it('accepts case, punctuation, width, and spacing-only differences', () => {
    expect(judgeListeningAnswer('Hello, world! １２３', 'HELLOWORLD123', 'en')).toBe('correct');
  });

  it('accepts full-fold case-only differences in German and Greek', () => {
    expect(judgeListeningAnswer('Straße', 'STRASSE', 'de')).toBe('correct');
    expect(judgeListeningAnswer('ΟΣ', 'οσ', 'el')).toBe('correct');
  });

  it('uses the exact 15 percent grapheme threshold boundary', () => {
    expect(getListeningAlmostThreshold(10, 10)).toBe(1);
    expect(judgeListeningAnswer('abcdefghij', 'abcdefghiX', 'en')).toBe('almost');
    expect(judgeListeningAnswer('abcdefghij', 'abcdefghXY', 'en')).toBe('try-again');

    expect(getListeningAlmostThreshold(14, 14)).toBe(2);
    expect(judgeListeningAnswer('abcdefghijklmn', 'abcdefghijklXY', 'en')).toBe('almost');
    expect(judgeListeningAnswer('abcdefghijklmn', 'abcdefghijkXYZ', 'en')).toBe('try-again');
  });

  it('never treats an empty compact answer as correct', () => {
    expect(judgeListeningAnswer('[music]', '', 'en')).toBe('try-again');
    expect(judgeListeningAnswer('a', '', 'en')).toBe('try-again');
  });

  it('does not add semantic equivalence or contraction expansion', () => {
    expect(judgeListeningAnswer("can't", 'cannot', 'en')).toBe('try-again');
    expect(judgeListeningAnswer('fast', 'quick', 'en')).toBe('try-again');
  });

  it('measures edits over graphemes rather than code units', () => {
    expect(
      calculateListeningLevenshteinDistance(
        splitListeningGraphemes('👩🏽‍💻한'),
        splitListeningGraphemes('👩🏽‍💻글')
      )
    ).toBe(1);
  });
});
