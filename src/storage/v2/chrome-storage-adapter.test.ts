import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';

import { runV2Migration } from './chrome-storage-adapter';
import { createDefaultListeningProgress } from './default';
import { createV1_11Fixture } from './fixtures/v1-11';

const SNAPSHOT_KEY = 'v1MigrationSource';
const FIRST_SUBTITLE_ID = 'subtitle-11111111-1111-4111-8111-111111111111';
const ORPHAN_SUBTITLE_ID = 'subtitle-55555555-5555-4555-8555-555555555555';

describe('v2 Chrome Storage migration adapter', () => {
  let storage: ReturnType<typeof createFakeStorage>;

  beforeEach(() => {
    storage = createFakeStorage();
  });

  it('accepts the production Chrome Storage shape', () => {
    expectTypeOf(chrome.storage).toMatchTypeOf<Parameters<typeof runV2Migration>[0]>();
  });

  it('migrates physical v1 keys to canonical v2 keys without deleting dynamic subtitle bodies', async () => {
    const fixture = createV1_11Fixture();
    const orphanBody = [{ start: 1, end: 2, text: 'Orphan body' }];
    seedV1Fixture(storage, fixture, { [ORPHAN_SUBTITLE_ID]: orphanBody });

    await expect(runV2Migration(storage)).resolves.toEqual({ kind: 'migrated', version: 2 });

    expect(storage.local.values.dataSchemaVersion).toBe(2);
    expect(storage.local.values.learningCards).toHaveLength(fixture.local.savedSubtitles.length);
    expect(storage.local.values.listeningProgress).toEqual(createDefaultListeningProgress());
    expect(storage.local.values.registeredSubtitles).toEqual(fixture.local.registeredSubtitles);
    expect(storage.local.values[FIRST_SUBTITLE_ID]).toEqual(fixture.local.subtitleBodies[FIRST_SUBTITLE_ID]);
    expect(storage.local.values[ORPHAN_SUBTITLE_ID]).toEqual(orphanBody);
    expect(storage.local.values).not.toHaveProperty('subtitleBodies');
    expect(storage.local.values).not.toHaveProperty('savedSubtitles');
    expect(storage.local.values).not.toHaveProperty(SNAPSHOT_KEY);
    expect(storage.sync.values).not.toHaveProperty('primarySubtitle');
    expect(storage.sync.values).not.toHaveProperty('secondarySubtitle');
    expect(storage.sync.values).not.toHaveProperty('videoSkip');
    expect(storage.sync.values).not.toHaveProperty('subVideoSkip');
    expect(storage.sync.values).not.toHaveProperty('loop');
    expect(storage.sync.values).not.toHaveProperty('learningControls');
    expect(storage.sync.values.shortcuts).toMatchObject({ saveCard: 'KeyS' });
    expect(storage.sync.values.playbackSpeed).toEqual(fixture.sync.playbackSpeed);
    expect(storage.local.removeCalls).toEqual([[SNAPSHOT_KEY, 'savedSubtitles']]);
    expect(storage.sync.removeCalls).toEqual([
      ['primarySubtitle', 'secondarySubtitle', 'videoSkip', 'subVideoSkip', 'loop'],
    ]);
  });

  it('retries from the raw snapshot instead of partially overwritten live keys', async () => {
    const fixture = createV1_11Fixture();
    seedV1Fixture(storage, fixture);
    storage.sync.failNextSetWhen = (items) => 'learningProfile' in items;

    await expect(runV2Migration(storage)).rejects.toThrow('Injected set failure');

    expect(storage.local.values[SNAPSHOT_KEY]).toEqual({
      sync: fixture.sync,
      local: fixture.local,
    });
    expect(storage.local.values).toHaveProperty('learningCards');
    expect(storage.local.values.listeningProgress).toEqual(createDefaultListeningProgress());
    expect(storage.local.values).not.toHaveProperty('dataSchemaVersion');

    storage.local.values.savedSubtitles = [{ id: 'partially-overwritten-live-value' }];
    storage.sync.values.shortcuts = { invalid: true };

    await expect(runV2Migration(storage)).resolves.toEqual({ kind: 'migrated', version: 2 });

    expect(storage.local.values.learningCards).toHaveLength(fixture.local.savedSubtitles.length);
    expect(storage.local.values.learningCards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ content: { unassigned: { text: 'Keep duplicate', language: 'und' } } }),
      ])
    );
    expect(storage.local.values).not.toHaveProperty(SNAPSHOT_KEY);
  });

  it('fails closed when an existing snapshot is invalid instead of falling back to live storage', async () => {
    const fixture = createV1_11Fixture();
    seedV1Fixture(storage, fixture);
    storage.local.values[SNAPSHOT_KEY] = {
      sync: { primarySubtitle: { fontSize: 99 } },
      local: {},
    };

    await expect(runV2Migration(storage)).rejects.toThrow();

    expect(storage.local.setCalls).toEqual([]);
    expect(storage.sync.setCalls).toEqual([]);
    expect(storage.local.removeCalls).toEqual([]);
    expect(storage.sync.removeCalls).toEqual([]);
    expect(storage.local.values).not.toHaveProperty('dataSchemaVersion');
  });

  it('validates the persisted raw snapshot before writing canonical data', async () => {
    const fixture = createV1_11Fixture();
    seedV1Fixture(storage, fixture);
    storage.local.afterSet = (items, values) => {
      if (!(SNAPSHOT_KEY in items)) return;
      values[SNAPSHOT_KEY] = { sync: { primarySubtitle: { fontSize: 99 } }, local: {} };
    };

    await expect(runV2Migration(storage)).rejects.toThrow();

    expect(storage.local.setCalls).toHaveLength(1);
    expect(storage.local.setCalls[0]).toHaveProperty(SNAPSHOT_KEY);
    expect(storage.local.values).not.toHaveProperty('learningCards');
    expect(storage.local.values).not.toHaveProperty('dataSchemaVersion');
    expect(storage.sync.setCalls).toEqual([]);
  });

  it('keeps the marker cleanup-pending and retries only cleanup after a post-marker failure', async () => {
    const fixture = createV1_11Fixture();
    seedV1Fixture(storage, fixture);
    storage.sync.failNextRemove = true;

    await expect(runV2Migration(storage)).rejects.toThrow('Injected remove failure');

    expect(storage.local.values.dataSchemaVersion).toBe(2);
    expect(storage.local.values.migrationState).toMatchObject({ status: 'cleanup-pending' });
    expect(storage.local.values).not.toHaveProperty(SNAPSHOT_KEY);
    expect(storage.local.setCalls.filter((items) => 'learningCards' in items)).toHaveLength(1);
    expect(storage.sync.setCalls.filter((items) => 'learningProfile' in items)).toHaveLength(1);

    await expect(runV2Migration(storage)).resolves.toEqual({ kind: 'ready', version: 2 });

    expect(storage.local.values.migrationState).toMatchObject({ status: 'complete' });
    expect(storage.local.setCalls.filter((items) => 'learningCards' in items)).toHaveLength(1);
    expect(storage.sync.setCalls.filter((items) => 'learningProfile' in items)).toHaveLength(1);
    expect(storage.sync.removeCalls).toHaveLength(2);
  });

  it('initializes a fresh install without creating a v1 snapshot or running cleanup', async () => {
    await expect(runV2Migration(storage)).resolves.toEqual({ kind: 'initialized', version: 2 });

    expect(storage.local.values.dataSchemaVersion).toBe(2);
    expect(storage.local.values.learningCards).toEqual([]);
    expect(storage.local.values.listeningProgress).toEqual(createDefaultListeningProgress());
    expect(storage.local.values).not.toHaveProperty(SNAPSHOT_KEY);
    expect(storage.local.removeCalls).toEqual([]);
    expect(storage.sync.removeCalls).toEqual([]);
  });

  it('retries an interrupted fresh initialization without misreading canonical keys as v1', async () => {
    storage.sync.failNextSetWhen = (items) => 'learningProfile' in items;

    await expect(runV2Migration(storage)).rejects.toThrow('Injected set failure');

    expect(storage.local.values.migrationState).toMatchObject({ status: 'writing', sourceVersion: null });
    expect(storage.local.values.registeredSubtitles).toEqual([]);
    expect(storage.local.values.listeningProgress).toEqual(createDefaultListeningProgress());
    expect(storage.local.values).not.toHaveProperty(SNAPSHOT_KEY);
    expect(storage.local.values).not.toHaveProperty('dataSchemaVersion');

    await expect(runV2Migration(storage)).resolves.toEqual({ kind: 'initialized', version: 2 });

    expect(storage.local.values.migrationState).toMatchObject({ status: 'complete', sourceVersion: null });
    expect(storage.local.setCalls.filter((items) => 'learningCards' in items)).toHaveLength(2);
    expect(storage.local.removeCalls).toEqual([]);
    expect(storage.sync.removeCalls).toEqual([]);
  });

  it('fails closed for an invalid unmarked v2 state instead of falling back to v1', async () => {
    storage.local.values = {
      learningCards: [{ invalid: true }],
      listeningProgress: createDefaultListeningProgress(),
      registeredSubtitles: [],
      migrationState: {
        status: 'writing',
        sourceVersion: null,
        shortcutConfirmations: [],
        unavailableRegisteredSubtitles: [],
      },
    };

    await expect(runV2Migration(storage)).rejects.toThrow('Unmarked V2 migration state is invalid');

    expect(storage.local.setCalls).toEqual([]);
    expect(storage.sync.setCalls).toEqual([]);
    expect(storage.local.removeCalls).toEqual([]);
    expect(storage.sync.removeCalls).toEqual([]);
  });

  it('fails marked readiness closed when the required physical progress key is missing', async () => {
    await runV2Migration(storage);
    delete storage.local.values.listeningProgress;
    storage.local.setCalls = [];
    storage.sync.setCalls = [];

    await expect(runV2Migration(storage)).rejects.toThrow();

    expect(storage.local.setCalls).toEqual([]);
    expect(storage.sync.setCalls).toEqual([]);
  });

  it('does not write the marker when progress readback is corrupted', async () => {
    storage.local.afterSet = (items, values) => {
      if (!('listeningProgress' in items)) return;
      values.listeningProgress = { version: 1, videos: {}, history: [] };
    };

    await expect(runV2Migration(storage)).rejects.toThrow();

    expect(storage.local.values).not.toHaveProperty('dataSchemaVersion');
    expect(storage.local.setCalls.filter((items) => 'listeningProgress' in items)).toHaveLength(1);
    expect(storage.sync.setCalls.filter((items) => 'learningProfile' in items)).toHaveLength(1);
  });
});

const seedV1Fixture = (
  storage: ReturnType<typeof createFakeStorage>,
  fixture: ReturnType<typeof createV1_11Fixture>,
  extraBodies: Record<string, unknown> = {}
) => {
  storage.sync.values = structuredClone(fixture.sync);
  storage.local.values = {
    savedSubtitles: structuredClone(fixture.local.savedSubtitles),
    registeredSubtitles: structuredClone(fixture.local.registeredSubtitles),
    ...structuredClone(fixture.local.subtitleBodies),
    ...structuredClone(extraBodies),
  };
};

const createFakeStorage = () => ({
  local: new FakeStorageArea(),
  sync: new FakeStorageArea(),
});

class FakeStorageArea {
  values: Record<string, unknown> = {};
  setCalls: Record<string, unknown>[] = [];
  removeCalls: (string | string[])[] = [];
  failNextRemove = false;
  failNextSetWhen?: (items: Record<string, unknown>) => boolean;
  afterSet?: (items: Record<string, unknown>, values: Record<string, unknown>) => void;

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
    if (this.failNextSetWhen?.(items)) {
      this.failNextSetWhen = undefined;
      throw new Error('Injected set failure');
    }
    const cloned = structuredClone(items);
    this.setCalls.push(cloned);
    Object.assign(this.values, cloned);
    this.afterSet?.(cloned, this.values);
  }

  async remove(keys: string | string[]) {
    this.removeCalls.push(structuredClone(keys));
    if (this.failNextRemove) {
      this.failNextRemove = false;
      throw new Error('Injected remove failure');
    }
    for (const key of Array.isArray(keys) ? keys : [keys]) delete this.values[key];
  }
}
