import { describe, expect, it } from 'vitest';

import { getCoupangPlayVideoId } from './coupang-play';

const VIDEO_ID = '123e4567-e89b-12d3-a456-426614174000';

describe('getCoupangPlayVideoId', () => {
  it.each([
    [`https://www.coupangplay.com/play/${VIDEO_ID}`, VIDEO_ID],
    [`https://www.coupangplay.com/en/play/${VIDEO_ID}`, VIDEO_ID],
    [`https://www.coupangplay.com/play/${VIDEO_ID}/`, VIDEO_ID],
    ['https://www.coupangplay.com/', null],
    ['https://www.coupangplay.com/play/not-a-uuid', null],
    [`https://example.com/play/${VIDEO_ID}`, null],
    ['not a url', null],
    [null, null],
  ])('extracts the expected video id from %s', (url, expected) => {
    expect(getCoupangPlayVideoId(url)).toBe(expected);
  });
});
