
import { useEffect, useState } from 'react';

import { onLocalStorageChange } from '@storage/index';
import { deleteRegisteredSubtitle, getRegisteredSubtitles, SubtitleDeleteRecoveryError, updateRegisteredSubtitle } from '@storage/registered-subtitle';
import { SubtitleId } from '@storage/subtitle';
import { SubtitleMetadata } from '@storage/type';
import { Language, REGISTRATION } from '@utils/constants';
import { t } from '@utils/i18n';
import { sendMessageToTab } from '@utils/message';

import { modal } from '@/ui/components/modal';

const { STORAGE_KEY } = REGISTRATION;

export function useUploadedSubtitles(activeTab?: chrome.tabs.Tab | null) {
  const [subtitles, setSubtitles] = useState<SubtitleMetadata[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setSubtitles(await getRegisteredSubtitles());
      } catch {
        modal.alert({ title: t('error'), message: t('error_try_later') });
      } finally {
        setLoading(false);
      }
    })();

    const { remove } = onLocalStorageChange((changes) => {
      const change = changes[STORAGE_KEY];
      if (change?.newValue) setSubtitles(change.newValue);
    });
    return remove;
  }, []);

  const editSubtitle = (id: SubtitleId, title: string, language: Language) =>
    updateRegisteredSubtitle(id, { title, language });

  const updateDelay = async (id: SubtitleId, delay: number) => {
    await updateRegisteredSubtitle(id, { delay });
    if (activeTab?.id) {
      sendMessageToTab(activeTab.id, 'updateSubtitleDelay', { subtitleId: id, delay });
    }
  };

  const deleteSubtitle = (id: SubtitleId) => {
    modal.confirm({
      title: t('delete'),
      message: t('confirm_delete'),
      onConfirm: () => deleteRegisteredSubtitle(id),
      errorMessage: (error) => t(error instanceof SubtitleDeleteRecoveryError ? 'error_subtitle_recovery' : 'error_try_later'),
    });
  };

  return { subtitles, editSubtitle, updateDelay, deleteSubtitle, loading };
}
