import { useRef } from 'react';

import { BackupRestoreError, restoreBackup } from '@storage/backup';
import { clearStorage, setStorageAll } from '@storage/index';
import { LEARNING_CONFIG } from '@storage/preset';
import { MORE_MENU_OPTIONS } from '@utils/constants';
import { t } from '@utils/i18n';
import { EllipsisIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/components/dropdown-menu';
import { modal } from '@/ui/components/modal';
import { downloadBackupFile, readBackupFile } from '@/ui/features/backup/backup-file';

const { EXPORT_BACKUP, RESET_SETTINGS, RESTORE_BACKUP, SET_LEARNING_CONFIG } = MORE_MENU_OPTIONS;

export function MoreMenu() {
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const options = [
    { label: t('export_backup'), value: EXPORT_BACKUP },
    { label: t('restore_backup'), value: RESTORE_BACKUP },
    { label: t('reset_settings'), value: RESET_SETTINGS },
    { label: t('optimize_for_learning'), value: SET_LEARNING_CONFIG },
  ];

  const exportBackup = () => {
    modal.confirm({
      title: t('export_backup'),
      message: t('export_backup_confirm'),
      onConfirm: () => {
        void downloadBackupFile()
          .then(() => toast.success(t('success_export_backup')))
          .catch(() => toast.error(t('error_export_backup')));
      },
    });
  };

  const selectBackupFile = () => {
    restoreInputRef.current?.click();
  };

  const handleRestoreFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const backup = await readBackupFile(file);
      modal.confirm({
        title: t('restore_backup'),
        message: t('restore_backup_confirm'),
        onConfirm: () => {
          void restoreBackup(backup)
            .then(() => toast.success(t('success_restore_backup')))
            .catch((error: unknown) => {
              const message =
                error instanceof BackupRestoreError && error.rollbackError
                  ? t('error_restore_backup_rollback')
                  : t('error_restore_backup');
              toast.error(message);
            });
        },
      });
    } catch {
      modal.alert({ title: t('restore_backup'), message: t('error_invalid_backup') });
    }
  };

  const resetSettings = () => {
    modal.confirm({
      title: t('reset_settings'),
      message: t('reset_settings_confirm'),
      onConfirm: clearStorage,
    });
  };

  const optimizeForLearning = () => {
    modal.confirm({
      title: t('optimize_for_learning'),
      message: t('optimize_for_learning_confirm'),
      onConfirm: () => setStorageAll(LEARNING_CONFIG),
    });
  };

  const menuMap = {
    [EXPORT_BACKUP]: exportBackup,
    [RESTORE_BACKUP]: selectBackupFile,
    [RESET_SETTINGS]: resetSettings,
    [SET_LEARNING_CONFIG]: optimizeForLearning,
  };

  return (
    <>
      <input
        ref={restoreInputRef}
        type='file'
        accept='.json,application/json'
        aria-label={t('restore_backup')}
        className='hidden'
        onChange={handleRestoreFile}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' size='icon'>
            <EllipsisIcon className='size-6' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {options.map((option) => (
            <DropdownMenuItem key={option.value} onClick={menuMap[option.value]}>
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
