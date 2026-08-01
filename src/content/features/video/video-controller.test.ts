import { DEFAULT_CONFIG } from '@storage/default';
import { getStorage } from '@storage/index';
import { describe, expect, it, vi } from 'vitest';

import { KeyBindingManager } from '@/content/features/navigation/key-bindings';

import { VideoController, VideoControllerDependencies } from './video-controller';

const createDependencies = (
  getStorageImplementation: typeof getStorage
): VideoControllerDependencies => ({
  createKeyBindingManager: () => new KeyBindingManager(),
  document,
  getStorage: getStorageImplementation,
});

const resolvedStorage = vi.fn(async (key: keyof typeof DEFAULT_CONFIG) => DEFAULT_CONFIG[key]) as unknown as typeof getStorage;

describe('VideoController lifecycle', () => {
  it('keeps construction inert and starts one keydown listener', async () => {
    const getStorageMock = vi.fn(resolvedStorage) as unknown as typeof getStorage;
    const addEventListener = vi.spyOn(document, 'addEventListener');
    const removeEventListener = vi.spyOn(document, 'removeEventListener');

    const controller = new VideoController(createDependencies(getStorageMock));
    expect(getStorageMock).not.toHaveBeenCalled();
    expect(addEventListener).not.toHaveBeenCalledWith('keydown', expect.any(Function));

    const firstStart = controller.start();
    const secondStart = controller.start();
    expect(secondStart).toBe(firstStart);
    await firstStart;

    expect(getStorageMock).toHaveBeenCalledTimes(5);
    expect(addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));

    controller.stop();
    controller.stop();
    expect(removeEventListener).toHaveBeenCalledTimes(1);

    await controller.start();
    expect(getStorageMock).toHaveBeenCalledTimes(10);
    expect(addEventListener).toHaveBeenCalledTimes(2);
    controller.stop();
    expect(removeEventListener).toHaveBeenCalledTimes(2);
  });

  it('does not attach keydown after stop during storage loading', async () => {
    let finishStorage: ((value: unknown) => void) | undefined;
    const pendingStorage = new Promise((resolve) => {
      finishStorage = resolve;
    });
    const getStorageMock = vi.fn(() => pendingStorage) as unknown as typeof getStorage;
    const addEventListener = vi.spyOn(document, 'addEventListener');
    const controller = new VideoController(createDependencies(getStorageMock));

    const start = controller.start();
    controller.stop();
    finishStorage?.(undefined);
    await start;

    expect(addEventListener).not.toHaveBeenCalledWith('keydown', expect.any(Function));
  });
});
