import { SubtitleId } from '@storage/subtitle';
import { TabInfo, updateTabInfo } from '@storage/tab';
import { SetSubtitleAction } from '@utils/constants';
import { describe, expect, it, vi } from 'vitest';

import { applySubtitleRoleSelection, SubtitleRoleSelection } from './use-subtitle-settings';

const currentId = 'subtitle-00000000-0000-0000-0000-000000000001' as SubtitleId;
const nextId = 'subtitle-00000000-0000-0000-0000-000000000002' as SubtitleId;

const createDependencies = () => ({
  sendMessageToTab: vi.fn<
    (tabId: number, action: SetSubtitleAction, params: { subtitleId: SubtitleId | null; delay: number }) =>
      Promise<{ success: true } | { success: false; message: string }>
  >(),
  updateTabInfo: vi.fn<typeof updateTabInfo>(),
});

const selection: SubtitleRoleSelection = {
  role: 'primary',
  subtitleId: nextId,
  delay: 0.5,
  previousSubtitleId: currentId,
  previousDelay: -0.2,
};

describe('applySubtitleRoleSelection', () => {
  it('commits a role only after the content action succeeds', async () => {
    const dependencies = createDependencies();
    dependencies.sendMessageToTab.mockResolvedValue({ success: true });
    dependencies.updateTabInfo.mockResolvedValue();

    await expect(applySubtitleRoleSelection(7, selection, dependencies)).resolves.toEqual({ success: true });

    expect(dependencies.sendMessageToTab).toHaveBeenCalledWith(7, 'setPrimarySubtitle', {
      subtitleId: nextId,
      delay: 0.5,
    });
    expect(dependencies.updateTabInfo).toHaveBeenCalledWith(7, { primarySubtitle: nextId });
  });

  it('does not change session state when the content action fails', async () => {
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

    expect(dependencies.sendMessageToTab).toHaveBeenNthCalledWith(2, 7, 'setPrimarySubtitle', {
      subtitleId: currentId,
      delay: -0.2,
    });
  });

  it('serializes session writes when primary and secondary roles change together', async () => {
    const dependencies = createDependencies();
    dependencies.sendMessageToTab.mockResolvedValue({ success: true });
    let activeUpdates = 0;
    let maxActiveUpdates = 0;
    let sessionState: TabInfo = { primarySubtitle: currentId, secondarySubtitle: currentId };
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
      applySubtitleRoleSelection(7, { ...selection, role: 'secondary' }, dependencies),
    ]);

    expect(maxActiveUpdates).toBe(1);
    expect(sessionState).toEqual({ primarySubtitle: nextId, secondarySubtitle: nextId });
  });
});
