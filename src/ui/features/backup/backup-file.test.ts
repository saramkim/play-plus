import { BackupDocument, createBackupDocument, parseBackupJson, serializeBackup } from '@storage/backup';
import { DEFAULT_CONFIG } from '@storage/default';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { downloadBackupFile, readBackupFile } from './backup-file';

vi.mock('@storage/backup', () => ({
  createBackupDocument: vi.fn(),
  parseBackupJson: vi.fn(),
  serializeBackup: vi.fn(),
}));

const backup: BackupDocument = {
  version: 1,
  exportedAt: '2026-08-01T00:00:00.000Z',
  data: {
    settings: DEFAULT_CONFIG,
    savedSubtitles: [],
    registeredSubtitles: [],
    subtitleBodies: {},
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:backup') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
});

describe('backup file', () => {
  it('downloads a dated JSON file and releases its object URL', async () => {
    vi.mocked(createBackupDocument).mockResolvedValue(backup);
    vi.mocked(serializeBackup).mockReturnValue('{"version":1}');
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('play-plus-backup-2026-08-01.json');
      expect(this.href).toBe('blob:backup');
    });

    await downloadBackupFile();

    expect(click).toHaveBeenCalledOnce();
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:backup');
  });

  it('reads and validates the selected file', async () => {
    const parsed = { ...backup };
    const file = { text: vi.fn().mockResolvedValue('{"version":1}') } as unknown as File;
    vi.mocked(parseBackupJson).mockReturnValue(parsed);

    await expect(readBackupFile(file)).resolves.toBe(parsed);
    expect(parseBackupJson).toHaveBeenCalledWith('{"version":1}');
  });
});
