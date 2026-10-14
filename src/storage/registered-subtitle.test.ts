import { beforeEach, describe, expect, it, vi } from 'vitest';

import { addRegisteredSubtitle, deleteRegisteredSubtitle, getRegisteredSubtitles, SubtitleDeleteRecoveryError, updateRegisteredSubtitle } from './registered-subtitle';
import { SubtitleId } from './subtitle';

const id: SubtitleId = 'subtitle-00000000-0000-0000-0000-000000000001';
const other: SubtitleId = 'subtitle-00000000-0000-0000-0000-000000000002';
const body = [{ start: 1, end: 2, text: '<b>keep</b>\nline' }];
const metadata = { id, title: 'Original', language: 'en', savedAt: '2020-01-01', delay: 2, extra: 'preserved' };
let stored: Record<string, unknown>;
beforeEach(() => {
  stored = { registeredSubtitles: [structuredClone(metadata)], [id]: structuredClone(body), unrelated: { keep: true } };
  vi.mocked(chrome.storage.local.get).mockReset().mockImplementation(async (key: unknown) => {
    return { [String(key)]: structuredClone(stored[String(key)]) };
  });
  vi.mocked(chrome.storage.local.set).mockReset().mockImplementation(async values => { Object.assign(stored, structuredClone(values)); });
  vi.mocked(chrome.storage.local.remove).mockReset().mockImplementation(async (key: unknown) => { delete stored[String(key)]; });
});

describe('registered subtitle mutations', () => {
  it('keeps both concurrent additions without losing the original record', async () => {
    const additions = await Promise.all([
      addRegisteredSubtitle({ title: 'First', language: 'en', body }),
      addRegisteredSubtitle({ title: 'Second', language: 'ko', body }),
    ]);
    expect(await getRegisteredSubtitles()).toEqual([metadata, ...additions]);
    expect(additions[0].id).not.toBe(additions[1].id);
    for (const addition of additions) expect(stored[addition.id]).toEqual(body);
  });

  it('serializes additions and updates using fresh values and one set per addition', async () => {
    const [added] = await Promise.all([
      addRegisteredSubtitle({ title: 'Added', language: 'ko', body }),
      updateRegisteredSubtitle(id, { title: 'Changed' }),
      updateRegisteredSubtitle(id, { delay: 0 }),
    ]);
    expect(await getRegisteredSubtitles()).toEqual([{ ...metadata, title: 'Changed', delay: 0 }, added]);
    expect(chrome.storage.local.set).toHaveBeenCalledTimes(3);
    expect(vi.mocked(chrome.storage.local.set).mock.calls[0][0]).toEqual({ registeredSubtitles: [metadata, added], [added.id]: body });
    expect(stored[id]).toEqual(body);
    expect(stored.unrelated).toEqual({ keep: true });
  });

  it.each(['metadata', 'body'])('rejects an ID collision with existing %s', async kind => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-0000-0000-000000000001');
    if (kind === 'body') stored.registeredSubtitles = [];
    const before = structuredClone(stored);
    await expect(addRegisteredSubtitle({ title: 'Collision', language: 'en', body })).rejects.toThrow('already exists');
    expect(stored).toEqual(before);
  });

  it('rejects a missing update without writing and preserves orphan body on missing delete', async () => {
    stored[other] = body;
    await expect(updateRegisteredSubtitle(other, { title: 'missing' })).rejects.toThrow('not found');
    await deleteRegisteredSubtitle(other);
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    expect(chrome.storage.local.remove).not.toHaveBeenCalled();
    expect(stored[other]).toEqual(body);
  });

  it('does not normalize malformed stored metadata or write after read failure', async () => {
    stored.registeredSubtitles = [{ ...metadata, title: 12 }];
    await expect(updateRegisteredSubtitle(id, { delay: 1 })).rejects.toThrow();
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    vi.mocked(chrome.storage.local.get).mockRejectedValueOnce(new Error('read'));
    await expect(deleteRegisteredSubtitle(id)).rejects.toThrow('read');
    expect(chrome.storage.local.remove).not.toHaveBeenCalled();
  });

  it('continues the queue after failed writes', async () => {
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('write'));
    const first = updateRegisteredSubtitle(id, { title: 'lost' });
    const next = updateRegisteredSubtitle(id, { delay: -1 });
    await expect(first).rejects.toThrow('write');
    await next;
    expect(stored.registeredSubtitles).toEqual([{ ...metadata, delay: -1 }]);
  });

  it('deletes only its own record from the latest list', async () => {
    const another = { ...metadata, id: other, title: 'Other' };
    vi.mocked(chrome.storage.local.remove).mockImplementationOnce(async () => {
      delete stored[id];
      stored.registeredSubtitles = [metadata, another];
      stored[other] = body;
    });
    await deleteRegisteredSubtitle(id);
    expect(stored).toEqual({ registeredSubtitles: [another], [other]: body, unrelated: { keep: true } });
  });

  it('does not change metadata when body removal fails', async () => {
    vi.mocked(chrome.storage.local.remove).mockRejectedValueOnce(new Error('remove'));
    await expect(deleteRegisteredSubtitle(id)).rejects.toThrow('remove');
    expect(stored.registeredSubtitles).toEqual([metadata]);
    expect(stored[id]).toEqual(body);
  });

  it.each(['read', 'write', 'schema'])('restores only the body after post-delete %s failure', async stage => {
    vi.mocked(chrome.storage.local.remove).mockImplementationOnce(async () => {
      delete stored[id];
      if (stage === 'read') vi.mocked(chrome.storage.local.get).mockRejectedValueOnce(new Error('read'));
      if (stage === 'write') vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('write'));
      if (stage === 'schema') stored.registeredSubtitles = [{ ...metadata, title: 12 }];
    });
    await expect(deleteRegisteredSubtitle(id)).rejects.toThrow();
    expect(stored[id]).toEqual(body);
    expect(stored.unrelated).toEqual({ keep: true });
    expect(vi.mocked(chrome.storage.local.set).mock.calls.at(-1)![0]).toEqual({ [id]: body });
  });

  it.each(['restore', 'conflict'])('distinguishes recovery %s failure and keeps external data', async stage => {
    vi.mocked(chrome.storage.local.set).mockImplementationOnce(async () => {
      if (stage === 'conflict') stored[id] = [{ start: 5, end: 6, text: 'external' }];
      else vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('restore'));
      throw new Error('metadata write');
    });
    await expect(deleteRegisteredSubtitle(id)).rejects.toBeInstanceOf(SubtitleDeleteRecoveryError);
    expect(stored[id]).toEqual(stage === 'conflict' ? [{ start: 5, end: 6, text: 'external' }] : undefined);
    await updateRegisteredSubtitle(id, { title: 'queue still works' });
  });
});
