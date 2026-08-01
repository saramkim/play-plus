
import { useEffect, useState } from 'react';

import {
  deleteRegisteredSubtitle,
  getRegisteredSubtitles,
  onRegisteredSubtitlesChange,
  updateRegisteredSubtitle,
} from '@storage/registered-subtitle';
import { SubtitleId } from '@storage/subtitle';
import { SubtitleMetadata } from '@storage/type';
import { Language } from '@utils/constants';
import { t } from '@utils/i18n';
import { sendMessageToTab } from '@utils/message';

import { modal } from '@/ui/components/modal';

export function useUploadedSubtitles(activeTab?: chrome.tabs.Tab | null) {
  const [subtitles, setSubtitles] = useState<SubtitleMetadata[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let changedWhileLoading = false;
    const { remove } = onRegisteredSubtitlesChange((registeredSubtitles) => {
      changedWhileLoading = true;
      if (!cancelled) setSubtitles(registeredSubtitles);
    });

    const loadSubtitles = async () => {
      setLoading(true);
      try {
        const registeredSubtitles = await getRegisteredSubtitles();
        if (!cancelled && !changedWhileLoading) setSubtitles(registeredSubtitles);
      } catch (error) {
        console.error('Failed to load registered subtitles:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadSubtitles();

    return () => {
      cancelled = true;
      remove();
    };
  }, []);

  const editSubtitle = async (id: SubtitleId, title: string, language: Language) => {
    await updateRegisteredSubtitle(id, { title, language });
  };

  const updateDelay = async (id: SubtitleId, delay: number) => {
    const tabId = activeTab?.id;
    const updated = await updateRegisteredSubtitle(id, { delay });
    if (!updated || tabId === undefined) return;

    try {
      await sendMessageToTab(tabId, 'updateSubtitleDelay', { subtitleId: id, delay });
    } catch (error) {
      console.error('Failed to notify subtitle delay update:', error);
    }
  };

  const deleteSubtitle = (id: SubtitleId) => {
    modal.confirm({
      title: t('delete'),
      message: t('confirm_delete'),
      onConfirm: async () => {
        try {
          await deleteRegisteredSubtitle(id);
        } catch (error) {
          console.error('Failed to delete registered subtitle:', error);
        }
      },
    });
  };

  return { subtitles, editSubtitle, updateDelay, deleteSubtitle, loading };
}
