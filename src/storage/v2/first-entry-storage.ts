import { migrationStateSchema, v2SyncStorageSchema } from './schema';
import type { V2MigrationState, V2ShortcutConfirmation, V2SyncStorage } from './type';

export interface V2FirstEntryStorageArea {
  get: (keys?: string | string[] | null) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
}

type ShortcutField = V2ShortcutConfirmation['field'];

export type V2FirstEntryShortcutChoices = Partial<Record<ShortcutField, string | null>>;

export interface V2FirstEntryConfirmation {
  learningProfile: V2SyncStorage['learningProfile'];
  shortcutChoices: V2FirstEntryShortcutChoices;
}

export interface V2FirstEntryStorageApi {
  confirm: (confirmation: V2FirstEntryConfirmation) => Promise<void>;
}

interface V2FirstEntryStorageAreas {
  local: V2FirstEntryStorageArea;
  sync: V2FirstEntryStorageArea;
}

const V2_SYNC_STORAGE_KEYS = [
  'learningProfile',
  'subtitleDisplay',
  'learningControls',
  'shortcuts',
  'playbackSpeed',
] as const satisfies readonly (keyof V2SyncStorage)[];

export const createV2FirstEntryStorage = ({
  local,
  sync,
}: V2FirstEntryStorageAreas): V2FirstEntryStorageApi => ({
  confirm: async (confirmation) => {
    const [currentSync, currentMigrationState] = await Promise.all([
      readSync(sync),
      readMigrationState(local),
    ]);
    const nextSync = createConfirmedSync(currentSync, currentMigrationState, confirmation);

    await sync.set({
      learningProfile: nextSync.learningProfile,
      learningControls: nextSync.learningControls,
      shortcuts: nextSync.shortcuts,
      playbackSpeed: nextSync.playbackSpeed,
    });

    const syncReadback = await readSync(sync);
    assertEquivalent(syncReadback, nextSync, 'sync');

    const nextMigrationState = migrationStateSchema.parse({
      ...currentMigrationState,
      shortcutConfirmations: [],
    });
    await local.set({ migrationState: nextMigrationState });

    const migrationStateReadback = await readMigrationState(local);
    assertEquivalent(migrationStateReadback, nextMigrationState, 'migration state');
  },
});

const readSync = async (storage: V2FirstEntryStorageArea) => {
  const values = await storage.get([...V2_SYNC_STORAGE_KEYS]);
  return v2SyncStorageSchema.parse(
    Object.fromEntries(V2_SYNC_STORAGE_KEYS.map((key) => [key, values[key]]))
  );
};

const readMigrationState = async (storage: V2FirstEntryStorageArea) => {
  const values = await storage.get('migrationState');
  return migrationStateSchema.parse(values.migrationState);
};

const createConfirmedSync = (
  current: V2SyncStorage,
  migrationState: V2MigrationState,
  confirmation: V2FirstEntryConfirmation
) => {
  const choices = validateChoices(migrationState.shortcutConfirmations, confirmation.shortcutChoices);
  const learningControls = structuredClone(current.learningControls);
  const shortcuts = structuredClone(current.shortcuts);
  const playbackSpeed = structuredClone(current.playbackSpeed);

  for (const unresolved of migrationState.shortcutConfirmations) {
    const choice = choices.get(unresolved.field) ?? null;
    const shortcut = choice ?? '';

    switch (unresolved.field) {
      case 'saveCard':
        shortcuts.saveCard = shortcut;
        break;
      case 'previousCue':
        shortcuts.previousCue = shortcut;
        learningControls.previousCue.enabled = choice !== null;
        break;
      case 'nextCue':
        shortcuts.nextCue = shortcut;
        learningControls.nextCue.enabled = choice !== null;
        break;
      case 'repeatCurrentCue':
        shortcuts.repeatCurrentCue = shortcut;
        learningControls.repeatCurrentCue.enabled = choice !== null;
        break;
      case 'speedIncrease':
        playbackSpeed.increase = shortcut;
        break;
      case 'speedDecrease':
        playbackSpeed.decrease = shortcut;
        break;
      case 'speedReset':
        playbackSpeed.reset = shortcut;
        break;
    }
  }

  const next = v2SyncStorageSchema.parse({
    ...current,
    learningProfile: confirmation.learningProfile,
    learningControls,
    shortcuts,
    playbackSpeed,
  });
  assertUniqueShortcuts(next);
  return next;
};

const validateChoices = (
  unresolved: V2ShortcutConfirmation[],
  choices: V2FirstEntryShortcutChoices
) => {
  const confirmationsByField = new Map(unresolved.map((item) => [item.field, item]));
  if (confirmationsByField.size !== unresolved.length) {
    throw new Error('Duplicate shortcut confirmation field');
  }

  const choiceFields = Object.keys(choices);
  if (
    choiceFields.length !== confirmationsByField.size ||
    choiceFields.some((field) => !confirmationsByField.has(field as ShortcutField))
  ) {
    throw new Error('Shortcut choices must match every unresolved field');
  }

  const validated = new Map<ShortcutField, string | null>();
  for (const [field, item] of confirmationsByField) {
    if (!Object.prototype.hasOwnProperty.call(choices, field)) {
      throw new Error('Shortcut choices must match every unresolved field');
    }

    const choice = choices[field];
    if (
      choice !== null &&
      (typeof choice !== 'string' ||
        choice.length === 0 ||
        !item.candidates.some(({ shortcut }) => shortcut === choice))
    ) {
      throw new Error(`Invalid shortcut choice for ${field}`);
    }
    validated.set(field, choice);
  }

  return validated;
};

const assertUniqueShortcuts = ({ playbackSpeed, shortcuts }: V2SyncStorage) => {
  const values = [
    shortcuts.saveCard,
    shortcuts.previousCue,
    shortcuts.nextCue,
    shortcuts.repeatCurrentCue,
    playbackSpeed.increase,
    playbackSpeed.decrease,
    playbackSpeed.reset,
  ].filter((value) => value !== '');

  if (new Set(values).size !== values.length) {
    throw new Error('Canonical shortcuts must be unique');
  }
};

const assertEquivalent = (actual: unknown, expected: unknown, area: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`V2 first-entry ${area} readback did not match`);
  }
};
