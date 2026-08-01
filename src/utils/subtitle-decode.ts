import { ENCODING_MAP, Language, LANGUAGE_ENCODING_MAP } from '@utils/constants';

export const MAX_SUBTITLE_FILE_SIZE = 1024 * 1024;
export const MAX_SUBTITLE_FILE_SIZE_BYTES = MAX_SUBTITLE_FILE_SIZE;

export class SubtitleDecodeError extends Error {
  constructor(public readonly code: 'FILE_TOO_LARGE' | 'DECODE_FAILED') {
    super(code);
    this.name = 'SubtitleDecodeError';
  }
}

export const assertSubtitleFileSize = (byteLength: number) => {
  if (!Number.isSafeInteger(byteLength) || byteLength < 0 || byteLength > MAX_SUBTITLE_FILE_SIZE_BYTES) {
    throw new SubtitleDecodeError('FILE_TOO_LARGE');
  }
};

export const decodeSubtitleBytes = (data: ArrayBuffer | Uint8Array, language: Language) => {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  assertSubtitleFileSize(bytes.byteLength);

  const encodings = [...new Set([
    ENCODING_MAP.UTF_8,
    LANGUAGE_ENCODING_MAP[language],
    ...Object.values(ENCODING_MAP),
  ])];

  for (const encoding of encodings) {
    try {
      return new TextDecoder(encoding, { fatal: true }).decode(bytes);
    } catch {
      continue;
    }
  }

  throw new SubtitleDecodeError('DECODE_FAILED');
};
