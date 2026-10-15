import { getTabInfo, updateTabInfo } from '@storage/tab';
import { sendMessageToTab } from '@utils/message';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { restoreUploadedSubtitles } from './restore-uploaded-subtitles';

vi.mock('@storage/tab', () => ({ getTabInfo: vi.fn(), updateTabInfo: vi.fn() }));
vi.mock('@utils/message', () => ({ sendMessageToTab: vi.fn() }));
const id = 'subtitle-00000000-0000-0000-0000-000000000001';
beforeEach(() => { vi.clearAllMocks(); });

describe('restoring the requesting tab upload selection', () => {
  it('sends only that tab selection and reconciles missing uploads without changing newer choices', async () => {
    vi.mocked(getTabInfo).mockResolvedValue({ primarySubtitle: id, secondarySubtitle: id });
    const restored = { success: true as const, data: { primarySubtitle: null, secondarySubtitle: null } };
    vi.mocked(sendMessageToTab).mockResolvedValue(restored);
    await restoreUploadedSubtitles(7);
    expect(sendMessageToTab).toHaveBeenCalledWith(7, 'restoreUploadedSubtitles', { primarySubtitle: id, secondarySubtitle: id });
    const patch = vi.mocked(updateTabInfo).mock.calls[0][1];
    if (typeof patch !== 'function') throw new Error('Expected guarded update');
    await expect(patch({ primarySubtitle: id, secondarySubtitle: null, connectionStatus: 'connected' })).resolves.toEqual({ primarySubtitle: null });
  });
  it('does not modify selection if restoration fails', async () => {
    vi.mocked(getTabInfo).mockResolvedValue({ primarySubtitle: id });
    vi.mocked(sendMessageToTab).mockResolvedValue({ success: false, message: 'Video changed' });
    await expect(restoreUploadedSubtitles(7)).rejects.toThrow('Video changed');
    expect(updateTabInfo).not.toHaveBeenCalled();
  });
});
