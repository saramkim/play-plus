import { describe, expect, it, vi } from 'vitest';

import { createV2ReadinessController } from './v2-readiness';

describe('v2 readiness controller', () => {
  it('eagerly starts one migration attempt shared by every waiter', async () => {
    const migration = createDeferred<void>();
    const migrate = vi.fn(() => migration.promise);

    const readiness = createV2ReadinessController(migrate);

    expect(migrate).toHaveBeenCalledOnce();
    const first = readiness.wait();
    const second = readiness.wait();
    expect(first).toBe(second);

    migration.resolve();
    await expect(first).resolves.toEqual({ status: 'ready' });
    await expect(second).resolves.toEqual({ status: 'ready' });
    expect(migrate).toHaveBeenCalledOnce();
  });

  it('returns only a stable sanitized status when migration fails', async () => {
    const migrate = vi.fn(async () => {
      throw new Error('private subtitle text https://example.com/watch/complete-url');
    });
    const readiness = createV2ReadinessController(migrate);

    const result = await readiness.wait();

    expect(result).toEqual({ status: 'error', code: 'migration-failed' });
    expect(JSON.stringify(result)).not.toContain('private subtitle text');
    expect(JSON.stringify(result)).not.toContain('example.com');
    await expect(readiness.wait()).resolves.toBe(result);
    expect(migrate).toHaveBeenCalledOnce();
  });

  it('starts a fresh single-flight attempt only when retry follows a failure', async () => {
    const retryMigration = createDeferred<void>();
    const migrate = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('first attempt failed'))
      .mockImplementationOnce(() => retryMigration.promise);
    const readiness = createV2ReadinessController(migrate);

    await expect(readiness.wait()).resolves.toEqual({
      status: 'error',
      code: 'migration-failed',
    });

    const retry = readiness.retry();
    expect(migrate).toHaveBeenCalledTimes(2);
    expect(readiness.wait()).toBe(retry);
    expect(readiness.retry()).toBe(retry);

    retryMigration.resolve();
    await expect(retry).resolves.toEqual({ status: 'ready' });
    expect(readiness.retry()).toBe(retry);
    expect(migrate).toHaveBeenCalledTimes(2);
  });

  it('sanitizes a synchronous migration failure', async () => {
    const readiness = createV2ReadinessController(() => {
      throw new Error('raw migration failure');
    });

    await expect(readiness.wait()).resolves.toEqual({
      status: 'error',
      code: 'migration-failed',
    });
  });
});

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};
