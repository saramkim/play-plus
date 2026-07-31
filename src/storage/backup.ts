import { z } from 'zod';

import { LANGUAGES, Language, REGISTRATION } from '@utils/constants';
import { SubtitleData } from '@utils/parse';

import { savedSubtitleSchema, storageSchema, subtitleMetadataSchema } from './schema';
import { SubtitleId } from './subtitle';

import { getLocalStorage, getStorageAll } from './index';

export const BACKUP_VERSION = 1;

const subtitleIdSchema = z.custom<SubtitleId>(
  (value) =>
    typeof value === 'string' &&
    new RegExp(`^${REGISTRATION.ID_PREFIX}-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`, 'i').test(
      value
    )
);

const languageSchema = z.custom<Language>(
  (value) => typeof value === 'string' && Object.prototype.hasOwnProperty.call(LANGUAGES, value)
);

const backupSubtitleMetadataSchema = subtitleMetadataSchema
  .extend({
    id: subtitleIdSchema,
    language: languageSchema,
  })
  .strict();

const subtitleDataSchema = z
  .object({
    start: z.number().finite(),
    end: z.number().finite(),
    text: z.string(),
    settings: z.array(z.string()).optional(),
  })
  .strict()
  .refine(({ start, end }) => start <= end, { message: 'Subtitle start must not exceed its end' });

const backupDataSchema = z
  .object({
    settings: z.object(storageSchema).strict(),
    savedSubtitles: z.array(savedSubtitleSchema.strict()),
    registeredSubtitles: z.array(backupSubtitleMetadataSchema),
    subtitleBodies: z.record(subtitleIdSchema, z.array(subtitleDataSchema)),
  })
  .strict()
  .superRefine(({ registeredSubtitles, subtitleBodies }, context) => {
    const registeredIds = registeredSubtitles.map(({ id }) => id);
    const uniqueRegisteredIds = new Set(registeredIds);
    if (uniqueRegisteredIds.size !== registeredIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Registered subtitle IDs must be unique',
        path: ['registeredSubtitles'],
      });
    }

    const bodyIds = Object.keys(subtitleBodies);
    for (const id of registeredIds) {
      if (!(id in subtitleBodies)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Missing subtitle body for ${id}`,
          path: ['subtitleBodies', id],
        });
      }
    }

    for (const id of bodyIds) {
      if (!uniqueRegisteredIds.has(id as SubtitleId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unexpected subtitle body ${id}`,
          path: ['subtitleBodies', id],
        });
      }
    }
  });

export const backupDocumentSchema = z
  .object({
    version: z.literal(BACKUP_VERSION),
    exportedAt: z.string().datetime(),
    data: backupDataSchema,
  })
  .strict();

export type BackupDocument = z.infer<typeof backupDocumentSchema>;

export class BackupRestoreError extends Error {
  readonly restoreError: unknown;
  readonly rollbackError: unknown;

  constructor(restoreError: unknown, rollbackError?: unknown) {
    super(rollbackError ? 'Backup restore and rollback failed' : 'Backup restore failed');
    this.name = 'BackupRestoreError';
    this.restoreError = restoreError;
    this.rollbackError = rollbackError;
  }
}

export const parseBackupDocument = (value: unknown) => backupDocumentSchema.parse(value);

export const parseBackupJson = (value: string) => parseBackupDocument(JSON.parse(value));

export const serializeBackup = (backup: BackupDocument) => JSON.stringify(parseBackupDocument(backup), null, 2);

export const createBackupDocument = async (exportedAt = new Date().toISOString()): Promise<BackupDocument> => {
  const [settings, savedSubtitles = [], registeredSubtitles = []] = await Promise.all([
    getStorageAll(),
    getLocalStorage('savedSubtitles'),
    getLocalStorage('registeredSubtitles'),
  ]);
  const subtitleBodies = await getSubtitleBodies(registeredSubtitles.map(({ id }) => id));

  return parseBackupDocument({
    version: BACKUP_VERSION,
    exportedAt,
    data: {
      settings,
      savedSubtitles,
      registeredSubtitles,
      subtitleBodies,
    },
  });
};

export const restoreBackup = async (value: unknown) => {
  const backup = parseBackupDocument(value);
  const previousBackup = await createBackupDocument();
  const previousIds = previousBackup.data.registeredSubtitles.map(({ id }) => id);
  const nextIds = backup.data.registeredSubtitles.map(({ id }) => id);
  const previousIdSet = new Set(previousIds);
  const nextOnlyIds = nextIds.filter((id) => !previousIdSet.has(id));
  const previousNextOnlyValues = await getLocalValues(nextOnlyIds);
  const createdNextIds = nextOnlyIds.filter((id) => !(id in previousNextOnlyValues));

  try {
    await applyBackup(backup, previousIds);
  } catch (restoreError) {
    try {
      await applyBackup(previousBackup, createdNextIds);
      if (Object.keys(previousNextOnlyValues).length > 0) {
        await chrome.storage.local.set(previousNextOnlyValues);
      }
    } catch (rollbackError) {
      throw new BackupRestoreError(restoreError, rollbackError);
    }
    throw new BackupRestoreError(restoreError);
  }
};

const getSubtitleBodies = (ids: SubtitleId[]): Promise<Partial<Record<SubtitleId, SubtitleData[]>>> => {
  if (ids.length === 0) return Promise.resolve({});

  return new Promise((resolve) => {
    chrome.storage.local.get(ids, (result) => {
      const subtitleBodies = ids.reduce<Partial<Record<SubtitleId, SubtitleData[]>>>((bodies, id) => {
        if (result[id] !== undefined) bodies[id] = result[id];
        return bodies;
      }, {});
      resolve(subtitleBodies);
    });
  });
};

const getLocalValues = (ids: SubtitleId[]): Promise<Partial<Record<SubtitleId, unknown>>> => {
  if (ids.length === 0) return Promise.resolve({});

  return new Promise((resolve) => {
    chrome.storage.local.get(ids, (result) => {
      resolve(result as Partial<Record<SubtitleId, unknown>>);
    });
  });
};

const applyBackup = async (backup: BackupDocument, currentSubtitleIds: SubtitleId[]) => {
  const { settings, savedSubtitles, registeredSubtitles, subtitleBodies } = backup.data;
  const nextSubtitleIds = new Set(registeredSubtitles.map(({ id }) => id));
  const staleSubtitleIds = currentSubtitleIds.filter((id) => !nextSubtitleIds.has(id));

  await chrome.storage.sync.set(settings);
  await chrome.storage.local.set({
    savedSubtitles,
    registeredSubtitles,
    ...subtitleBodies,
  });
  if (staleSubtitleIds.length > 0) await chrome.storage.local.remove(staleSubtitleIds);
};
