import { describe, expect, it } from 'vitest';

import { parseSMI, parseSRT, parseVTT } from './parse';

describe('parseSRT', () => {
  it('preserves valid cue order, duplicates, markup, multiline text and zero timestamps', () => {
    const input = ['1', '00:00:00,000 --> 00:00:02.500', '<b>Hello</b>', 'second line', '',
      '2', '01:02:03.250 --> 01:02:04,500', '같은 문장', '',
      '3', '02:05 --> 02:05', '같은 문장'].join('\r\n');
    expect(parseSRT(input)).toEqual([
      { start: 0, end: 2.5, text: '<b>Hello</b>\nsecond line' },
      { start: 3723.25, end: 3724.5, text: '같은 문장' },
      { start: 125, end: 125, text: '같은 문장' },
    ]);
  });

  it.each([
    'bad --> 00:00:04,000', '00:00:03,000 --> bad',
    '00:00:07,000 --> 00:00:06,000', '00:61:00,000 --> 00:62:00,000',
    '00:00:60,000 --> 00:01:01,000', '00:00:01,000-->00:00:02,000',
    `${'9'.repeat(400)}:00:00 --> ${'9'.repeat(400)}:00:01`,
  ])('drops malformed timing without inventing a zero-time cue: %s', (timing) => {
    expect(parseSRT(`1\n${timing}\ninvalid\n\n2\n00:00:08.250   -->\t00:00:09,500\nvalid`))
      .toEqual([{ start: 8.25, end: 9.5, text: 'valid' }]);
  });

  it('returns no cues for an empty or entirely invalid file', () => {
    expect(parseSRT(' \r\n')).toEqual([]);
    expect(parseSRT('1\nbad --> bad\ninvalid')).toEqual([]);
    expect(parseSRT('1\n00:00:01,000 --> 00:00:02,000\n<script>bad()</script>')).toEqual([]);
  });
});

describe('parseSMI regression', () => {
  it('preserves the existing cue result with an explicit ending sync', () => {
    expect(parseSMI('<SYNC Start=1000><P>안녕하세요<SYNC Start=3000><P>&nbsp;')).toEqual([
      { start: 1, end: 3, text: '안녕하세요' },
    ]);
  });
});

describe('parseVTT', () => {
  it('parses cue identifiers, multiline text, settings, and comma milliseconds', () => {
    const input = `WEBVTT

cue-1
00:00:01.250 --> 00:00:03,500 align:start position:10%
<b>Hello</b>
second line
`;

    expect(parseVTT(input)).toEqual([
      {
        start: 1.25,
        end: 3.5,
        text: '<b>Hello</b>\nsecond line',
        settings: ['align:start', 'position:10%'],
      },
    ]);
  });

  it('sanitizes unsafe markup while retaining supported subtitle markup', () => {
    const input = `WEBVTT

00:00:01.000 --> 00:00:02.000
<script>alert(1)</script><i>safe</i><img src=x onerror=alert(2)>
`;

    expect(parseVTT(input)).toEqual([{ start: 1, end: 2, text: '<i>safe</i>' }]);
  });

  it('ignores empty cues and malformed timestamps', () => {
    const input = `WEBVTT

00:00:01.000 --> 00:00:02.000

bad --> timestamp
ignored

00:00:03.000 --> 00:00:04.000
valid
`;

    expect(parseVTT(input)).toEqual([{ start: 3, end: 4, text: 'valid' }]);
  });
});
