import { describe, expect, it } from 'vitest';

import {
  createListeningSegmentKey,
  createNativeListeningSourceKey,
  createRegisteredListeningSourceKey,
  listeningSegmentKeySchema,
  listeningSourceKeySchema,
  LISTENING_SEGMENTER_VERSION,
} from '@/listening/domain/source-identity';

describe('listening source identity', () => {
  it('creates strict native and registered source keys', () => {
    expect(createNativeListeningSourceKey('en')).toBe('native:en');
    expect(
      createRegisteredListeningSourceKey('subtitle-123e4567-e89b-42d3-a456-426614174000')
    ).toBe('registered:subtitle-123e4567-e89b-42d3-a456-426614174000');
    expect(LISTENING_SEGMENTER_VERSION).toBe(1);

    expect(listeningSourceKeySchema.safeParse('native:unknown').success).toBe(false);
    expect(listeningSourceKeySchema.safeParse('registered:not-an-id').success).toBe(false);
    expect(listeningSourceKeySchema.safeParse('support:en').success).toBe(false);
  });

  it('creates a stable SHA-256 segment key from the ordered canonical tuple', async () => {
    const input = {
      sourceKey: createNativeListeningSourceKey('en'),
      sourceIndices: [2, 3],
      cleanedTextParts: ['Hello', 'world'],
    } as const;

    const first = await createListeningSegmentKey(input);
    const second = await createListeningSegmentKey(input);

    expect(first).toBe(second);
    expect(first).toBe(
      'segment-v1-b47d9a45eaaee76c44b0fa07506a7c8358b557490866af29ec355b97f3b00126'
    );
    expect(first).toMatch(/^segment-v1-[0-9a-f]{64}$/);
    expect(listeningSegmentKeySchema.parse(first)).toBe(first);
  });

  it('changes only when the source, source-index sequence, or cleaned parts change', async () => {
    const base = {
      sourceKey: createNativeListeningSourceKey('en'),
      sourceIndices: [0, 1],
      cleanedTextParts: ['First', 'line'],
    } as const;
    const keys = await Promise.all([
      createListeningSegmentKey(base),
      createListeningSegmentKey({ ...base, sourceKey: createNativeListeningSourceKey('ko') }),
      createListeningSegmentKey({ ...base, sourceIndices: [1, 0] }),
      createListeningSegmentKey({ ...base, cleanedTextParts: ['First', 'Line'] }),
    ]);

    expect(new Set(keys)).toHaveProperty('size', 4);
  });

  it('rejects malformed identity inputs', async () => {
    await expect(
      createListeningSegmentKey({
        sourceKey: 'native:unknown' as never,
        sourceIndices: [0],
        cleanedTextParts: ['Line'],
      })
    ).rejects.toThrow();
    await expect(
      createListeningSegmentKey({
        sourceKey: createNativeListeningSourceKey('en'),
        sourceIndices: [-1],
        cleanedTextParts: ['Line'],
      })
    ).rejects.toThrow();
    await expect(
      createListeningSegmentKey({
        sourceKey: createNativeListeningSourceKey('en'),
        sourceIndices: [0],
        cleanedTextParts: [],
      })
    ).rejects.toThrow();
  });
});
