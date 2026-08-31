import { describe, expect, it, vi } from 'vitest';

import { stripTags } from './helper';

describe('stripTags', () => {
  it('removes remote-resource markup without creating resource elements', () => {
    const createElement = vi.spyOn(document, 'createElement');
    const createRange = vi.spyOn(document, 'createRange');

    expect(
      stripTags(
        '<img src="https://example.invalid/pixel" alt="tracking pixel">Visible caption'
      )
    ).toBe('Visible caption');
    expect(createElement).not.toHaveBeenCalled();
    expect(createRange).not.toHaveBeenCalled();
  });

  it('ignores greater-than signs inside quoted tag attributes', () => {
    expect(
      stripTags(
        '<span title="1 > 0">First</span> <i data-note=\'a > b\'>second</i>'
      )
    ).toBe('First second');
  });

  it('preserves multiline plain text while decoding named and numeric entities', () => {
    const createElement = vi.spyOn(document, 'createElement');
    const createContextualFragment = vi.spyOn(Range.prototype, 'createContextualFragment');

    expect(
      stripTags('  <i>First &amp; second &copy; &mdash;</i>\n&#xD55C;&#44544;\nthird  ')
    ).toBe(
      'First & second © —\n한글\nthird'
    );
    expect(createElement).not.toHaveBeenCalled();
    expect(createContextualFragment.mock.calls.map(([entity]) => entity)).toEqual([
      '&amp;',
      '&copy;',
      '&mdash;',
      '&#xD55C;',
      '&#44544;',
    ]);
  });

  it('preserves literal comparison symbols instead of treating them as tags', () => {
    expect(stripTags('2 < 3 and 5 > 4 &amp;&amp; 7 >= 6')).toBe(
      '2 < 3 and 5 > 4 && 7 >= 6'
    );
  });
});
