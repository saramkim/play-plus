import { createDefaultV2LocalData, DEFAULT_V2_SYNC_STORAGE } from './default';
import {
  dataSchemaVersionSchema,
  registeredSubtitleMetadataSchema,
  subtitleCueSchema,
  v2LocalDataSchema,
  v2MarkerSchema,
  v2SyncStorageSchema,
} from './schema';
import {
  LearningCard,
  V2LocalData,
  V2Marker,
  V2MigrationState,
  V2ShortcutConfirmation,
  V2SyncStorage,
} from './type';
import {
  parseV1_11LocalStorage,
  parseV1_11SyncStorage,
  v1RegisteredSubtitleMetadataSchema,
  V1SavedSubtitle,
} from './v1-11-schema';

export interface V1_11MigrationSource {
  sync: unknown;
  local: unknown;
}

export type V2MigrationSource = { kind: 'fresh' } | { kind: 'v1.11'; value: V1_11MigrationSource };

export interface V2MigrationPlan {
  sync: V2SyncStorage;
  local: V2LocalData;
}

export interface V2MigrationCoordinatorDependencies {
  readVersion: () => Promise<unknown>;
  readSource: () => Promise<V2MigrationSource>;
  // This must resolve only after an internal source snapshot has been reread and validated.
  preserveSource: (source: V1_11MigrationSource) => Promise<void>;
  writeLocal: (data: V2LocalData) => Promise<void>;
  writeSync: (data: V2SyncStorage) => Promise<void>;
  readLocal: () => Promise<unknown>;
  readSync: () => Promise<unknown>;
  writeMarker: (marker: V2Marker) => Promise<void>;
  cleanupSource: () => Promise<void>;
  writeCompletionState: (state: V2MigrationState) => Promise<void>;
}

type ShortcutField = V2ShortcutConfirmation['field'];
type ShortcutCandidate = V2ShortcutConfirmation['candidates'][number];

const SHORTCUT_FIELDS: ShortcutField[] = [
  'saveCard',
  'previousCue',
  'nextCue',
  'repeatCurrentCue',
  'speedIncrease',
  'speedDecrease',
  'speedReset',
];

export const createV1LearningCardId = async (subtitle: V1SavedSubtitle, originalIndex: number) => {
  const source = JSON.stringify([
    subtitle.content,
    subtitle.url,
    subtitle.startTime,
    subtitle.savedAt,
    originalIndex,
  ]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
  const hexadecimal = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `card-v1-${hexadecimal}`;
};

export const createFreshV2MigrationPlan = (): V2MigrationPlan => ({
  sync: v2SyncStorageSchema.parse(DEFAULT_V2_SYNC_STORAGE),
  local: v2LocalDataSchema.parse(createDefaultV2LocalData()),
});

export const createV1_11MigrationPlan = async ({ local: localValue, sync: syncValue }: V1_11MigrationSource) => {
  const sync = parseV1_11SyncStorage(syncValue);
  const local = parseV1_11LocalStorage(localValue);
  const learningCards = await Promise.all(
    local.savedSubtitles.map(async (subtitle, index): Promise<LearningCard> => ({
      id: await createV1LearningCardId(subtitle, index),
      content: { unassigned: { text: subtitle.content, language: 'und' } },
      source: { url: subtitle.url, startTime: subtitle.startTime },
      studyState: 'active',
      createdAt: subtitle.savedAt,
    }))
  );
  const registered = isolateRegisteredSubtitles(local.registeredSubtitles, local.subtitleBodies);
  const mappedSettings = mapV1Settings(sync);

  return {
    sync: v2SyncStorageSchema.parse(mappedSettings.sync),
    local: v2LocalDataSchema.parse({
      learningCards,
      registeredSubtitles: registered.metadata,
      subtitleBodies: registered.bodies,
      migrationState: {
        status: 'prepared',
        sourceVersion: '1.11.0',
        shortcutConfirmations: mappedSettings.confirmations,
        unavailableRegisteredSubtitles: registered.unavailable,
      },
    }),
  } satisfies V2MigrationPlan;
};

export const ensureV2Ready = async (dependencies: V2MigrationCoordinatorDependencies) => {
  const storedVersion = await dependencies.readVersion();
  if (storedVersion !== undefined) {
    const version = dataSchemaVersionSchema.parse(storedVersion);
    const current = validateReadback(await dependencies.readLocal(), await dependencies.readSync());
    const { migrationState } = current.local;
    if (migrationState.status === 'cleanup-pending') {
      if (migrationState.sourceVersion === '1.11.0') await dependencies.cleanupSource();
      await dependencies.writeCompletionState({ ...migrationState, status: 'complete' });
    } else if (migrationState.status !== 'complete') {
      throw new Error(`V2 marker has inconsistent migration state: ${migrationState.status}`);
    }
    return { kind: 'ready' as const, version };
  }

  const source = await dependencies.readSource();
  const plan = source.kind === 'fresh' ? createFreshV2MigrationPlan() : await createV1_11MigrationPlan(source.value);
  if (source.kind === 'v1.11') await dependencies.preserveSource(source.value);

  const writingLocal = {
    ...plan.local,
    migrationState: { ...plan.local.migrationState, status: 'writing' as const },
  };
  await dependencies.writeLocal(writingLocal);
  await dependencies.writeSync(plan.sync);

  const readback = validateReadback(await dependencies.readLocal(), await dependencies.readSync());
  assertEquivalent(readback.local, writingLocal, 'local');
  assertEquivalent(readback.sync, plan.sync, 'sync');

  const marker = v2MarkerSchema.parse({
    dataSchemaVersion: 2,
    migrationState: { ...writingLocal.migrationState, status: 'cleanup-pending' },
  });
  await dependencies.writeMarker(marker);

  if (source.kind === 'v1.11') await dependencies.cleanupSource();
  await dependencies.writeCompletionState({ ...marker.migrationState, status: 'complete' });
  return { kind: source.kind === 'fresh' ? ('initialized' as const) : ('migrated' as const), version: 2 as const };
};

const mapV1Settings = (legacy: ReturnType<typeof parseV1_11SyncStorage>) => {
  const assignments: Record<ShortcutField, string> = {
    saveCard: '',
    previousCue: '',
    nextCue: '',
    repeatCurrentCue: '',
    speedIncrease: legacy.playbackSpeed.increase,
    speedDecrease: legacy.playbackSpeed.decrease,
    speedReset: legacy.playbackSpeed.reset,
  };
  const candidates = new Map<ShortcutField, ShortcutCandidate[]>();
  const confirmations = new Map<ShortcutField, V2ShortcutConfirmation>();
  const setCandidate = (field: ShortcutField, candidate: ShortcutCandidate) => {
    candidates.set(field, [candidate]);
    assignments[field] = candidate.shortcut;
  };
  const requireConfirmation = (
    field: ShortcutField,
    fieldCandidates: ShortcutCandidate[],
    reason: V2ShortcutConfirmation['reason'],
    conflictingFields?: ShortcutField[]
  ) => {
    candidates.set(field, fieldCandidates);
    assignments[field] = '';
    confirmations.set(field, {
      field,
      candidates: fieldCandidates,
      reason,
      ...(conflictingFields?.length ? { conflictingFields } : {}),
    });
  };

  const saveCandidates = [
    { source: 'savePrimary' as const, shortcut: legacy.shortcuts.savePrimary },
    { source: 'saveSecondary' as const, shortcut: legacy.shortcuts.saveSecondary },
  ].filter(({ shortcut }) => shortcut !== '');
  if (saveCandidates.length === 1) setCandidate('saveCard', saveCandidates[0]);
  if (saveCandidates.length > 1) requireConfirmation('saveCard', saveCandidates, 'multiple-candidates');

  const cueSemanticsAreExact = legacy.videoSkip.skipTimeUnit === 'subtitles' && legacy.videoSkip.skipTime === 1;
  if (legacy.videoSkip.skipTimeUnit === 'subtitles') {
    const previous = { source: 'videoSkip.backward' as const, shortcut: legacy.videoSkip.backward };
    const next = { source: 'videoSkip.forward' as const, shortcut: legacy.videoSkip.forward };
    if (previous.shortcut) {
      if (cueSemanticsAreExact) setCandidate('previousCue', previous);
      else requireConfirmation('previousCue', [previous], 'ambiguous-semantics');
    }
    if (next.shortcut) {
      if (cueSemanticsAreExact) setCandidate('nextCue', next);
      else requireConfirmation('nextCue', [next], 'ambiguous-semantics');
    }
  }

  if (legacy.loop.loopCurrentSubtitle) {
    setCandidate('repeatCurrentCue', {
      source: 'loop.loopCurrentSubtitle',
      shortcut: legacy.loop.loopCurrentSubtitle,
    });
  }
  if (legacy.playbackSpeed.increase) {
    candidates.set('speedIncrease', [
      { source: 'playbackSpeed.increase', shortcut: legacy.playbackSpeed.increase },
    ]);
  }
  if (legacy.playbackSpeed.decrease) {
    candidates.set('speedDecrease', [
      { source: 'playbackSpeed.decrease', shortcut: legacy.playbackSpeed.decrease },
    ]);
  }
  if (legacy.playbackSpeed.reset) {
    candidates.set('speedReset', [{ source: 'playbackSpeed.reset', shortcut: legacy.playbackSpeed.reset }]);
  }

  const groups = new Map<string, Set<ShortcutField>>();
  for (const field of SHORTCUT_FIELDS) {
    for (const { shortcut } of candidates.get(field) ?? []) {
      if (!shortcut) continue;
      const fields = groups.get(shortcut) ?? new Set<ShortcutField>();
      fields.add(field);
      groups.set(shortcut, fields);
    }
  }
  const conflicts = new Map<ShortcutField, Set<ShortcutField>>();
  for (const fields of groups.values()) {
    if (fields.size < 2) continue;
    for (const field of fields) {
      const conflictingFields = conflicts.get(field) ?? new Set<ShortcutField>();
      for (const candidate of fields) {
        if (candidate !== field) conflictingFields.add(candidate);
      }
      conflicts.set(field, conflictingFields);
    }
  }
  for (const field of SHORTCUT_FIELDS) {
    const conflictingFields = conflicts.get(field);
    if (!conflictingFields) continue;
    requireConfirmation(
      field,
      candidates.get(field) ?? [],
      'conflict',
      SHORTCUT_FIELDS.filter((candidate) => conflictingFields.has(candidate))
    );
  }

  const retainsCueCandidate =
    (candidates.get('previousCue')?.length ?? 0) > 0 || (candidates.get('nextCue')?.length ?? 0) > 0;
  const retainsRepeatCandidate = (candidates.get('repeatCurrentCue')?.length ?? 0) > 0;
  return {
    sync: {
      learningProfile: {
        learningLanguage: legacy.primarySubtitle.language,
        supportLanguage: legacy.secondarySubtitle.language,
      },
      subtitleDisplay: {
        learning: {
          visibility: legacy.primarySubtitle.enabled ? 'visible' : 'hidden',
          appearance: pickAppearance(legacy.primarySubtitle),
        },
        support: {
          visibility: legacy.secondarySubtitle.enabled ? 'visible' : 'hidden',
          appearance: pickAppearance(legacy.secondarySubtitle),
        },
      },
      shortcuts: {
        enabled:
          legacy.shortcuts.enabled ||
          (legacy.videoSkip.enabled &&
            legacy.videoSkip.skipTimeUnit === 'subtitles' &&
            retainsCueCandidate) ||
          (legacy.loop.enabled && retainsRepeatCandidate),
        saveCard: assignments.saveCard,
        previousCue: assignments.previousCue,
        nextCue: assignments.nextCue,
        repeatCurrentCue: assignments.repeatCurrentCue,
      },
      playbackSpeed: {
        enabled: legacy.playbackSpeed.enabled,
        increase: assignments.speedIncrease,
        decrease: assignments.speedDecrease,
        reset: assignments.speedReset,
      },
    },
    confirmations: SHORTCUT_FIELDS.flatMap((field) => {
      const confirmation = confirmations.get(field);
      return confirmation ? [confirmation] : [];
    }),
  };
};

const pickAppearance = ({
  backgroundOpacity,
  color,
  fontSize,
  fontWeight,
  lineBreak,
  positionOffset,
  positionReference,
}: ReturnType<typeof parseV1_11SyncStorage>['primarySubtitle']) => ({
  positionReference,
  positionOffset,
  color,
  fontSize,
  fontWeight,
  backgroundOpacity,
  lineBreak,
});

const isolateRegisteredSubtitles = (metadataValues: unknown[], bodyValues: Record<string, unknown>) => {
  const metadata: V2LocalData['registeredSubtitles'] = [];
  const bodies: V2LocalData['subtitleBodies'] = {};
  const unavailable: V2LocalData['migrationState']['unavailableRegisteredSubtitles'] = [];
  const referencedBodyKeys = new Set<string>();

  metadataValues.forEach((rawMetadata, originalIndex) => {
    const sourceResult = v1RegisteredSubtitleMetadataSchema.safeParse(rawMetadata);
    const sourceId = getRawMetadataId(rawMetadata);
    if (sourceId) referencedBodyKeys.add(sourceId);
    if (!sourceResult.success) {
      unavailable.push({ reason: 'invalid-metadata', originalIndex, rawMetadata });
      return;
    }

    const metadataResult = registeredSubtitleMetadataSchema.safeParse(sourceResult.data);
    if (!metadataResult.success) {
      unavailable.push({ reason: 'invalid-metadata', originalIndex, rawMetadata });
      return;
    }

    const id = metadataResult.data.id;
    const rawBody = bodyValues[id];
    if (rawBody === undefined) {
      unavailable.push({ reason: 'missing-body', originalIndex, id, bodyKey: id, rawMetadata });
      return;
    }
    const bodyResult = subtitleCueSchema.array().safeParse(rawBody);
    if (!bodyResult.success) {
      unavailable.push({ reason: 'invalid-body', originalIndex, id, bodyKey: id, rawMetadata });
      return;
    }

    metadata.push(metadataResult.data);
    bodies[id] = bodyResult.data;
  });

  for (const bodyKey of Object.keys(bodyValues)) {
    if (bodyKey.startsWith('subtitle-') && !referencedBodyKeys.has(bodyKey)) {
      unavailable.push({ reason: 'orphan-body', bodyKey });
    }
  }

  return { metadata, bodies, unavailable };
};

const getRawMetadataId = (value: unknown) => {
  if (typeof value !== 'object' || value === null || !('id' in value)) return undefined;
  return typeof value.id === 'string' ? value.id : undefined;
};

const validateReadback = (localValue: unknown, syncValue: unknown) => ({
  local: v2LocalDataSchema.parse(localValue),
  sync: v2SyncStorageSchema.parse(syncValue),
});

const assertEquivalent = (actual: unknown, expected: unknown, area: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`V2 ${area} readback did not match the written migration data`);
  }
};
