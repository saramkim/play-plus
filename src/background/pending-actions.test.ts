import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearSubtitleReplayRequest,
  enqueueViewAction,
  getSubtitleReplayRequest,
  saveSubtitleReplayRequest,
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
  it('keeps the matching replay source until it is explicitly cleared', async () => {
    const request = {
      capturedAt: 1234,
      contentInstanceId: 'content-instance-1',
      documentId: 'document-1',
      requestId: 'request-1',
      videoId: '123e4567-e89b-12d3-a456-426614174000',
      url: 'https://example.com/playback',
      headers: [{ name: 'x-test', value: 'yes' }],
    };
    await saveSubtitleReplayRequest(12, request);

    await expect(getSubtitleReplayRequest(99)).resolves.toBeUndefined();
    await expect(getSubtitleReplayRequest(12)).resolves.toEqual(request);
    await expect(getSubtitleReplayRequest(12)).resolves.toEqual(request);
    await clearSubtitleReplayRequest(12);
    await expect(getSubtitleReplayRequest(12)).resolves.toBeUndefined();
  });

  it('serializes concurrent per-tab mutations without losing either source', async () => {
    const first = {
      capturedAt: 1234,
      contentInstanceId: 'content-instance-1',
      documentId: 'document-1',
      requestId: 'request-1',
      videoId: '123e4567-e89b-12d3-a456-426614174000',
      url: 'https://synthetic.test/playback/one',
      headers: [],
    };
    const second = {
      capturedAt: null,
      contentInstanceId: null,
      documentId: null,
      requestId: 'request-2',
      videoId: '123e4567-e89b-12d3-a456-426614174001',
      url: 'https://synthetic.test/playback/two',
      headers: [],
    };

    await Promise.all([
      saveSubtitleReplayRequest(12, first),
      saveSubtitleReplayRequest(13, second),
    ]);

    await expect(getSubtitleReplayRequest(12)).resolves.toEqual(first);
    await expect(getSubtitleReplayRequest(13)).resolves.toEqual(second);
  });

  it('removes a legacy replay source without a capture epoch', async () => {
    session.pendingSubtitleRequests = {
      12: {
        contentInstanceId: 'content-instance-legacy',
        documentId: 'document-legacy',
        requestId: 'request-legacy',
        videoId: '123e4567-e89b-12d3-a456-426614174000',
        url: 'https://synthetic.test/old-playback',
        headers: [],
      },
    };

    await expect(getSubtitleReplayRequest(12)).resolves.toBeUndefined();
    expect(session.pendingSubtitleRequests).toEqual({});
  });
});
