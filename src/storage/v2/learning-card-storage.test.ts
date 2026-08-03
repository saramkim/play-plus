import { describe, expect, expectTypeOf, it } from 'vitest';

import { createV2LearningCardStorage, V2LearningCardStorageArea } from './learning-card-storage';
import { LearningCard } from './type';

describe('v2 learning card storage', () => {
  it('accepts the production Chrome local storage shape', () => {
    expectTypeOf(chrome.storage.local).toMatchTypeOf<V2LearningCardStorageArea>();
  });

  it('fails closed when the key is missing or invalid', async () => {
    await expect(createV2LearningCardStorage(new FakeLocalStorage()).get()).rejects.toThrow();
    await expect(
      createV2LearningCardStorage(new FakeLocalStorage({ learningCards: [{ invalid: true }] })).get()
    ).rejects.toThrow();
  });

  it('strictly validates an add before writing', async () => {
    const storage = new FakeLocalStorage({ learningCards: [] });
    const api = createV2LearningCardStorage(storage);

    await expect(api.add({ ...card('one'), id: 'invalid' })).rejects.toThrow();
    expect(storage.setCalls).toEqual([]);
  });

  it('rejects an add that reuses an existing stable id', async () => {
    const storage = new FakeLocalStorage({ learningCards: [card('one')] });
    const api = createV2LearningCardStorage(storage);

    await expect(api.add(card('one'))).rejects.toThrow('Duplicate learning card id');
    expect(storage.setCalls).toEqual([]);
  });

  it('does not write when the persisted array is invalid', async () => {
    const storage = new FakeLocalStorage({ learningCards: [{ invalid: true }] });
    const api = createV2LearningCardStorage(storage);

    await expect(api.add(card('new'))).rejects.toThrow();
    expect(storage.setCalls).toEqual([]);
  });

  it('appends once while preserving order and existing duplicates', async () => {
    const duplicate = card('duplicate');
    const storage = new FakeLocalStorage({ learningCards: [duplicate, duplicate] });
    const api = createV2LearningCardStorage(storage);

    await expect(api.add(card('new'))).resolves.toEqual(card('new'));
    expect(storage.values.learningCards).toEqual([duplicate, duplicate, card('new')]);
    expect(storage.setCalls).toHaveLength(1);
  });

  it('serializes concurrent adds on one API instance without losing entries', async () => {
    const storage = new FakeLocalStorage({ learningCards: [] });
    const api = createV2LearningCardStorage(storage);

    await Promise.all([api.add(card('first')), api.add(card('second')), api.add(card('third'))]);

    expect(storage.values.learningCards).toEqual([card('first'), card('second'), card('third')]);
    expect(storage.setCalls).toHaveLength(3);
  });

  it('allows the next mutation after a write failure', async () => {
    const storage = new FakeLocalStorage({ learningCards: [] });
    const api = createV2LearningCardStorage(storage);
    storage.failNextWrite = true;

    await expect(api.add(card('failed'))).rejects.toThrow('Injected write failure');
    await expect(api.add(card('recovered'))).resolves.toEqual(card('recovered'));

    expect(storage.values.learningCards).toEqual([card('recovered')]);
  });

  it('updates exactly one card while preserving immutable provenance', async () => {
    const original = card('original');
    const untouched = card('untouched');
    const storage = new FakeLocalStorage({ learningCards: [original, untouched] });
    const api = createV2LearningCardStorage(storage);
    const edited: LearningCard = {
      ...original,
      content: {
        learning: { text: 'Edited learning', language: 'en' },
        support: { text: 'Edited support', language: 'ko' },
      },
      studyState: 'completed',
    };

    await expect(api.update(original.id, edited)).resolves.toEqual(edited);
    expect(storage.values.learningCards).toEqual([edited, untouched]);
    expect(storage.setCalls).toHaveLength(1);
  });

  it('fails an update without writing for missing, invalid, or provenance-changing cards', async () => {
    const original = card('original');
    const storage = new FakeLocalStorage({ learningCards: [original] });
    const api = createV2LearningCardStorage(storage);

    await expect(api.update('card-missing', card('missing'))).rejects.toThrow('Learning card not found');
    await expect(api.update(original.id, card('other'))).rejects.toThrow('cannot change its id');
    await expect(api.update(original.id, { ...original, id: 'invalid' })).rejects.toThrow();
    await expect(
      api.update(original.id, {
        ...original,
        content: { support: { text: 'Support only', language: 'ko' } },
      } as unknown as LearningCard)
    ).rejects.toThrow();
    await expect(
      api.update(original.id, {
        ...original,
        source: { ...original.source, startTime: original.source.startTime + 1 },
      })
    ).rejects.toThrow('cannot change its source');
    await expect(
      api.update(original.id, { ...original, createdAt: '2026-08-03T00:00:00.000Z' })
    ).rejects.toThrow('cannot change its creation time');

    expect(storage.values.learningCards).toEqual([original]);
    expect(storage.setCalls).toEqual([]);
  });

  it('deletes one card and restores it at its original index', async () => {
    const first = card('first');
    const deleted = card('deleted');
    const last = card('last');
    const storage = new FakeLocalStorage({ learningCards: [first, deleted, last] });
    const api = createV2LearningCardStorage(storage);

    await expect(api.delete(deleted.id)).resolves.toEqual({ card: deleted, index: 1 });
    expect(storage.values.learningCards).toEqual([first, last]);
    await expect(api.restore({ card: deleted, index: 1 })).resolves.toEqual(deleted);
    expect(storage.values.learningCards).toEqual([first, deleted, last]);
    expect(storage.setCalls).toHaveLength(2);
  });

  it('fails closed for missing deletes and duplicate or invalid restores', async () => {
    const existing = card('existing');
    const storage = new FakeLocalStorage({ learningCards: [existing] });
    const api = createV2LearningCardStorage(storage);

    await expect(api.delete('card-missing')).rejects.toThrow('Learning card not found');
    await expect(api.restore({ card: existing, index: 0 })).rejects.toThrow(
      'Duplicate learning card id'
    );
    for (const index of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(api.restore({ card: card('restore'), index })).rejects.toThrow(
        'non-negative integer index'
      );
    }
    await expect(api.restore({ card: { ...card('restore'), id: 'invalid' }, index: 0 })).rejects.toThrow();

    expect(storage.values.learningCards).toEqual([existing]);
    expect(storage.setCalls).toEqual([]);
  });

  it('fails every new mutation before writing when the persisted array is invalid', async () => {
    const createInvalidApi = () => {
      const storage = new FakeLocalStorage({ learningCards: [{ invalid: true }] });
      return { api: createV2LearningCardStorage(storage), storage };
    };
    const update = createInvalidApi();
    const deletion = createInvalidApi();
    const restore = createInvalidApi();

    await expect(update.api.update('card-target', card('target'))).rejects.toThrow();
    await expect(deletion.api.delete('card-target')).rejects.toThrow();
    await expect(restore.api.restore({ card: card('target'), index: 0 })).rejects.toThrow();

    expect(update.storage.setCalls).toEqual([]);
    expect(deletion.storage.setCalls).toEqual([]);
    expect(restore.storage.setCalls).toEqual([]);
  });

  it('serializes mixed concurrent mutations in invocation order', async () => {
    const first = card('first');
    const second = card('second');
    const restored = card('restored');
    const storage = new FakeLocalStorage({ learningCards: [first, second] });
    const api = createV2LearningCardStorage(storage);
    const updatedFirst = { ...first, studyState: 'completed' as const };

    await Promise.all([
      api.update(first.id, updatedFirst),
      api.delete(second.id),
      api.restore({ card: restored, index: 1 }),
    ]);

    expect(storage.values.learningCards).toEqual([updatedFirst, restored]);
    expect(storage.setCalls).toHaveLength(3);
  });

  it('rereads strict storage for every queued mutation and recovers after failure', async () => {
    const original = card('original');
    const storage = new FakeLocalStorage({ learningCards: [original] });
    const api = createV2LearningCardStorage(storage);
    storage.failNextWrite = true;

    await expect(api.update(original.id, { ...original, studyState: 'completed' })).rejects.toThrow(
      'Injected write failure'
    );
    await expect(api.delete(original.id)).resolves.toEqual({ card: original, index: 0 });

    expect(storage.values.learningCards).toEqual([]);
    expect(storage.getCalls).toEqual(['learningCards', 'learningCards']);
  });
});

class FakeLocalStorage implements V2LearningCardStorageArea {
  values: Record<string, unknown>;
  getCalls: (string | string[] | null)[] = [];
  setCalls: Record<string, unknown>[] = [];
  failNextWrite = false;

  constructor(values: Record<string, unknown> = {}) {
    this.values = structuredClone(values);
  }

  async get(keys: string | string[] | null = null) {
    this.getCalls.push(structuredClone(keys));
    if (keys === null) return structuredClone(this.values);
    const requested = Array.isArray(keys) ? keys : [keys];
    return Object.fromEntries(
      requested
        .filter((key) => Object.prototype.hasOwnProperty.call(this.values, key))
        .map((key) => [key, structuredClone(this.values[key])])
    );
  }

  async set(items: Record<string, unknown>) {
    if (this.failNextWrite) {
      this.failNextWrite = false;
      throw new Error('Injected write failure');
    }
    const cloned = structuredClone(items);
    this.setCalls.push(cloned);
    Object.assign(this.values, cloned);
  }
}

const card = (suffix: string): LearningCard => ({
  id: `card-${suffix}`,
  content: { learning: { text: 'Learning', language: 'en' } },
  source: { url: 'https://www.coupangplay.com/play/example', startTime: 1, endTime: 2 },
  studyState: 'active',
  createdAt: '2026-08-02T00:00:00.000Z',
});
