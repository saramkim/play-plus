import { describe, expect, it, vi } from 'vitest';

import { createSubtitleRequestHandler } from './subtitle-request';

const payload = {
  url: 'https://example.com/subtitle',
  headers: [{ name: 'x-test', value: 'yes' }],
};

describe('subtitle request handler', () => {
  it('delivers a request without persisting a fallback', async () => {
    const dependencies = {
      deliver: vi.fn(async () => {}),
      savePending: vi.fn(async () => {}),
    };
    const sendSubtitleRequest = createSubtitleRequestHandler(dependencies);

    await sendSubtitleRequest(5, payload);

    expect(dependencies.deliver).toHaveBeenCalledWith(5, payload);
    expect(dependencies.savePending).not.toHaveBeenCalled();
  });

  it('persists a fallback when direct delivery fails', async () => {
    const dependencies = {
      deliver: vi.fn(async () => {
        throw new Error('no receiver');
      }),
      savePending: vi.fn(async () => {}),
    };
    const sendSubtitleRequest = createSubtitleRequestHandler(dependencies);

    await sendSubtitleRequest(5, payload);

    expect(dependencies.savePending).toHaveBeenCalledWith(5, payload);
  });
});
