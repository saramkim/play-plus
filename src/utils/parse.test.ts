import { describe, expect, it } from 'vitest';

import { parseSRT, parseVTT } from './parse';

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

describe('parseSRT', () => {
  it('drops cues with malformed, out-of-range, or reversed timestamps', () => {
    const input = `1
00:00:01,000 --> 00:00:02,000
valid first

2
not-a-time --> 00:00:04,000
invalid start

3
00:00:05,000 --> not-a-time
invalid end

4
00:00:07,000 --> 00:00:06,000
reversed

5
00:61:00,000 --> 00:62:00,000
out of range

6
00:00:08.250   -->   00:00:09,500
valid last
`;

    expect(parseSRT(input)).toEqual([
      { start: 1, end: 2, text: 'valid first' },
      { start: 8.25, end: 9.5, text: 'valid last' },
    ]);
  });
});
