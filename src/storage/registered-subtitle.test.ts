import { V2RegisteredSubtitleMetadata } from '@storage/v2/type';
import { REGISTRATION } from '@utils/constants';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addRegisteredSubtitle,
  deleteRegisteredSubtitle,
  getRegisteredSubtitles,
  onRegisteredSubtitlesChange,
  updateRegisteredSubtitle,
} from './registered-subtitle';
import { getLocalSubtitle, removeLocalSubtitle, setLocalSubtitle, SubtitleId } from './subtitle';

const UUID = '00000000-0000-4000-8000-000000000001';
const ID = `${REGISTRATION.ID_PREFIX}-${UUID}` as SubtitleId;
const OTHER_ID = `${REGISTRATION.ID_PREFIX}-00000000-0000-4000-8000-000000000002` as SubtitleId;
const THIRD_ID = `${REGISTRATION.ID_PREFIX}-00000000-0000-4000-8000-000000000003` as SubtitleId;
const SAVED_AT = '2026-08-01T00:00:00.000Z';
const BODY = [{ start: 1, end: 2, text: 'Hello' }];
const metadata: V2RegisteredSubtitleMetadata = {
  id: ID,
  title: 'English',
  language: 'en',
  savedAt: SAVED_AT,
};
const otherMetadata: V2RegisteredSubtitleMetadata = {
  id: OTHER_ID,
  title: 'Korean',
  language: 'ko',
  savedAt: SAVED_AT,
};
const thirdMetadata: V2RegisteredSubtitleMetadata = {
  id: THIRD_ID,
  title: 'Japanese',
  language: 'ja',
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

  it('rejects an invalid body before writing metadata or the physical body key', async () => {
    localStorage.registeredSubtitles = [otherMetadata];

    await expect(
      addRegisteredSubtitle({ title: 'English', language: 'en', body: [{ start: 2, end: 1, text: 'Invalid' }] })
    ).rejects.toThrow();

    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    expect(localStorage[ID]).toBeUndefined();
  });

  it('rejects a duplicate generated id without writing', async () => {
    localStorage.registeredSubtitles = [metadata];

    await expect(addRegisteredSubtitle({ title: 'Duplicate', language: 'en', body: BODY })).rejects.toThrow(
      `Registered subtitle already exists: ${ID}`
    );

    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it('does not overwrite an orphan body at a generated id', async () => {
    localStorage.registeredSubtitles = [otherMetadata];
    localStorage[ID] = BODY;

    await expect(addRegisteredSubtitle({ title: 'Duplicate', language: 'en', body: BODY })).rejects.toThrow(
      `Registered subtitle already exists: ${ID}`
    );

    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    expect(localStorage[ID]).toEqual(BODY);
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

  it('rejects without writing when an update target is missing', async () => {
    localStorage.registeredSubtitles = [otherMetadata];

    await expect(updateRegisteredSubtitle(ID, { title: 'Missing' })).rejects.toThrow(
      `Registered subtitle not found: ${ID}`
    );

    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it('deletes metadata before removing its body and preserves siblings', async () => {
    localStorage.registeredSubtitles = [otherMetadata, metadata, thirdMetadata];
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
    expect(localStorage.registeredSubtitles).toEqual([otherMetadata, thirdMetadata]);
    expect(localStorage[ID]).toBeUndefined();
  });

  it('does not remove a body when the metadata write fails and recovers the mutation queue', async () => {
    localStorage.registeredSubtitles = [otherMetadata, metadata];
    localStorage[ID] = BODY;
    const error = new Error('metadata write failed');
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(error);

    await expect(deleteRegisteredSubtitle(ID)).rejects.toBe(error);
    expect(chrome.storage.local.remove).not.toHaveBeenCalled();
    expect(localStorage.registeredSubtitles).toEqual([otherMetadata, metadata]);
    expect(localStorage[ID]).toEqual(BODY);
    await expect(updateRegisteredSubtitle(ID, { delay: 0.5 })).resolves.toEqual({ ...metadata, delay: 0.5 });
    expect(localStorage.registeredSubtitles).toEqual([otherMetadata, { ...metadata, delay: 0.5 }]);
  });

  it('restores the exact metadata order and body after body removal fails, then recovers the queue', async () => {
    const originalMetadata = [otherMetadata, metadata, thirdMetadata];
    localStorage.registeredSubtitles = originalMetadata;
    localStorage[ID] = BODY;
    const error = new Error('body removal failed');
    vi.mocked(chrome.storage.local.remove).mockImplementationOnce(async (key) => {
      if (typeof key === 'string') delete localStorage[key];
      throw error;
    });

    await expect(deleteRegisteredSubtitle(ID)).rejects.toBe(error);

    expect(chrome.storage.local.set).toHaveBeenNthCalledWith(1, {
      registeredSubtitles: [otherMetadata, thirdMetadata],
    });
    expect(chrome.storage.local.set).toHaveBeenNthCalledWith(2, {
      registeredSubtitles: originalMetadata,
      [ID]: BODY,
    });
    expect(localStorage.registeredSubtitles).toEqual(originalMetadata);
    expect(localStorage[ID]).toEqual(BODY);
    await expect(updateRegisteredSubtitle(ID, { delay: 0.5 })).resolves.toEqual({ ...metadata, delay: 0.5 });
    expect(localStorage.registeredSubtitles).toEqual([
      otherMetadata,
      { ...metadata, delay: 0.5 },
      thirdMetadata,
    ]);
  });

  it('rejects without writing or removing when a delete target is missing', async () => {
    localStorage.registeredSubtitles = [otherMetadata];

    await expect(deleteRegisteredSubtitle(ID)).rejects.toThrow(`Registered subtitle not found: ${ID}`);

    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    expect(chrome.storage.local.remove).not.toHaveBeenCalled();
  });

  it('rejects a missing physical body before deleting its metadata', async () => {
    localStorage.registeredSubtitles = [metadata, otherMetadata];

    await expect(deleteRegisteredSubtitle(ID)).rejects.toThrow();

    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    expect(chrome.storage.local.remove).not.toHaveBeenCalled();
    expect(localStorage.registeredSubtitles).toEqual([metadata, otherMetadata]);
  });

  it('strictly validates missing and invalid metadata collections', async () => {
    await expect(getRegisteredSubtitles()).rejects.toThrow();

    localStorage.registeredSubtitles = [{ ...metadata, unexpected: true }];
    await expect(getRegisteredSubtitles()).rejects.toThrow();
  });

  it('strictly validates physical body reads and writes', async () => {
    await expect(getLocalSubtitle(ID)).rejects.toThrow();

    localStorage[ID] = [{ start: 2, end: 1, text: 'Invalid' }];
    await expect(getLocalSubtitle(ID)).rejects.toThrow();

    expect(() => setLocalSubtitle(ID, [{ start: 2, end: 1, text: 'Invalid' }])).toThrow();
    expect(chrome.storage.local.set).not.toHaveBeenCalled();

    await expect(setLocalSubtitle(ID, BODY)).resolves.toBeUndefined();
    await expect(getLocalSubtitle(ID)).resolves.toEqual(BODY);

    await expect(removeLocalSubtitle(ID)).resolves.toBeUndefined();
    expect(localStorage[ID]).toBeUndefined();
    await expect(removeLocalSubtitle(ID)).rejects.toThrow();
  });

  it('strictly validates registered subtitle change events', () => {
    let listener: ((changes: Record<string, chrome.storage.StorageChange>) => void) | undefined;
    vi.mocked(chrome.storage.local.onChanged.addListener).mockImplementation((callback) => {
      listener = callback;
    });
    const callback = vi.fn();

    const subscription = onRegisteredSubtitlesChange(callback);
    listener?.({ registeredSubtitles: { newValue: [metadata] } });

    expect(callback).toHaveBeenCalledWith([metadata]);
    expect(() => listener?.({ registeredSubtitles: { newValue: undefined } })).toThrow();
    expect(() => listener?.({ registeredSubtitles: { newValue: [{ ...metadata, extra: true }] } })).toThrow();
    subscription.remove();
    expect(chrome.storage.local.onChanged.removeListener).toHaveBeenCalledWith(listener);
  });
});
