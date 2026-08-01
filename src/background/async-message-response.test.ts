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
});
