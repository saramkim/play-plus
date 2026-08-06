import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  OPEN_SUBTITLES_OPTIONAL_ORIGINS,
  requestOpenSubtitlesPermission,
} from './open-subtitles-permission';

const requestPermission = vi.fn<() => Promise<boolean>>();

beforeEach(() => {
  requestPermission.mockReset().mockResolvedValue(true);
  Object.defineProperty(chrome, 'permissions', {
    configurable: true,
    value: { request: requestPermission },
  });
});

describe('OpenSubtitles permission', () => {
  it('requests the qualified API and temporary-download origins together', async () => {
    await expect(requestOpenSubtitlesPermission()).resolves.toBe(true);
    expect(requestPermission).toHaveBeenCalledWith({
      origins: [...OPEN_SUBTITLES_OPTIONAL_ORIGINS],
    });
  });

  it('treats a rejected permission call as a denial', async () => {
    requestPermission.mockRejectedValueOnce(new Error('permission unavailable'));

    await expect(requestOpenSubtitlesPermission()).resolves.toBe(false);
  });
});
