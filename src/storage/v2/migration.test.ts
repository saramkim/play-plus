import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createDefaultListeningProgress } from './default';
import { createV1_11Fixture } from './fixtures/v1-11';
import {
  createFreshV2MigrationPlan,
  createV1_11MigrationPlan,
  ensureV2Ready,
  V1_11MigrationSource,
  V2MigrationCoordinatorDependencies,
} from './migration';
import { V2LocalData, V2Marker, V2MigrationState, V2SyncStorage } from './type';

describe('v1.11 migration plan', () => {
  it('preserves every saved item, including order and duplicates, with stable SHA-256 ids', async () => {
    const fixture = createV1_11Fixture();
    const first = await createV1_11MigrationPlan(fixture);
    const second = await createV1_11MigrationPlan(createV1_11Fixture());

    expect(first.local.learningCards).toEqual(second.local.learningCards);
    expect(first.local.learningCards).toHaveLength(fixture.local.savedSubtitles.length);
    expect(first.local.learningCards.map(({ id }) => id)).toEqual([
      'card-v1-a8ac59ad46a8401345a916f47b27879a52200e0b50fa76022ffda835fc8a67d8',
      expect.stringMatching(/^card-v1-[0-9a-f]{64}$/),
      expect.stringMatching(/^card-v1-[0-9a-f]{64}$/),
    ]);
    expect(new Set(first.local.learningCards.map(({ id }) => id)).size).toBe(3);
    expect(first.local.learningCards[0]).toEqual({
      id: first.local.learningCards[0].id,
      content: { unassigned: { text: 'Keep duplicate', language: 'und' } },
      source: { url: 'https://www.coupangplay.com/play/example', startTime: 12.5 },
      studyState: 'active',
      createdAt: '2026-07-01T00:00:00.000Z',
    });
    expect(first.local.learningCards[1].content).toEqual(first.local.learningCards[0].content);
    expect(first.local.learningCards[1].source).toEqual(first.local.learningCards[0].source);
    expect(first.local.listeningProgress).toEqual(createDefaultListeningProgress());
  });

  it('maps language roles, appearance, approved shortcuts, and valid registered subtitles exactly', async () => {
    const fixture = createV1_11Fixture();
    const plan = await createV1_11MigrationPlan(fixture);

    expect(plan.sync.learningProfile).toEqual({ learningLanguage: 'en', supportLanguage: 'ko' });
    expect(plan.sync.subtitleDisplay).toEqual({
      learning: {
        visibility: 'visible',
        appearance: {
          positionReference: 'center',
          positionOffset: 42,
          color: '#123456',
          fontSize: 9,
          fontWeight: 5,
          backgroundOpacity: 35,
          lineBreak: false,
        },
      },
      support: {
        visibility: 'hidden',
        appearance: {
          positionReference: 'top',
          positionOffset: -12,
          color: '#abcdef',
          fontSize: 3,
          fontWeight: 2,
          backgroundOpacity: 80,
          lineBreak: true,
        },
      },
    });
    expect(plan.sync).not.toHaveProperty('learningControls');
    expect(plan.sync.shortcuts).toMatchObject({
      saveLearning: { key: 'KeyS', enabled: true }, saveSupport: { key: '', enabled: true },
      previousCue: { key: 'KeyA', enabled: true }, nextCue: { key: 'KeyD', enabled: true },
      repeatCurrentCue: { key: 'KeyR', enabled: true },
    });
    expect(plan.sync.playbackSpeed).toEqual({
      increase: { key: 'Equal', enabled: true }, decrease: { key: 'Minus', enabled: true }, reset: { key: 'Digit0', enabled: true },
    });
    expect(plan.local.registeredSubtitles).toEqual(fixture.local.registeredSubtitles);
    expect(plan.local.subtitleBodies).toEqual(fixture.local.subtitleBodies);
    expect(plan.local.migrationState.shortcutConfirmations).toEqual([]);
  });

  it('preserves separate role saves, arbitrary cue amounts and only confirms active collisions', async () => {
    const fixture = createV1_11Fixture();
    fixture.sync.shortcuts.saveSecondary = 'KeyW';
    fixture.sync.videoSkip.skipTime = 2;
    fixture.sync.loop.loopCurrentSubtitle = 'Equal';
    const plan = await createV1_11MigrationPlan(fixture);
    expect(plan.sync.shortcuts.saveLearning).toEqual({ key: 'KeyS', enabled: true });
    expect(plan.sync.shortcuts.saveSupport).toEqual({ key: 'KeyW', enabled: true });
    expect(plan.sync.shortcuts.navigation.primary).toMatchObject({ amount: 2, unit: 'subtitles' });
    expect(plan.sync.shortcuts.repeatCurrentCue).toEqual({ key: 'Equal', enabled: false });
    expect(plan.sync.playbackSpeed.increase).toEqual({ key: 'Equal', enabled: false });
    expect(plan.local.migrationState.shortcutConfirmations.map(({ field }) => field)).toEqual(['repeatCurrentCue', 'speedIncrease']);
  });

  it('preserves inactive duplicate keys, secondary time values and dormant fallback independently', async () => {
    const fixture = createV1_11Fixture();
    fixture.sync.shortcuts.enabled = false;
    fixture.sync.shortcuts.savePrimary = 'Equal';
    fixture.sync.videoSkip.enabled = false;
    fixture.sync.subVideoSkip.skipTime = 2;
    fixture.sync.subVideoSkip.skipTimeUnit = 'minutes';
    fixture.sync.subVideoSkip.fallbackTime = 7;
    fixture.sync.subVideoSkip.fallbackUnit = 'seconds';
    const before = structuredClone(fixture);
    const plan = await createV1_11MigrationPlan(fixture);
    expect(fixture).toEqual(before);
    expect(plan.sync.shortcuts.saveLearning).toEqual({ key: 'Equal', enabled: false });
    expect(plan.sync.shortcuts.previousCue.enabled).toBe(false);
    expect(plan.sync.shortcuts.repeatCurrentCue.enabled).toBe(true);
    expect(plan.sync.shortcuts.navigation.secondary).toEqual({ amount: 2, unit: 'minutes', fallbackEnabled: true, fallbackAmount: 7, fallbackUnit: 'seconds' });
    expect(plan.local.migrationState.shortcutConfirmations).toEqual([]);
  });

  it('retains both active collision owners for explicit resolution', async () => {
    const fixture = createV1_11Fixture();
    fixture.sync.videoSkip.backward = 'KeyS';
    const plan = await createV1_11MigrationPlan(fixture);
    expect(plan.sync.shortcuts.saveLearning).toEqual({ key: 'KeyS', enabled: false });
    expect(plan.sync.shortcuts.previousCue).toEqual({ key: 'KeyS', enabled: false });
    expect(plan.local.migrationState.shortcutConfirmations).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'saveLearning', conflictingFields: ['previousCue'], reason: 'conflict' }),
      expect.objectContaining({ field: 'previousCue', conflictingFields: ['saveLearning'], reason: 'conflict' }),
    ]));
  });

  it('preserves the published v1.11 learning preset rather than substituting fresh defaults', async () => {
    // src/storage/preset.ts at remote v1.11.0 70cf32683650b63f4fe5d3196360e299f6e51ad1.
    const fixture = createV1_11Fixture();
    Object.assign(fixture.sync.videoSkip, { forward: 'ArrowRight', backward: 'ArrowLeft', skipTime: 10, skipTimeUnit: 'seconds', fallbackTime: 10 });
    Object.assign(fixture.sync.subVideoSkip, { forward: 'KeyD', backward: 'KeyA', skipTime: 1, skipTimeUnit: 'subtitles', fallbackTime: 3 });
    Object.assign(fixture.sync.shortcuts, { savePrimary: 'KeyE', saveSecondary: 'KeyR', copyPrimary: 'KeyZ', copySecondary: 'KeyX', togglePrimary: 'KeyQ', toggleSecondary: 'KeyW' });
    Object.assign(fixture.sync.loop, { loopCurrentSubtitle: 'KeyS', playCurrentSubtitleOnce: 'KeyC' });
    Object.assign(fixture.sync.playbackSpeed, { increase: 'Period', decrease: 'Comma', reset: 'Slash' });
    const plan = await createV1_11MigrationPlan(fixture);
    expect(plan.sync.shortcuts.navigation.primary).toMatchObject({ amount: 10, unit: 'seconds', fallbackAmount: 10 });
    expect(plan.sync.shortcuts.navigation.secondary).toMatchObject({ amount: 1, unit: 'subtitles', fallbackAmount: 3 });
    expect(plan.sync.shortcuts.saveSupport).toEqual({ key: 'KeyR', enabled: true });
    expect(plan.sync.shortcuts.playOnce).toEqual({ key: 'KeyC', enabled: true });
    expect(plan.sync.playbackSpeed.increase).toEqual({ key: 'Period', enabled: true });
    expect(plan.local.migrationState.shortcutConfirmations).toEqual([]);
  });

  it('isolates invalid registered subtitles and orphan bodies without mutating the source', async () => {
    const fixture = createV1_11Fixture();
    const missingId = 'subtitle-33333333-3333-4333-8333-333333333333';
    const invalidId = 'subtitle-44444444-4444-4444-8444-444444444444';
    const orphanId = 'subtitle-55555555-5555-4555-8555-555555555555';
    fixture.local.registeredSubtitles.push(
      { id: 'not-a-subtitle-id', title: 'Invalid metadata', language: 'en', savedAt: 'invalid' },
      { id: missingId, title: 'Missing body', language: 'en', savedAt: '2026-07-01T00:04:00.000Z' },
      { id: invalidId, title: 'Invalid body', language: 'ko', savedAt: '2026-07-01T00:05:00.000Z' }
    );
    Object.assign(fixture.local.subtitleBodies, {
      [invalidId]: [{ start: 2, end: 1, text: 'Reversed cue' }],
      [orphanId]: [{ start: 1, end: 2, text: 'Orphan cue' }],
    });
    const before = structuredClone(fixture);

    const plan = await createV1_11MigrationPlan(fixture);

    expect(fixture).toEqual(before);
    expect(plan.local.registeredSubtitles).toHaveLength(2);
    expect(plan.local.subtitleBodies).toEqual(
      Object.fromEntries(Object.entries(before.local.subtitleBodies).slice(0, 2))
    );
    expect(Object.keys(plan.local.subtitleBodies)).not.toContain(orphanId);
    expect(plan.local.migrationState.unavailableRegisteredSubtitles.map(({ reason }) => reason)).toEqual([
      'invalid-metadata',
      'missing-body',
      'invalid-body',
      'orphan-body',
    ]);
    expect(plan.local.migrationState.unavailableRegisteredSubtitles[0]).toMatchObject({
      reason: 'invalid-metadata',
      rawMetadata: before.local.registeredSubtitles[2],
    });
  });

  it('rejects unreleased stable-id cards as public v1.11 input', async () => {
    const fixture = createV1_11Fixture();
    fixture.local.savedSubtitles = [
      {
        id: 'saved-unreleased',
        primary: { text: 'Not public' },
        reviewStatus: 'new',
        url: 'https://www.coupangplay.com/play/example',
        startTime: 1,
        savedAt: '2026-07-01T00:00:00.000Z',
      },
    ] as unknown as typeof fixture.local.savedSubtitles;

    await expect(createV1_11MigrationPlan(fixture)).rejects.toThrow();
  });

  it('hydrates missing v1.11 settings from release defaults but rejects invalid persisted fields', async () => {
    const plan = await createV1_11MigrationPlan({ sync: {}, local: {} });

    expect(plan.sync.shortcuts.previousCue).toEqual({ key: 'ArrowLeft', enabled: true });
    expect(plan.sync.shortcuts.navigation.primary).toEqual({ amount: 1, unit: 'subtitles', fallbackEnabled: true, fallbackAmount: 5, fallbackUnit: 'seconds' });
    const fresh = createFreshV2MigrationPlan().sync;
    expect(fresh.shortcuts.previousCue.enabled).toBe(false);
    expect(fresh.shortcuts.navigation.primary.fallbackEnabled).toBe(false);
    expect(fresh.shortcuts.navigation.secondary).toMatchObject({ amount: 10, unit: 'seconds' });
    await expect(
      createV1_11MigrationPlan({ sync: { primarySubtitle: { fontSize: 99 } }, local: {} })
    ).rejects.toThrow();
  });
});

describe('v2 migration coordinator', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('preserves the source, validates readback, marks v2, then performs cleanup', async () => {
    const harness = createCoordinatorHarness();

    await expect(ensureV2Ready(harness.dependencies)).resolves.toEqual({ kind: 'migrated', version: 2 });

    expect(harness.events).toEqual([
      'read-version',
      'read-source',
      'preserve-source',
      'write-local',
      'write-sync',
      'read-local',
      'read-sync',
      'write-marker',
      'cleanup-source',
      'write-completion',
    ]);
    expect(harness.version()).toBe(2);
    expect(harness.local()?.migrationState.status).toBe('complete');
  });

  it.each(['preserveSource', 'writeLocal', 'writeSync', 'readLocal', 'readSync', 'writeMarker'] as const)(
    'never cleans source data when %s fails before the marker',
    async (dependency) => {
      const harness = createCoordinatorHarness();
      vi.mocked(harness.dependencies[dependency]).mockRejectedValueOnce(new Error(`${dependency} failed`));

      await expect(ensureV2Ready(harness.dependencies)).rejects.toThrow(`${dependency} failed`);

      expect(harness.dependencies.cleanupSource).not.toHaveBeenCalled();
      expect(harness.version()).toBeUndefined();
    }
  );

  it('rejects a valid but changed readback before writing the marker', async () => {
    const harness = createCoordinatorHarness();
    vi.mocked(harness.dependencies.readSync).mockImplementation(async () => ({
      ...harness.sync(),
      learningProfile: { learningLanguage: 'ko', supportLanguage: 'en' },
    }));

    await expect(ensureV2Ready(harness.dependencies)).rejects.toThrow('readback did not match');

    expect(harness.dependencies.writeMarker).not.toHaveBeenCalled();
    expect(harness.dependencies.cleanupSource).not.toHaveBeenCalled();
  });

  it('resumes idempotent cleanup without rerunning conversion after a post-marker failure', async () => {
    const harness = createCoordinatorHarness();
    vi.mocked(harness.dependencies.cleanupSource)
      .mockRejectedValueOnce(new Error('cleanup interrupted'))
      .mockImplementation(async () => {
        harness.events.push('cleanup-source');
      });

    await expect(ensureV2Ready(harness.dependencies)).rejects.toThrow('cleanup interrupted');
    await expect(ensureV2Ready(harness.dependencies)).resolves.toEqual({ kind: 'ready', version: 2 });

    expect(harness.dependencies.readSource).toHaveBeenCalledOnce();
    expect(harness.dependencies.preserveSource).toHaveBeenCalledOnce();
    expect(harness.dependencies.writeMarker).toHaveBeenCalledOnce();
    expect(harness.dependencies.cleanupSource).toHaveBeenCalledTimes(2);
    expect(harness.local()?.migrationState.status).toBe('complete');
  });

  it('retries cleanup after the final completion-state write fails', async () => {
    const harness = createCoordinatorHarness();
    vi.mocked(harness.dependencies.writeCompletionState).mockRejectedValueOnce(
      new Error('completion state interrupted')
    );

    await expect(ensureV2Ready(harness.dependencies)).rejects.toThrow(
      'completion state interrupted'
    );
    expect(harness.version()).toBe(2);
    expect(harness.local()?.migrationState.status).toBe('cleanup-pending');
    expect(harness.dependencies.cleanupSource).toHaveBeenCalledOnce();

    await expect(ensureV2Ready(harness.dependencies)).resolves.toEqual({ kind: 'ready', version: 2 });

    expect(harness.dependencies.readSource).toHaveBeenCalledOnce();
    expect(harness.dependencies.preserveSource).toHaveBeenCalledOnce();
    expect(harness.dependencies.writeMarker).toHaveBeenCalledOnce();
    expect(harness.dependencies.cleanupSource).toHaveBeenCalledTimes(2);
    expect(harness.dependencies.writeCompletionState).toHaveBeenCalledTimes(2);
    expect(harness.local()?.migrationState.status).toBe('complete');
  });

  it('does not repeat cleanup after migration state is complete', async () => {
    const harness = createCoordinatorHarness();
    await ensureV2Ready(harness.dependencies);
    vi.mocked(harness.dependencies.cleanupSource).mockClear();
    vi.mocked(harness.dependencies.writeCompletionState).mockClear();

    await expect(ensureV2Ready(harness.dependencies)).resolves.toEqual({ kind: 'ready', version: 2 });

    expect(harness.dependencies.cleanupSource).not.toHaveBeenCalled();
    expect(harness.dependencies.writeCompletionState).not.toHaveBeenCalled();
  });

  it('initializes fresh data without invoking the v1 source preservation or cleanup path', async () => {
    const harness = createCoordinatorHarness({ kind: 'fresh' });

    await expect(ensureV2Ready(harness.dependencies)).resolves.toEqual({ kind: 'initialized', version: 2 });

    expect(harness.dependencies.preserveSource).not.toHaveBeenCalled();
    expect(harness.dependencies.cleanupSource).not.toHaveBeenCalled();
    expect(harness.local()?.learningCards).toEqual([]);
    expect(harness.local()?.listeningProgress).toEqual(createDefaultListeningProgress());
    expect(harness.sync()).toEqual(createFreshV2MigrationPlan().sync);
  });

  it('fails readiness closed when marked v2 data is missing required listening progress', async () => {
    const harness = createCoordinatorHarness({ kind: 'fresh' });
    await ensureV2Ready(harness.dependencies);
    const local = harness.local() as Partial<V2LocalData>;
    delete local.listeningProgress;
    vi.mocked(harness.dependencies.readLocal).mockResolvedValue(local);
    vi.mocked(harness.dependencies.writeCompletionState).mockClear();

    await expect(ensureV2Ready(harness.dependencies)).rejects.toThrow();

    expect(harness.dependencies.writeCompletionState).not.toHaveBeenCalled();
  });

  it('does not write or clean when strict source decoding fails', async () => {
    const harness = createCoordinatorHarness({
      kind: 'v1.11',
      value: { sync: {}, local: { savedSubtitles: [{ id: 'not-public' }] } },
    });

    await expect(ensureV2Ready(harness.dependencies)).rejects.toThrow();

    expect(harness.dependencies.preserveSource).not.toHaveBeenCalled();
    expect(harness.dependencies.writeLocal).not.toHaveBeenCalled();
    expect(harness.dependencies.writeSync).not.toHaveBeenCalled();
    expect(harness.dependencies.cleanupSource).not.toHaveBeenCalled();
  });
});

const createCoordinatorHarness = (
  source: { kind: 'fresh' } | { kind: 'v1.11'; value: V1_11MigrationSource } = {
    kind: 'v1.11',
    value: createV1_11Fixture(),
  }
) => {
  const events: string[] = [];
  let version: number | undefined;
  let local: V2LocalData | undefined;
  let sync: V2SyncStorage | undefined;
  const dependencies: V2MigrationCoordinatorDependencies = {
    readVersion: vi.fn(async () => {
      events.push('read-version');
      return version;
    }),
    readSource: vi.fn(async () => {
      events.push('read-source');
      return source;
    }),
    preserveSource: vi.fn(async () => {
      events.push('preserve-source');
    }),
    writeLocal: vi.fn(async (value) => {
      events.push('write-local');
      local = structuredClone(value);
    }),
    writeSync: vi.fn(async (value) => {
      events.push('write-sync');
      sync = structuredClone(value);
    }),
    readLocal: vi.fn(async () => {
      events.push('read-local');
      return structuredClone(local);
    }),
    readSync: vi.fn(async () => {
      events.push('read-sync');
      return structuredClone(sync);
    }),
    writeMarker: vi.fn(async (marker: V2Marker) => {
      events.push('write-marker');
      version = marker.dataSchemaVersion;
      local = { ...local!, migrationState: structuredClone(marker.migrationState) };
    }),
    cleanupSource: vi.fn(async () => {
      events.push('cleanup-source');
    }),
    writeCompletionState: vi.fn(async (state: V2MigrationState) => {
      events.push('write-completion');
      local = { ...local!, migrationState: structuredClone(state) };
    }),
  };
  return {
    dependencies,
    events,
    version: () => version,
    local: () => local,
    sync: () => sync,
  };
};
