import { REGISTRATION } from '@utils/constants';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addRegisteredSubtitle,
  deleteRegisteredSubtitle,
  getRegisteredSubtitles,
  onRegisteredSubtitlesChange,
  updateRegisteredSubtitle,
} from './registered-subtitle';
import { SubtitleId } from './subtitle';
import { SubtitleMetadata } from './type';

const UUID = '00000000-0000-4000-8000-000000000001';
const ID = `${REGISTRATION.ID_PREFIX}-${UUID}` as SubtitleId;
const OTHER_ID = `${REGISTRATION.ID_PREFIX}-00000000-0000-4000-8000-000000000002` as SubtitleId;
const SAVED_AT = '2026-08-01T00:00:00.000Z';
const BODY = [{ start: 1, end: 2, text: 'Hello' }];
const metadata: SubtitleMetadata = {
  id: ID,
  title: 'English',
  language: 'en',
  savedAt: SAVED_AT,
};
const otherMetadata: SubtitleMetadata = {
  id: OTHER_ID,
  title: 'Korean',
  language: 'ko',
  savedAt: SAVED_AT,
};

let localStorage: Record<string, unknown>;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(SAVED_AT));
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(UUID);

  localStorage = {};
  vi.mocked(chrome.storage.local.get).mockImplementation(((key: string, callback?: (items: object) => void) => {
    const items = key in localStorage ? { [key]: localStorage[key] } : {};
    if (callback) return callback(items);
    return Promise.resolve(items);
  }) as typeof chrome.storage.local.get);
  vi.mocked(chrome.storage.local.set).mockImplementation(async (items) => {
    Object.assign(localStorage, items);
  });
  vi.mocked(chrome.storage.local.remove).mockImplementation(async (key) => {
    if (typeof key === 'string') delete localStorage[key];
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('registered subtitle storage', () => {
  it('adds metadata and body in one write while preserving the latest metadata', async () => {
    localStorage.registeredSubtitles = [otherMetadata];

    await expect(addRegisteredSubtitle({ title: 'English', language: 'en', body: BODY })).resolves.toEqual(metadata);

    expect(chrome.storage.local.set).toHaveBeenCalledOnce();
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      registeredSubtitles: [otherMetadata, metadata],
      [ID]: BODY,
    });
    expect(localStorage[ID]).toEqual(BODY);
  });

  it('rejects a duplicate generated id without writing', async () => {
    localStorage.registeredSubtitles = [metadata];

    await expect(addRegisteredSubtitle({ title: 'Duplicate', language: 'en', body: BODY })).rejects.toThrow(
      `Registered subtitle already exists: ${ID}`
    );

    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it('serializes fresh-read updates and preserves sibling metadata and unrelated fields', async () => {
    localStorage.registeredSubtitles = [metadata, otherMetadata];

    const edit = updateRegisteredSubtitle(ID, { title: 'Edited' });
    const delay = updateRegisteredSubtitle(ID, { delay: 0.3 });
    await Promise.all([edit, delay]);

    expect(await getRegisteredSubtitles()).toEqual([
      { ...metadata, title: 'Edited', delay: 0.3 },
      otherMetadata,
    ]);
    expect(chrome.storage.local.set).toHaveBeenCalledTimes(2);
  });

  it('does not write when an update target is missing', async () => {
    localStorage.registeredSubtitles = [otherMetadata];

    await expect(updateRegisteredSubtitle(ID, { title: 'Missing' })).resolves.toBeUndefined();

    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it('deletes metadata before removing its body and preserves siblings', async () => {
    localStorage.registeredSubtitles = [metadata, otherMetadata];
    localStorage[ID] = BODY;
    const events: string[] = [];
    vi.mocked(chrome.storage.local.set).mockImplementation(async (items) => {
      events.push('metadata');
      Object.assign(localStorage, items);
    });
    vi.mocked(chrome.storage.local.remove).mockImplementation(async (key) => {
      events.push('body');
      if (typeof key === 'string') delete localStorage[key];
    });

    await expect(deleteRegisteredSubtitle(ID)).resolves.toEqual(metadata);

    expect(events).toEqual(['metadata', 'body']);
    expect(localStorage.registeredSubtitles).toEqual([otherMetadata]);
    expect(localStorage[ID]).toBeUndefined();
  });

  it('does not remove a body when the metadata write fails and recovers the mutation queue', async () => {
    localStorage.registeredSubtitles = [metadata];
    localStorage[ID] = BODY;
    const error = new Error('metadata write failed');
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(error);

    await expect(deleteRegisteredSubtitle(ID)).rejects.toBe(error);
    expect(chrome.storage.local.remove).not.toHaveBeenCalled();
    await expect(updateRegisteredSubtitle(ID, { delay: 0.5 })).resolves.toEqual({ ...metadata, delay: 0.5 });
  });

  it('propagates a body removal failure after committing the metadata deletion', async () => {
    localStorage.registeredSubtitles = [metadata, otherMetadata];
    localStorage[ID] = BODY;
    const error = new Error('body removal failed');
    vi.mocked(chrome.storage.local.remove).mockRejectedValueOnce(error);

    await expect(deleteRegisteredSubtitle(ID)).rejects.toBe(error);

    expect(localStorage.registeredSubtitles).toEqual([otherMetadata]);
    expect(localStorage[ID]).toEqual(BODY);
  });

  it('does not write or remove when a delete target is missing', async () => {
    localStorage.registeredSubtitles = [otherMetadata];

    await expect(deleteRegisteredSubtitle(ID)).resolves.toBeUndefined();

    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    expect(chrome.storage.local.remove).not.toHaveBeenCalled();
  });

  it('reports storage-key removal as an empty registered subtitle list', () => {
    let listener: ((changes: { registeredSubtitles?: { newValue?: SubtitleMetadata[] } }) => void) | undefined;
    vi.mocked(chrome.storage.local.onChanged.addListener).mockImplementation((callback) => {
      listener = callback;
    });
    const callback = vi.fn();

    const subscription = onRegisteredSubtitlesChange(callback);
    listener?.({ registeredSubtitles: { newValue: undefined } });

    expect(callback).toHaveBeenCalledWith([]);
    subscription.remove();
    expect(chrome.storage.local.onChanged.removeListener).toHaveBeenCalledWith(listener);
  });
});
