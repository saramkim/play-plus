import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  enqueueViewAction,
  savePendingSubtitleRequest,
  takePendingSubtitleRequest,
  takeViewAction,
} from './pending-actions';

const session: Record<string, unknown> = {};

beforeEach(() => {
  for (const key of Object.keys(session)) delete session[key];
  vi.mocked(chrome.storage.session.get).mockImplementation(((key: string, callback: (items: object) => void) => {
    callback({ [key]: session[key] });
  }) as typeof chrome.storage.session.get);
  vi.mocked(chrome.storage.session.set).mockImplementation(async (items) => {
    Object.assign(session, items);
  });
});

describe('pending view actions', () => {
  it('consumes the newest matching video action once and preserves unrelated actions', async () => {
    await enqueueViewAction({ url: 'https://example.com/one', startTime: 1, videoId: 'one' });
    await enqueueViewAction({ url: 'https://example.com/two', startTime: 2, videoId: 'two' });
    await enqueueViewAction({ url: 'https://example.com/one?new', startTime: 3, videoId: 'one' });

    await expect(takeViewAction('one', 'https://example.com/one')).resolves.toMatchObject({ startTime: 3 });
    await expect(takeViewAction('one', 'https://example.com/one')).resolves.toMatchObject({ startTime: 1 });
    await expect(takeViewAction('one', 'https://example.com/one')).resolves.toBeUndefined();
    await expect(takeViewAction('two', 'https://example.com/two')).resolves.toMatchObject({ startTime: 2 });
  });

  it('falls back to exact URL matching when no video id exists', async () => {
    await enqueueViewAction({ url: 'https://example.com/watch', startTime: 7, videoId: null });

    await expect(takeViewAction(null, 'https://example.com/watch')).resolves.toMatchObject({ startTime: 7 });
  });
});

describe('pending subtitle requests', () => {
  it('stores requests by tab id and consumes only the matching request once', async () => {
    const request = { url: 'https://example.com/playback', headers: [{ name: 'x-test', value: 'yes' }] };
    await savePendingSubtitleRequest(12, request);

    await expect(takePendingSubtitleRequest(99)).resolves.toBeUndefined();
    await expect(takePendingSubtitleRequest(12)).resolves.toEqual(request);
    await expect(takePendingSubtitleRequest(12)).resolves.toBeUndefined();
  });
});
