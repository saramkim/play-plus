import { describe, expect, it } from 'vitest';

import { parseVTT } from './parse';

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
