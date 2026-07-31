import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BACKUP_VERSION,
  BackupRestoreError,
  createBackupDocument,
  parseBackupDocument,
  parseBackupJson,
  restoreBackup,
  serializeBackup,
} from './backup';
import { DEFAULT_CONFIG } from './default';
import { SubtitleId } from './subtitle';

const FIRST_ID = 'subtitle-11111111-1111-4111-8111-111111111111' as SubtitleId;
const SECOND_ID = 'subtitle-22222222-2222-4222-8222-222222222222' as SubtitleId;
const EXPORTED_AT = '2026-08-01T00:00:00.000Z';

let syncStorage: Record<string, unknown>;
let localStorage: Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  syncStorage = structuredClone(DEFAULT_CONFIG);
  localStorage = {};

  vi.mocked(chrome.storage.sync.get).mockImplementation(((keys: string | string[], callback: (items: object) => void) => {
    callback(selectKeys(syncStorage, keys));
  }) as typeof chrome.storage.sync.get);
  vi.mocked(chrome.storage.sync.set).mockImplementation(async (items) => {
    Object.assign(syncStorage, items);
  });
  vi.mocked(chrome.storage.local.get).mockImplementation(((keys: string | string[], callback: (items: object) => void) => {
    callback(selectKeys(localStorage, keys));
  }) as typeof chrome.storage.local.get);
  vi.mocked(chrome.storage.local.set).mockImplementation(async (items) => {
    Object.assign(localStorage, items);
  });
  vi.mocked(chrome.storage.local.remove).mockImplementation(async (keys) => {
    for (const key of Array.isArray(keys) ? keys : [keys]) delete localStorage[key];
  });
});

describe('backup document', () => {
  it('exports every supported data type and omits unknown keys', async () => {
    syncStorage.unknownSetting = { enabled: true };
    localStorage = {
      savedSubtitles: [savedSubtitle('Hello')],
      registeredSubtitles: [subtitleMetadata(FIRST_ID, 'English')],
      [FIRST_ID]: [subtitleCue('Hello')],
      unknownLocalKey: 'ignored',
    };

    const backup = await createBackupDocument(EXPORTED_AT);

    expect(backup).toEqual({
      version: BACKUP_VERSION,
      exportedAt: EXPORTED_AT,
      data: {
        settings: DEFAULT_CONFIG,
        savedSubtitles: [savedSubtitle('Hello')],
        registeredSubtitles: [subtitleMetadata(FIRST_ID, 'English')],
        subtitleBodies: { [FIRST_ID]: [subtitleCue('Hello')] },
      },
    });
    expect(JSON.parse(serializeBackup(backup))).toEqual(backup);
    expect(parseBackupJson(serializeBackup(backup))).toEqual(backup);
  });

  it('round trips an empty learning dataset', async () => {
    const backup = await createBackupDocument(EXPORTED_AT);

    expect(backup.data.savedSubtitles).toEqual([]);
    expect(backup.data.registeredSubtitles).toEqual([]);
    expect(backup.data.subtitleBodies).toEqual({});
    expect(parseBackupDocument(backup)).toEqual(backup);
  });

  it('accepts a legacy v1 saved line for backward-compatible restore', () => {
    const backup = validBackup({
      savedSubtitles: [{ content: 'Legacy', url: 'https://example.com', startTime: 3, savedAt: EXPORTED_AT }],
    });

    expect(parseBackupDocument(backup).data.savedSubtitles).toEqual(backup.data.savedSubtitles);
  });

  it('rejects malformed JSON and unsupported versions', async () => {
    expect(() => parseBackupJson('{')).toThrow();
    expect(() => parseBackupDocument({ ...validBackup(), version: 2 })).toThrow();
  });

  it.each([
    ['invalid settings', (backup: ReturnType<typeof validBackup>) => ({ ...backup, data: { ...backup.data, settings: {} } })],
    [
      'invalid saved subtitle',
      (backup: ReturnType<typeof validBackup>) => ({
        ...backup,
        data: { ...backup.data, savedSubtitles: [{ content: 'Hello' }] },
      }),
    ],
    [
      'missing subtitle body',
      (backup: ReturnType<typeof validBackup>) => ({
        ...backup,
        data: { ...backup.data, subtitleBodies: {} },
      }),
    ],
    [
      'unexpected subtitle body',
      (backup: ReturnType<typeof validBackup>) => ({
        ...backup,
        data: {
          ...backup.data,
          subtitleBodies: { ...backup.data.subtitleBodies, [SECOND_ID]: [subtitleCue('Unexpected')] },
        },
      }),
    ],
    [
      'invalid subtitle cue',
      (backup: ReturnType<typeof validBackup>) => ({
        ...backup,
        data: {
          ...backup.data,
          subtitleBodies: { [FIRST_ID]: [{ start: 2, end: 1, text: 'Invalid' }] },
        },
      }),
    ],
  ])('rejects %s', (_name, mutate) => {
    expect(() => parseBackupDocument(mutate(validBackup()))).toThrow();
  });

  it('rejects an export when registered subtitle content is missing', async () => {
    localStorage.registeredSubtitles = [subtitleMetadata(FIRST_ID, 'English')];

    await expect(createBackupDocument(EXPORTED_AT)).rejects.toThrow();
  });
});

describe('restoreBackup', () => {
  it('replaces supported data and removes stale subtitle bodies', async () => {
    syncStorage.primarySubtitle = { ...DEFAULT_CONFIG.primarySubtitle, color: '#000000' };
    localStorage = {
      savedSubtitles: [savedSubtitle('Old')],
      registeredSubtitles: [subtitleMetadata(FIRST_ID, 'Old')],
      [FIRST_ID]: [subtitleCue('Old')],
      unknownLocalKey: 'preserved',
    };
    const backup = validBackup({
      savedSubtitles: [savedSubtitle('New')],
      registeredSubtitles: [subtitleMetadata(SECOND_ID, 'New')],
      subtitleBodies: { [SECOND_ID]: [subtitleCue('New')] },
    });

    await restoreBackup(backup);

    expect(syncStorage).toMatchObject(DEFAULT_CONFIG);
    expect(localStorage).toMatchObject({
      savedSubtitles: [savedSubtitle('New')],
      registeredSubtitles: [subtitleMetadata(SECOND_ID, 'New')],
      [SECOND_ID]: [subtitleCue('New')],
      unknownLocalKey: 'preserved',
    });
    expect(localStorage[FIRST_ID]).toBeUndefined();
  });

  it('does not write when validation fails', async () => {
    const invalidBackup = { ...validBackup(), version: 2 };

    await expect(restoreBackup(invalidBackup)).rejects.toThrow();

    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    expect(chrome.storage.local.remove).not.toHaveBeenCalled();
  });

  it('restores the previous snapshot when applying the replacement fails', async () => {
    syncStorage.primarySubtitle = { ...DEFAULT_CONFIG.primarySubtitle, color: '#000000' };
    localStorage = {
      savedSubtitles: [savedSubtitle('Old')],
      registeredSubtitles: [subtitleMetadata(FIRST_ID, 'Old')],
      [FIRST_ID]: [subtitleCue('Old')],
    };
    const previousSyncStorage = structuredClone(syncStorage);
    const previousLocalStorage = structuredClone(localStorage);
    const backup = validBackup({
      savedSubtitles: [savedSubtitle('New')],
      registeredSubtitles: [subtitleMetadata(SECOND_ID, 'New')],
      subtitleBodies: { [SECOND_ID]: [subtitleCue('New')] },
    });
    vi.mocked(chrome.storage.local.remove).mockRejectedValueOnce(new Error('remove failed'));

    await expect(restoreBackup(backup)).rejects.toMatchObject({
      name: 'BackupRestoreError',
      rollbackError: undefined,
    } satisfies Partial<BackupRestoreError>);

    expect(syncStorage).toEqual(previousSyncStorage);
    expect(localStorage).toEqual(previousLocalStorage);
  });

  it('preserves an unknown local value that collides with a target subtitle id during rollback', async () => {
    const collidingUnknownValue = { futureFormat: true };
    localStorage = {
      savedSubtitles: [],
      registeredSubtitles: [subtitleMetadata(FIRST_ID, 'Old')],
      [FIRST_ID]: [subtitleCue('Old')],
      [SECOND_ID]: collidingUnknownValue,
    };
    const previousLocalStorage = structuredClone(localStorage);
    const backup = validBackup({
      registeredSubtitles: [subtitleMetadata(SECOND_ID, 'New')],
      subtitleBodies: { [SECOND_ID]: [subtitleCue('New')] },
    });
    vi.mocked(chrome.storage.local.remove).mockRejectedValueOnce(new Error('remove failed'));

    await expect(restoreBackup(backup)).rejects.toMatchObject({
      name: 'BackupRestoreError',
      rollbackError: undefined,
    } satisfies Partial<BackupRestoreError>);

    expect(localStorage).toEqual(previousLocalStorage);
  });

  it('reports when replacement and rollback both fail', async () => {
    localStorage = {
      registeredSubtitles: [subtitleMetadata(FIRST_ID, 'Old')],
      [FIRST_ID]: [subtitleCue('Old')],
    };
    const backup = validBackup({
      registeredSubtitles: [subtitleMetadata(SECOND_ID, 'New')],
      subtitleBodies: { [SECOND_ID]: [subtitleCue('New')] },
    });
    vi.mocked(chrome.storage.local.remove)
      .mockRejectedValueOnce(new Error('replacement cleanup failed'))
      .mockRejectedValueOnce(new Error('rollback cleanup failed'));

    await expect(restoreBackup(backup)).rejects.toMatchObject({
      name: 'BackupRestoreError',
      rollbackError: expect.any(Error),
    } satisfies Partial<BackupRestoreError>);
  });
});

const selectKeys = (storage: Record<string, unknown>, keys: string | string[]) => {
  return (Array.isArray(keys) ? keys : [keys]).reduce<Record<string, unknown>>((result, key) => {
    if (key in storage) result[key] = storage[key];
    return result;
  }, {});
};

const subtitleCue = (text: string) => ({ start: 1, end: 2, text });

const savedSubtitle = (content: string) => ({
  id: `saved-${content.toLowerCase()}`,
  primary: { text: content, language: 'en' as const },
  secondary: { text: `${content} secondary`, language: 'ko' as const },
  url: 'https://www.coupangplay.com/play/example',
  startTime: 1,
  savedAt: EXPORTED_AT,
});

const subtitleMetadata = (id: SubtitleId, title: string) => ({
  id,
  title,
  language: 'en' as const,
  savedAt: EXPORTED_AT,
  delay: 0,
});

const validBackup = (
  overrides: Partial<{
    savedSubtitles: Array<
      | ReturnType<typeof savedSubtitle>
      | { content: string; url: string; startTime: number; savedAt: string }
    >;
    registeredSubtitles: ReturnType<typeof subtitleMetadata>[];
    subtitleBodies: Record<string, ReturnType<typeof subtitleCue>[]>;
  }> = {}
) => ({
  version: BACKUP_VERSION,
  exportedAt: EXPORTED_AT,
  data: {
    settings: structuredClone(DEFAULT_CONFIG),
    savedSubtitles: [savedSubtitle('Hello')],
    registeredSubtitles: [subtitleMetadata(FIRST_ID, 'English')],
    subtitleBodies: { [FIRST_ID]: [subtitleCue('Hello')] },
    ...overrides,
  },
});
