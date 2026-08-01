import { describe, expect, it, vi } from 'vitest';

import { createConnectionStatus } from './connection-status';

const createDependencies = () => ({
  pingContent: vi.fn(async () => ({ success: true as const, data: { hasVideo: true } })),
  updateTabInfo: vi.fn(async () => {}),
});

describe('connection status', () => {
  it('persists a successful content connection', async () => {
    const dependencies = createDependencies();
    const { checkContentConnection } = createConnectionStatus(dependencies);

    await checkContentConnection(4, true);

    expect(dependencies.updateTabInfo).toHaveBeenCalledWith(4, {
      connectionStatus: 'connected',
      videoStatus: 'detected',
    });
  });

  it('marks the tab disconnected when ping delivery fails', async () => {
    const dependencies = createDependencies();
    dependencies.pingContent.mockRejectedValue(new Error('no receiver'));
    const { checkContentConnection } = createConnectionStatus(dependencies);

    await checkContentConnection(4, true);

    expect(dependencies.updateTabInfo).toHaveBeenCalledWith(4, {
      connectionStatus: 'disconnected',
      videoStatus: 'not_detected',
    });
  });

  it('propagates status persistence failures without writing a false disconnected state', async () => {
    const dependencies = createDependencies();
    dependencies.updateTabInfo.mockRejectedValue(new Error('storage failed'));
    const { checkContentConnection } = createConnectionStatus(dependencies);

    await expect(checkContentConnection(4, true)).rejects.toThrow('storage failed');
    expect(dependencies.updateTabInfo).toHaveBeenCalledTimes(1);
  });
});
