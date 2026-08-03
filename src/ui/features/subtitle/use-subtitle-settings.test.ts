import { SubtitleId } from '@storage/subtitle';
import { TabInfo, updateTabInfo } from '@storage/tab';
import { describe, expect, it, vi } from 'vitest';

import {
  applySubtitleRoleSelection,
  isSubtitleRoleLanguage,
  SubtitleRoleSelection,
} from './use-subtitle-settings';

const currentId = 'subtitle-00000000-0000-0000-0000-000000000001' as SubtitleId;
const nextId = 'subtitle-00000000-0000-0000-0000-000000000002' as SubtitleId;

const createDependencies = () => ({
  sendMessageToTab: vi.fn<
    (
      tabId: number,
      action: 'setSubtitleRole',
      params: { role: 'learning' | 'support'; subtitleId: SubtitleId | null }
    ) => Promise<{ success: true } | { success: false; message: string }>
  >(),
  updateTabInfo: vi.fn<typeof updateTabInfo>(),
});

const selection: SubtitleRoleSelection = {
  role: 'learning',
  subtitleId: nextId,
  previousSubtitleId: currentId,
};

describe('applySubtitleRoleSelection', () => {
  it('commits the canonical session role only after the content action succeeds', async () => {
    const dependencies = createDependencies();
    dependencies.sendMessageToTab.mockResolvedValue({ success: true });
    dependencies.updateTabInfo.mockResolvedValue();

    await expect(applySubtitleRoleSelection(7, selection, dependencies)).resolves.toEqual({ success: true });

    expect(dependencies.sendMessageToTab).toHaveBeenCalledWith(7, 'setSubtitleRole', {
      role: 'learning',
      subtitleId: nextId,
    });
    expect(dependencies.updateTabInfo).toHaveBeenCalledWith(7, { learningSubtitleId: nextId });
  });

  it('retains session state when content rejects the role', async () => {
    const dependencies = createDependencies();
    dependencies.sendMessageToTab.mockResolvedValue({ success: false, message: 'content failed' });

    await expect(applySubtitleRoleSelection(7, selection, dependencies)).resolves.toEqual({
      success: false,
      message: 'content failed',
    });
    expect(dependencies.updateTabInfo).not.toHaveBeenCalled();
  });

  it('rolls content back when the session update fails', async () => {
    const dependencies = createDependencies();
    dependencies.sendMessageToTab.mockResolvedValue({ success: true });
    dependencies.updateTabInfo.mockRejectedValue(new Error('storage failed'));

    await expect(applySubtitleRoleSelection(7, selection, dependencies)).rejects.toThrow('storage failed');
    expect(dependencies.sendMessageToTab).toHaveBeenNthCalledWith(2, 7, 'setSubtitleRole', {
      role: 'learning',
      subtitleId: currentId,
    });
  });

  it('serializes session writes when both canonical roles change together', async () => {
    const dependencies = createDependencies();
    dependencies.sendMessageToTab.mockResolvedValue({ success: true });
    let activeUpdates = 0;
    let maxActiveUpdates = 0;
    let sessionState: TabInfo = {
      learningSubtitleId: currentId,
      supportSubtitleId: currentId,
    };
    dependencies.updateTabInfo.mockImplementation(async (_tabId, info) => {
      const currentState = { ...sessionState };
      activeUpdates += 1;
      maxActiveUpdates = Math.max(maxActiveUpdates, activeUpdates);
      await Promise.resolve();
      sessionState = { ...currentState, ...info };
      activeUpdates -= 1;
    });

    await Promise.all([
      applySubtitleRoleSelection(7, selection, dependencies),
      applySubtitleRoleSelection(7, { ...selection, role: 'support' }, dependencies),
    ]);

    expect(maxActiveUpdates).toBe(1);
    expect(sessionState).toEqual({
      learningSubtitleId: nextId,
      supportSubtitleId: nextId,
    });
  });
});

describe('isSubtitleRoleLanguage', () => {
  const profile = { learningLanguage: 'en', supportLanguage: 'ko' } as const;

  it('requires the subtitle language to match its canonical role', () => {
    expect(isSubtitleRoleLanguage('learning', 'en', profile)).toBe(true);
    expect(isSubtitleRoleLanguage('learning', 'ko', profile)).toBe(false);
    expect(isSubtitleRoleLanguage('support', 'ko', profile)).toBe(true);
  });

  it('keeps the support role unavailable when no support language is configured', () => {
    expect(
      isSubtitleRoleLanguage('support', 'ko', {
        learningLanguage: 'en',
        supportLanguage: null,
      })
    ).toBe(false);
  });
});
