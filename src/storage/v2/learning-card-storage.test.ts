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
});

class FakeLocalStorage implements V2LearningCardStorageArea {
  values: Record<string, unknown>;
  setCalls: Record<string, unknown>[] = [];
  failNextWrite = false;

  constructor(values: Record<string, unknown> = {}) {
    this.values = structuredClone(values);
  }

  async get(keys: string | string[] | null = null) {
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
