import { describe, expect, it, vi } from 'vitest';

import {
  assertSubtitleFileSize,
  decodeSubtitleBytes,
  MAX_SUBTITLE_FILE_SIZE_BYTES,
  SubtitleDecodeError,
} from './subtitle-decode';

describe('subtitle decoding', () => {
  it('prefers UTF-8 before the language-specific fallback', () => {
    const bytes = new TextEncoder().encode('Hello, 안녕하세요');

    expect(decodeSubtitleBytes(bytes, 'ko')).toBe('Hello, 안녕하세요');
  });

  it('falls back to the selected language encoding', () => {
    const eucKrBytes = new Uint8Array([0xbe, 0xc8, 0xb3, 0xe7]);

    expect(decodeSubtitleBytes(eucKrBytes, 'ko')).toBe('안녕');
  });

  it('rejects data when every fatal decoder fails', () => {
    vi.spyOn(TextDecoder.prototype, 'decode').mockImplementation(() => {
      throw new TypeError('malformed');
    });

    expect(() => decodeSubtitleBytes(new Uint8Array([0x81]), 'en')).toThrowError(
      expect.objectContaining({ name: 'SubtitleDecodeError', code: 'DECODE_FAILED' })
    );
  });

  it('accepts exactly 1 MiB and rejects larger or invalid sizes', () => {
    expect(() => assertSubtitleFileSize(MAX_SUBTITLE_FILE_SIZE_BYTES)).not.toThrow();
    expect(() => assertSubtitleFileSize(MAX_SUBTITLE_FILE_SIZE_BYTES + 1)).toThrow(SubtitleDecodeError);
    expect(() => assertSubtitleFileSize(-1)).toThrow(SubtitleDecodeError);
  });
});
