import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OPEN_SUBTITLES_OPTIONAL_ORIGINS, requestOpenSubtitlesPermission } from './open-subtitles-permission';

beforeEach(() => {
  Object.defineProperty(chrome, 'permissions', {
    configurable: true,
    value: { request: vi.fn().mockResolvedValue(true) },
  });
});

describe('OpenSubtitles permission', () => {
  it('requests only the API and verified temporary-download origins', async () => {
    await expect(requestOpenSubtitlesPermission()).resolves.toBe(true);
    expect(chrome.permissions.request).toHaveBeenCalledWith({ origins: [...OPEN_SUBTITLES_OPTIONAL_ORIGINS] });
  });
});
