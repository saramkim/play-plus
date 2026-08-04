export type V2ReadinessStatus =
  | { status: 'ready' }
  | { status: 'error'; code: 'migration-failed' };

export interface V2ReadinessController {
  wait: () => Promise<V2ReadinessStatus>;
  retry: () => Promise<V2ReadinessStatus>;
}

type AttemptState = 'pending' | 'ready' | 'error';

const READY_STATUS: V2ReadinessStatus = { status: 'ready' };
const ERROR_STATUS: V2ReadinessStatus = { status: 'error', code: 'migration-failed' };

export const createV2ReadinessController = (
  migrate: () => Promise<unknown>
): V2ReadinessController => {
  let state: AttemptState = 'pending';
  let attempt: Promise<V2ReadinessStatus>;

  const startAttempt = () => {
    state = 'pending';

    let migration: Promise<unknown>;
    try {
      migration = migrate();
    } catch {
      migration = Promise.reject();
    }

    attempt = migration.then(
      () => {
        state = 'ready';
        return READY_STATUS;
      },
      () => {
        state = 'error';
        return ERROR_STATUS;
      }
    );
    return attempt;
  };

  void startAttempt();

  return {
    wait: () => attempt,
    retry: () => (state === 'error' ? startAttempt() : attempt),
  };
};
