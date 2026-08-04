import type { V2SyncStorage } from '@storage/v2/type';
import { describe, expect, it, vi } from 'vitest';


import { reconcileTabSubtitleRoles } from './subtitle-role-reconciliation';

const learningSubtitle = {
  id: 'subtitle-00000000-0000-0000-0000-000000000001',
  title: 'Learning',
  language: 'en' as const,
  savedAt: '2026-08-03T00:00:00.000Z',
};
const supportSubtitle = {
  id: 'subtitle-00000000-0000-0000-0000-000000000002',
  title: 'Support',
  language: 'ko' as const,
  savedAt: '2026-08-03T00:00:00.000Z',
};

describe('background subtitle-role reconciliation', () => {
  it('preserves valid role selections without rewriting tab state', async () => {
    const dependencies = createDependencies();

    await expect(reconcileTabSubtitleRoles(7, dependencies)).resolves.toEqual({
      learningSubtitleId: learningSubtitle.id,
      supportSubtitleId: supportSubtitle.id,
    });
    expect(dependencies.updateTabInfo).not.toHaveBeenCalled();
  });

  it('clears language-mismatched and disabled-support selections before bootstrap', async () => {
    const dependencies = createDependencies();
    dependencies.getLearningProfile.mockResolvedValueOnce({
      learningLanguage: 'ja',
      supportLanguage: null,
    });

    await expect(reconcileTabSubtitleRoles(7, dependencies)).resolves.toEqual({
      learningSubtitleId: null,
      supportSubtitleId: null,
    });
    expect(dependencies.updateTabInfo).toHaveBeenCalledWith(7, {
      learningSubtitleId: null,
      supportSubtitleId: null,
    });
  });
});

const createDependencies = () => ({
  getLearningProfile: vi.fn<() => Promise<V2SyncStorage['learningProfile']>>(async () => ({
    learningLanguage: 'en',
    supportLanguage: 'ko',
  })),
  getRegisteredSubtitles: vi.fn(async () => [learningSubtitle, supportSubtitle]),
  getTabInfo: vi.fn(async () => ({
    learningSubtitleId: learningSubtitle.id,
    supportSubtitleId: supportSubtitle.id,
  })),
  updateTabInfo: vi.fn(async () => undefined),
});
