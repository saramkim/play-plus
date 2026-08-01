import { describe, expect, it, vi } from 'vitest';

import { respondToAsyncMessage } from './async-message-response';

describe('respondToAsyncMessage', () => {
  it('keeps the channel open and responds only after work completes', async () => {
    let completeTask: (() => void) | undefined;
    const task = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          completeTask = resolve;
        })
    );
    const sendResponse = vi.fn();

    expect(respondToAsyncMessage(sendResponse, task)).toBe(true);
    await Promise.resolve();
    expect(sendResponse).not.toHaveBeenCalled();

    completeTask?.();
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ success: true }));
  });

  it('turns rejected work into a failure response', async () => {
    const sendResponse = vi.fn();

    respondToAsyncMessage(sendResponse, async () => {
      throw new Error('storage failed');
    });
    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({ success: false, message: 'storage failed' })
    );
  });

  it('returns task data for typed response messages', async () => {
    const sendResponse = vi.fn();

    respondToAsyncMessage(sendResponse, async () => ({ candidates: [] }));

    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({ success: true, data: { candidates: [] } })
    );
  });

  it('uses a typed error normalizer when one is provided', async () => {
    const sendResponse = vi.fn();

    respondToAsyncMessage(
      sendResponse,
      async () => {
        throw new Error('provider detail');
      },
      () => ({ code: 'SERVER' as const, message: 'Provider request failed' })
    );

    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        code: 'SERVER',
        message: 'Provider request failed',
      })
    );
  });
});
