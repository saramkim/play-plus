import { describe, expect, it, vi } from 'vitest';

import type { SubtitleRoleSelection } from '@/ui/features/subtitle/use-subtitle-settings';
import { runGuardedMutation } from '@/ui/features/subtitle-upload/use-uploaded-subtitles';

import { clearSubtitleRolesWithRollback } from './subtitle-role-transaction';

const subtitleId = 'subtitle-00000000-0000-0000-0000-000000000001';

describe('registered subtitle role transactions', () => {
  it('clears selected roles and restores them in reverse order', async () => {
    const apply = vi.fn(async () => true);
    const rollback = await clearSubtitleRolesWithRollback(
      [
        { role: 'learning', subtitleId },
        { role: 'support', subtitleId },
      ],
      apply
    );

    expect(apply).toHaveBeenNthCalledWith(1, {
      role: 'learning',
      subtitleId: null,
      previousSubtitleId: subtitleId,
    });
    expect(apply).toHaveBeenNthCalledWith(2, {
      role: 'support',
      subtitleId: null,
      previousSubtitleId: subtitleId,
    });

    await rollback();
    expect(apply).toHaveBeenNthCalledWith(3, {
      role: 'support',
      subtitleId,
      previousSubtitleId: null,
    });
    expect(apply).toHaveBeenNthCalledWith(4, {
      role: 'learning',
      subtitleId,
      previousSubtitleId: null,
    });
  });

  it('rolls back an earlier role when a later clear fails', async () => {
    const apply = vi
      .fn(async (_selection: SubtitleRoleSelection) => true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await expect(
      clearSubtitleRolesWithRollback(
        [
          { role: 'learning', subtitleId },
          { role: 'support', subtitleId },
        ],
        apply
      )
    ).rejects.toThrow();
    expect(apply).toHaveBeenNthCalledWith(3, {
      role: 'learning',
      subtitleId,
      previousSubtitleId: null,
    });
  });

  it('restores selected roles only after a failed storage mutation has restored metadata', async () => {
    const order: string[] = [];
    const originalMetadata = ['before', subtitleId, 'after'];
    let storedMetadata = [...originalMetadata];
    const selectedRoles: Record<'learning' | 'support', string | null> = {
      learning: subtitleId,
      support: subtitleId,
    };
    const apply = vi.fn(async (selection: SubtitleRoleSelection) => {
      const action = selection.subtitleId === null ? 'clear' : 'restore';
      if (action === 'restore') expect(storedMetadata).toEqual(originalMetadata);
      selectedRoles[selection.role] = selection.subtitleId;
      order.push(`${action}-${selection.role}`);
      return true;
    });

    await expect(
      runGuardedMutation(
        async () => {
          return clearSubtitleRolesWithRollback(
            [
              { role: 'learning', subtitleId },
              { role: 'support', subtitleId },
            ],
            apply
          );
        },
        async () => {
          storedMetadata = ['before', 'after'];
          order.push('metadata-delete');
          order.push('body-remove');
          storedMetadata = [...originalMetadata];
          order.push('metadata-restore');
          throw new Error('storage failed');
        }
      )
    ).rejects.toThrow('storage failed');
    expect(order).toEqual([
      'clear-learning',
      'clear-support',
      'metadata-delete',
      'body-remove',
      'metadata-restore',
      'restore-support',
      'restore-learning',
    ]);
    expect(selectedRoles).toEqual({ learning: subtitleId, support: subtitleId });
  });
});
