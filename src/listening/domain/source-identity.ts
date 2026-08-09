import { z } from 'zod';

import { LANGUAGES, type Language } from '@utils/constants';

export const LISTENING_SEGMENTER_VERSION = 1 as const;

export type ListeningSourceKey =
  | `native:${Language}`
  | `registered:subtitle-${string}`;
export type ListeningSegmentKey = `segment-v1-${string}`;

const registeredSubtitleIdPattern =
  /^subtitle-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const listeningSourceKeySchema = z.custom<ListeningSourceKey>((value) => {
  if (typeof value !== 'string') return false;
  if (value.startsWith('native:')) {
    const language = value.slice('native:'.length);
    return Object.prototype.hasOwnProperty.call(LANGUAGES, language);
  }
  if (value.startsWith('registered:')) {
    return registeredSubtitleIdPattern.test(value.slice('registered:'.length));
  }
  return false;
}, { message: 'Invalid listening source key' });

export const listeningSegmentKeySchema = z.custom<ListeningSegmentKey>(
  (value) => typeof value === 'string' && /^segment-v1-[0-9a-f]{64}$/.test(value),
  { message: 'Invalid listening segment key' }
);

interface CreateListeningSegmentKeyInput {
  sourceKey: ListeningSourceKey;
  sourceIndices: readonly number[];
  cleanedTextParts: readonly string[];
}

const sourceIndicesSchema = z.array(z.number().int().nonnegative().refine(Number.isSafeInteger)).min(1);
const cleanedTextPartsSchema = z.array(z.string().min(1)).min(1);

export const createNativeListeningSourceKey = (language: Language): ListeningSourceKey => {
  return listeningSourceKeySchema.parse(`native:${language}`);
};

export const createRegisteredListeningSourceKey = (subtitleId: string): ListeningSourceKey => {
  return listeningSourceKeySchema.parse(`registered:${subtitleId}`);
};

export const createListeningSegmentKey = async ({
  sourceKey,
  sourceIndices,
  cleanedTextParts,
}: CreateListeningSegmentKeyInput): Promise<ListeningSegmentKey> => {
  const canonicalJson = JSON.stringify([
    LISTENING_SEGMENTER_VERSION,
    listeningSourceKeySchema.parse(sourceKey),
    sourceIndicesSchema.parse([...sourceIndices]),
    cleanedTextPartsSchema.parse([...cleanedTextParts]),
  ]);
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalJson)
  );
  const hexadecimal = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  return listeningSegmentKeySchema.parse(`segment-v1-${hexadecimal}`);
};
