import { describe, expect, it, vi } from 'vitest';

import { getLocalSubtitle } from './subtitle';

const id = 'subtitle-00000000-0000-0000-0000-000000000001';
describe('registered subtitle body reads', () => {
  it('returns original cues without altering stored data', async () => {
    const raw = [{ start: 1, end: 2, text: 'Original' }];
    vi.mocked(chrome.storage.local.get).mockImplementation(() => Promise.resolve({ [id]: raw }));
    await expect(getLocalSubtitle(id)).resolves.toBe(raw);
  });
  it('rejects missing data and storage errors instead of leaving callers unresolved', async () => {
    vi.mocked(chrome.storage.local.get).mockImplementationOnce(() => Promise.resolve({})).mockRejectedValueOnce(new Error('read failed'));
    await expect(getLocalSubtitle(id)).rejects.toThrow('missing');
    await expect(getLocalSubtitle(id)).rejects.toThrow('read failed');
  });
});
