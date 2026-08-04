import { describe, expect, expectTypeOf, it } from 'vitest';

import { DEFAULT_V2_SYNC_STORAGE } from './default';
import {
  createV2FirstEntryStorage,
  V2FirstEntryConfirmation,
  V2FirstEntryStorageArea,
} from './first-entry-storage';
import type { V2MigrationState, V2ShortcutConfirmation, V2SyncStorage } from './type';

describe('v2 first-entry storage', () => {
  it('accepts the production Chrome Storage area shape', () => {
    expectTypeOf(chrome.storage.sync).toMatchTypeOf<V2FirstEntryStorageArea>();
    expectTypeOf(chrome.storage.local).toMatchTypeOf<V2FirstEntryStorageArea>();
  });

  it('writes explicit choices together, verifies them, and clears only confirmations', async () => {
    const confirmations = createAllConfirmations();
    const syncData = createSyncData();
    syncData.shortcuts.enabled = true;
    syncData.playbackSpeed.enabled = true;
    syncData.playbackSpeed.decrease = 'KeyD';
    const migrationState = createMigrationState(confirmations);
    const unavailable = migrationState.unavailableRegisteredSubtitles;
    const sync = new FakeStorageArea(syncData);
    const local = new FakeStorageArea({ migrationState });
    const storage = createV2FirstEntryStorage({ local, sync });
    const learningProfile = { learningLanguage: 'ko', supportLanguage: 'en' } as const;

    await storage.confirm({
      learningProfile,
      shortcutChoices: {
        saveCard: 'KeyS',
        previousCue: 'KeyP',
        nextCue: null,
        repeatCurrentCue: 'KeyR',
        speedIncrease: 'Equal',
        speedDecrease: null,
        speedReset: 'Digit0',
      },
    });

    expect(sync.setCalls).toEqual([
      {
        learningProfile,
        learningControls: {
          previousCue: { enabled: true },
          nextCue: { enabled: false },
          repeatCurrentCue: { enabled: true },
        },
        shortcuts: {
          enabled: true,
          saveCard: 'KeyS',
          previousCue: 'KeyP',
          nextCue: '',
          repeatCurrentCue: 'KeyR',
        },
        playbackSpeed: {
          enabled: true,
          increase: 'Equal',
          decrease: '',
          reset: 'Digit0',
        },
      },
    ]);
    expect(local.setCalls).toEqual([
      {
        migrationState: {
          status: 'complete',
          sourceVersion: '1.11.0',
          shortcutConfirmations: [],
          unavailableRegisteredSubtitles: unavailable,
        },
      },
    ]);
    expect(sync.values.subtitleDisplay).toEqual(syncData.subtitleDisplay);
  });

  it.each([
    ['missing', {}],
    ['extra', { saveCard: 'KeyS', previousCue: null }],
    ['invalid', { saveCard: 'KeyX' }],
  ])('rejects %s shortcut choices before writing', async (_label, shortcutChoices) => {
    const sync = new FakeStorageArea(createSyncData());
    const local = new FakeStorageArea({
      migrationState: createMigrationState([createConfirmation('saveCard', 'savePrimary', 'KeyS')]),
    });
    const storage = createV2FirstEntryStorage({ local, sync });

    await expect(
      storage.confirm({
        learningProfile: { learningLanguage: 'en', supportLanguage: null },
        shortcutChoices: shortcutChoices as V2FirstEntryConfirmation['shortcutChoices'],
      })
    ).rejects.toThrow();

    expect(sync.setCalls).toEqual([]);
    expect(local.setCalls).toEqual([]);
  });

  it('rejects duplicate non-empty shortcuts across shortcuts and playback speed', async () => {
    const sync = new FakeStorageArea(createSyncData());
    const local = new FakeStorageArea({
      migrationState: createMigrationState([
        createConfirmation('speedIncrease', 'playbackSpeed.increase', 'ArrowLeft'),
      ]),
    });
    const storage = createV2FirstEntryStorage({ local, sync });

    await expect(
      storage.confirm({
        learningProfile: { learningLanguage: 'en', supportLanguage: 'ko' },
        shortcutChoices: { speedIncrease: 'ArrowLeft' },
      })
    ).rejects.toThrow();
    expect(sync.setCalls).toEqual([]);
    expect(local.setCalls).toEqual([]);
  });

  it('fails closed when the current canonical snapshot is incomplete', async () => {
    const sync = new FakeStorageArea({ learningProfile: DEFAULT_V2_SYNC_STORAGE.learningProfile });
    const local = new FakeStorageArea({ migrationState: createMigrationState([]) });
    const storage = createV2FirstEntryStorage({ local, sync });

    await expect(
      storage.confirm({
        learningProfile: DEFAULT_V2_SYNC_STORAGE.learningProfile,
        shortcutChoices: {},
      })
    ).rejects.toThrow();
    expect(sync.setCalls).toEqual([]);
    expect(local.setCalls).toEqual([]);
  });

  it('does not clear confirmations when strict sync readback differs', async () => {
    const sync = new FakeStorageArea(createSyncData());
    const local = new FakeStorageArea({
      migrationState: createMigrationState([createConfirmation('saveCard', 'savePrimary', 'KeyS')]),
    });
    sync.afterSet = (_items, values) => {
      values.shortcuts = { ...(values.shortcuts as V2SyncStorage['shortcuts']), saveCard: 'KeyX' };
    };
    const storage = createV2FirstEntryStorage({ local, sync });

    await expect(
      storage.confirm({
        learningProfile: DEFAULT_V2_SYNC_STORAGE.learningProfile,
        shortcutChoices: { saveCard: 'KeyS' },
      })
    ).rejects.toThrow('readback did not match');
    expect(local.setCalls).toEqual([]);
  });

  it('repeats idempotently when interrupted after the combined sync write', async () => {
    const sync = new FakeStorageArea(createSyncData());
    const local = new FakeStorageArea({
      migrationState: createMigrationState([createConfirmation('saveCard', 'savePrimary', 'KeyS')]),
    });
    local.failNextSet = true;
    const storage = createV2FirstEntryStorage({ local, sync });
    const confirmation: V2FirstEntryConfirmation = {
      learningProfile: { learningLanguage: 'ko', supportLanguage: null },
      shortcutChoices: { saveCard: 'KeyS' },
    };

    await expect(storage.confirm(confirmation)).rejects.toThrow('Injected set failure');
    await expect(storage.confirm(confirmation)).resolves.toBeUndefined();

    expect(sync.setCalls).toHaveLength(2);
    expect(sync.setCalls[1]).toEqual(sync.setCalls[0]);
    expect(local.values.migrationState).toMatchObject({ shortcutConfirmations: [] });
  });
});

const createSyncData = (): V2SyncStorage => structuredClone(DEFAULT_V2_SYNC_STORAGE);

const createMigrationState = (
  shortcutConfirmations: V2ShortcutConfirmation[]
): V2MigrationState => ({
  status: 'complete',
  sourceVersion: '1.11.0',
  shortcutConfirmations,
  unavailableRegisteredSubtitles: [{ reason: 'orphan-body', bodyKey: 'subtitle-orphan' }],
});

const createAllConfirmations = (): V2ShortcutConfirmation[] => [
  createConfirmation('saveCard', 'savePrimary', 'KeyS'),
  createConfirmation('previousCue', 'videoSkip.backward', 'KeyP'),
  createConfirmation('nextCue', 'videoSkip.forward', 'KeyN'),
  createConfirmation('repeatCurrentCue', 'loop.loopCurrentSubtitle', 'KeyR'),
  createConfirmation('speedIncrease', 'playbackSpeed.increase', 'Equal'),
  createConfirmation('speedDecrease', 'playbackSpeed.decrease', 'Minus'),
  createConfirmation('speedReset', 'playbackSpeed.reset', 'Digit0'),
];

const createConfirmation = (
  field: V2ShortcutConfirmation['field'],
  source: V2ShortcutConfirmation['candidates'][number]['source'],
  shortcut: string
): V2ShortcutConfirmation => ({
  field,
  candidates: [{ source, shortcut }],
  reason: 'ambiguous-semantics',
});

class FakeStorageArea implements V2FirstEntryStorageArea {
  values: Record<string, unknown>;
  setCalls: Record<string, unknown>[] = [];
  afterSet?: (items: Record<string, unknown>, values: Record<string, unknown>) => void;
  failNextSet = false;

  constructor(values: Record<string, unknown>) {
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
    const cloned = structuredClone(items);
    this.setCalls.push(cloned);
    if (this.failNextSet) {
      this.failNextSet = false;
      throw new Error('Injected set failure');
    }
    Object.assign(this.values, cloned);
    this.afterSet?.(cloned, this.values);
  }
}
