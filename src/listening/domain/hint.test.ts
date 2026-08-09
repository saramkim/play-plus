import { describe, expect, it } from 'vitest';

import { createListeningHint, createListeningHintSequence } from './hint';

describe('Listening Mission text hints', () => {
  it('creates the exact Level 1 shape from normalized expected text', () => {
    expect(
      createListeningHint(1, {
        expected: '<i>[noise] Hello,   world!</i>',
        learningLanguage: 'en',
      })
    ).toEqual({ level: 1, text: '＿＿＿＿＿ ＿＿＿＿＿' });
  });

  it('reveals the first grapheme of every token at Level 2', () => {
    expect(
      createListeningHint(2, {
        expected: 'Hello world',
        learningLanguage: 'en',
      })
    ).toEqual({ level: 2, text: 'h＿＿＿＿ w＿＿＿＿' });
  });

  it('reveals no-space grapheme indices 0, 4, 8 at Level 2', () => {
    expect(
      createListeningHint(2, {
        expected: '가나다라마바사아자',
        learningLanguage: 'ko',
      })
    ).toEqual({ level: 2, text: '가＿＿＿마＿＿＿자' });
  });

  it('returns accepted support only when present and otherwise skips Level 3', () => {
    const withSupport = createListeningHintSequence({
      expected: 'Hello world',
      learningLanguage: 'en',
      support: '도움 문장',
    });
    const withoutSupport = createListeningHintSequence({
      expected: 'Hello world',
      learningLanguage: 'en',
      support: '   ',
    });

    expect(withSupport.map(({ level }) => level)).toEqual([1, 2, 3, 4]);
    expect(withSupport[2]).toEqual({ level: 3, text: '도움 문장' });
    expect(withoutSupport.map(({ level }) => level)).toEqual([1, 2, 4]);
    expect(createListeningHint(3, { expected: 'Hello', learningLanguage: 'en' })).toBeUndefined();
  });

  it('reveals the full normalized learning answer at Level 4', () => {
    expect(
      createListeningHint(4, {
        expected: '<b>Hello, WORLD!</b>',
        learningLanguage: 'en',
      })
    ).toEqual({ level: 4, text: 'hello world' });
  });
});
