import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requestFeedbackPermission, sendFeedback } from './client';
import { feedbackConfig } from './config';

vi.mock('./config', () => ({ feedbackConfig: { origin: 'https://feedback.test', privacyUrl: 'https://privacy.test' } }));
const id = '11111111-1111-4111-8111-111111111111';
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  Object.assign(chrome, { permissions: { request: vi.fn().mockResolvedValue(true) } });
  Object.assign(chrome.runtime, { getManifest: () => ({ version: '1.12.0' }) });
});
describe('explicit feedback transmission', () => {
  it('requests only the configured origin synchronously and sends only the three allowed fields', async () => {
    const permission = requestFeedbackPermission();
    expect(chrome.permissions.request).toHaveBeenCalledWith({ origins: ['https://feedback.test/*'] });
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValue(Response.json({ status: 'stored', requestId: id, receivedAt: new Date().toISOString() }));
    await sendFeedback('Hello', id, permission);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://feedback.test/feedback');
    expect(JSON.parse(options.body)).toEqual({ message: 'Hello', extensionVersion: '1.12.0', requestId: id });
    expect(options).toMatchObject({ credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer' });
  });
  it('does not send on permission denial or rejection', async () => {
    await expect(sendFeedback('Hello', id, Promise.resolve(false))).rejects.toMatchObject({ key: 'feedback_permission_denied' });
    await expect(sendFeedback('Hello', id, Promise.reject(new Error('permission unavailable')))).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('fails closed without deployment configuration', async () => {
    const origin = feedbackConfig.origin;
    feedbackConfig.origin = '';
    await expect(requestFeedbackPermission()).rejects.toMatchObject({ key: 'feedback_unavailable' });
    feedbackConfig.origin = origin;
    expect(chrome.permissions.request).not.toHaveBeenCalled();
  });
  it.each([429, 500, 409])('rejects HTTP %s', async (status) => {
    fetchMock.mockResolvedValue(new Response('{}', { status }));
    await expect(sendFeedback('Hello', id, Promise.resolve(true))).rejects.toThrow();
  });
  it.each([{}, { status: 'stored', requestId: 'wrong', receivedAt: 'wrong' }, { status: 'stored', requestId: '22222222-2222-4222-8222-222222222222', receivedAt: '2026-10-15T00:00:00.000Z' }])('never accepts an invalid receipt %j', async (body) => {
    fetchMock.mockResolvedValue(Response.json(body));
    await expect(sendFeedback('Hello', id, Promise.resolve(true))).rejects.toThrow();
  });
  it('aborts a stalled request without claiming storage', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')))));
    const result = expect(sendFeedback('Hello', id, Promise.resolve(true))).rejects.toThrow('aborted');
    await vi.advanceTimersByTimeAsync(15_000);
    await result;
    vi.useRealTimers();
  });
});
