import { createBackupDocument, parseBackupJson, serializeBackup } from '@storage/backup';

export const downloadBackupFile = async () => {
  const backup = await createBackupDocument();
  const blob = new Blob([serializeBackup(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `play-plus-backup-${backup.exportedAt.slice(0, 10)}.json`;

  try {
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
};

export const readBackupFile = async (file: File) => parseBackupJson(await file.text());
