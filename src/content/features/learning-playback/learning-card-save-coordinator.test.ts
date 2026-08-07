import type { LearningCard } from '@storage/v2/type';
import { sendMessage } from '@utils/message';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { saveLearningCard } from './learning-card-save-coordinator';

vi.mock('@utils/message', () => ({ sendMessage: vi.fn() }));

describe('learning card save coordinator', () => {
  beforeEach(() => vi.mocked(sendMessage).mockReset());

  it('owns the lock before card creation and rejects a concurrent save as busy', async () => {
    const persistence = deferred<{ success: true; data: object }>();
    vi.mocked(sendMessage).mockReturnValueOnce(persistence.promise as never);
    let nestedSave: ReturnType<typeof saveLearningCard> | undefined;

    const firstSave = saveLearningCard(() => {
      nestedSave = saveLearningCard(() => card('nested'));
      return card('first');
    });

    await expect(nestedSave).resolves.toEqual({ status: 'busy' });
    expect(sendMessage).toHaveBeenCalledOnce();
    persistence.resolve({ success: true, data: {} });
    await expect(firstSave).resolves.toEqual({ status: 'saved', card: card('first') });
  });

  it('returns card-unavailable without persisting and releases the lock', async () => {
    await expect(saveLearningCard(() => undefined)).resolves.toEqual({
      status: 'card-unavailable',
    });
    expect(sendMessage).not.toHaveBeenCalled();

    vi.mocked(sendMessage).mockResolvedValueOnce({ success: true, data: {} } as never);
    await expect(saveLearningCard(() => card('available'))).resolves.toEqual({
      status: 'saved',
      card: card('available'),
    });
  });

  it('returns error for creation, response, and transport failures and always releases the lock', async () => {
    await expect(
      saveLearningCard(() => {
        throw new Error('private creation detail');
      })
    ).resolves.toEqual({ status: 'error' });

    vi.mocked(sendMessage).mockResolvedValueOnce({ success: false, message: 'private' } as never);
    await expect(saveLearningCard(() => card('response-error'))).resolves.toEqual({
      status: 'error',
    });

    vi.mocked(sendMessage).mockRejectedValueOnce(new Error('private transport detail'));
    await expect(saveLearningCard(() => card('transport-error'))).resolves.toEqual({
      status: 'error',
    });

    vi.mocked(sendMessage).mockResolvedValueOnce({ success: true, data: {} } as never);
    await expect(saveLearningCard(() => card('recovered'))).resolves.toEqual({
      status: 'saved',
      card: card('recovered'),
    });
  });

  it('persists completed repeated saves without deduplication', async () => {
    vi.mocked(sendMessage)
      .mockResolvedValueOnce({ success: true, data: {} } as never)
      .mockResolvedValueOnce({ success: true, data: {} } as never);

    await expect(saveLearningCard(() => card('repeat-1'))).resolves.toMatchObject({
      status: 'saved',
    });
    await expect(saveLearningCard(() => card('repeat-2'))).resolves.toMatchObject({
      status: 'saved',
    });

    expect(vi.mocked(sendMessage).mock.calls).toEqual([
      ['addLearningCard', { card: card('repeat-1') }],
      ['addLearningCard', { card: card('repeat-2') }],
    ]);
  });
});

const card = (suffix: string): LearningCard => ({
  id: `card-${suffix}`,
  content: { learning: { text: 'Learning', language: 'en' } },
  source: { url: 'https://www.coupangplay.com/play/example', startTime: 1, endTime: 2 },
  studyState: 'active',
  createdAt: '2026-08-07T00:00:00.000Z',
});

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};
