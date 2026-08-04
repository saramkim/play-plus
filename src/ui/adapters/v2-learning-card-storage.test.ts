import type {
  DeletedLearningCard,
  V2LearningCardStorageApi,
} from '@storage/v2/learning-card-storage';
import type { LearningCard } from '@storage/v2/type';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import {
  createMessageLearningCardStorage,
  LearningCardMessageSender,
} from './v2-learning-card-storage';

describe('message learning card storage', () => {
  it('satisfies the canonical learning card storage API', () => {
    expectTypeOf(createMessageLearningCardStorage()).toMatchTypeOf<V2LearningCardStorageApi>();
  });

  it('maps every storage operation to its typed runtime message and unwraps success', async () => {
    const card = createCard();
    const updated = { ...card, studyState: 'completed' as const };
    const deleted = { card: updated, index: 0 } satisfies DeletedLearningCard;
    const sender = vi
      .fn()
      .mockResolvedValueOnce({ success: true, data: [card] })
      .mockResolvedValueOnce({ success: true, data: card })
      .mockResolvedValueOnce({ success: true, data: updated })
      .mockResolvedValueOnce({ success: true, data: deleted })
      .mockResolvedValueOnce({ success: true, data: updated });
    const storage = createMessageLearningCardStorage(sender as unknown as LearningCardMessageSender);

    await expect(storage.get()).resolves.toEqual([card]);
    await expect(storage.add(card)).resolves.toEqual(card);
    await expect(storage.update(card.id, updated)).resolves.toEqual(updated);
    await expect(storage.delete(card.id)).resolves.toEqual(deleted);
    await expect(storage.restore(deleted)).resolves.toEqual(updated);

    expect(sender.mock.calls).toEqual([
      ['getLearningCards'],
      ['addLearningCard', { card }],
      ['updateLearningCard', { id: card.id, card: updated }],
      ['deleteLearningCard', { id: card.id }],
      ['restoreLearningCard', { deleted }],
    ]);
  });

  it('replaces response and transport failures with one generic error', async () => {
    const responseFailure = vi.fn().mockResolvedValue({
      success: false,
      message: 'private subtitle text https://example.com/watch/complete-url',
    });
    const transportFailure = vi.fn().mockRejectedValue(new Error('private transport detail'));

    await expect(
      createMessageLearningCardStorage(
        responseFailure as unknown as LearningCardMessageSender
      ).get()
    ).rejects.toThrow('Learning card operation failed');
    await expect(
      createMessageLearningCardStorage(
        transportFailure as unknown as LearningCardMessageSender
      ).get()
    ).rejects.toThrow('Learning card operation failed');
  });
});

const createCard = (): LearningCard => ({
  id: 'card-1',
  content: {
    learning: { text: 'Learning sentence', language: 'en' },
    support: { text: 'Support sentence', language: 'ko' },
  },
  source: { url: 'https://example.com/watch/1', startTime: 12 },
  studyState: 'active',
  createdAt: '2026-08-04T00:00:00.000Z',
});
