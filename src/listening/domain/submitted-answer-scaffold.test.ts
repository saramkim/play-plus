import { describe, expect, it } from 'vitest';

import { LISTENING_HINT_MASK } from './hint';
import { createSubmittedAnswerScaffold } from './submitted-answer-scaffold';

describe('createSubmittedAnswerScaffold', () => {
  it('aligns exact tokens and omits submitted insertions', () => {
    const scaffold = createSubmittedAnswerScaffold({
      expected: 'I really like green tea',
      learningLanguage: 'en',
      submitted: 'I like tea today',
    });

    expect(scaffold).toEqual({
      parts: [
        { kind: 'matched', text: 'i' },
        { kind: 'whitespace', text: ' ' },
        { graphemeCount: 6, kind: 'blank' },
        { kind: 'whitespace', text: ' ' },
        { kind: 'matched', text: 'like' },
        { kind: 'whitespace', text: ' ' },
        { graphemeCount: 5, kind: 'blank' },
        { kind: 'whitespace', text: ' ' },
        { kind: 'matched', text: 'tea' },
      ],
      strategy: 'token-lcs',
      visualText: `i ${LISTENING_HINT_MASK.repeat(6)} like ${LISTENING_HINT_MASK.repeat(5)} tea`,
    });
    expect(JSON.stringify(scaffold)).not.toContain('today');
  });

  it('normalizes punctuation, case, and width before alignment', () => {
    expect(
      createSubmittedAnswerScaffold({
        expected: '<i>Hello, ＷＯＲＬＤ! １２３</i>',
        learningLanguage: 'en',
        submitted: 'HELLO world',
      })
    ).toMatchObject({
      strategy: 'token-lcs',
      visualText: `hello world ${LISTENING_HINT_MASK.repeat(3)}`,
    });
  });

  it('uses earlier expected positions for deterministic repeated-token ties', () => {
    expect(
      createSubmittedAnswerScaffold({
        expected: 'a b a',
        learningLanguage: 'en',
        submitted: 'a a b',
      }).visualText
    ).toBe(`a b ${LISTENING_HINT_MASK}`);

    expect(
      createSubmittedAnswerScaffold({
        expected: 'cat catalog',
        learningLanguage: 'en',
        submitted: 'catalog cat',
      }).visualText
    ).toBe(`cat ${LISTENING_HINT_MASK.repeat(7)}`);
  });

  it('uses grapheme LCS for a single whitespace-delimited token', () => {
    const scaffold = createSubmittedAnswerScaffold({
      expected: 'LETTER',
      learningLanguage: 'en',
      submitted: 'later',
    });

    expect(scaffold.strategy).toBe('grapheme-lcs');
    expect(scaffold.visualText).toBe(`l${LISTENING_HINT_MASK}t${LISTENING_HINT_MASK}er`);
  });

  it('aligns Korean no-space text and masks omitted graphemes', () => {
    expect(
      createSubmittedAnswerScaffold({
        expected: '가나다라마바사',
        learningLanguage: 'ko',
        submitted: '가다라마추가',
      })
    ).toMatchObject({
      strategy: 'grapheme-lcs',
      visualText: `가${LISTENING_HINT_MASK}다라마${LISTENING_HINT_MASK.repeat(2)}`,
    });
  });

  it('reports masked extended graphemes as countable blank parts', () => {
    expect(
      createSubmittedAnswerScaffold({
        expected: 'A👩🏽‍💻B',
        learningLanguage: 'en',
        submitted: 'ab',
      })
    ).toEqual({
      parts: [
        { kind: 'matched', text: 'a' },
        { graphemeCount: 1, kind: 'blank' },
        { kind: 'matched', text: 'b' },
      ],
      strategy: 'grapheme-lcs',
      visualText: `a${LISTENING_HINT_MASK}b`,
    });
  });

  it('returns no submitted text even when all expected units match around an insertion', () => {
    const scaffold = createSubmittedAnswerScaffold({
      expected: 'alpha beta',
      learningLanguage: 'en',
      submitted: 'alpha private beta',
    });

    expect(scaffold.visualText).toBe('alpha beta');
    expect(JSON.stringify(scaffold)).not.toContain('private');
  });

  it(
    'handles an all-match worst-case submitted answer without per-cell alignment arrays',
    () => {
      const expected = 'a'.repeat(120);
      const submitted = 'a'.repeat(100_000);
      const scaffold = createSubmittedAnswerScaffold({
        expected,
        learningLanguage: 'en',
        submitted,
      });

      expect(scaffold.parts).toEqual([{ kind: 'matched', text: expected }]);
      expect(scaffold.visualText).toBe(expected);
    },
    15_000
  );
});
