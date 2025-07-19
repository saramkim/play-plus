import { useEffect, useState } from 'react';

import { getLocalStorage, onLocalStorageChange, setLocalStorage } from '@storage/index';
import { removeLocalSubtitle, SubtitleId } from '@storage/subtitle';
import { SubtitleMetadata } from '@storage/type';
import { Language, REGISTRATION } from '@utils/constants';
import { t } from '@utils/i18n';
import { sendMessage } from '@utils/message';

import { modal } from '@/ui/components/modal';

const { STORAGE_KEY } = REGISTRATION;

export function useImportedSubtitles(activeTab?: chrome.tabs.Tab | null) {
  const [subtitles, setSubtitles] = useState<SubtitleMetadata[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await getLocalStorage(STORAGE_KEY);
      if (data) setSubtitles(data);
      setLoading(false);
    })();

    const { remove } = onLocalStorageChange((changes) => {
      const change = changes[STORAGE_KEY];
      if (change?.newValue) setSubtitles(change.newValue);
    });
    return remove;
  }, []);

  const editSubtitle = (id: string, title: string, language: Language) => {
    const newSubtitles = subtitles.map((v) => (v.id === id ? { ...v, title, language } : v));
    setLocalStorage(STORAGE_KEY, newSubtitles);
  };

  const updateDelay = (id: SubtitleId, delay: number) => {
    const newSubtitles = subtitles.map((v) => (v.id === id ? { ...v, delay } : v));
    setLocalStorage(STORAGE_KEY, newSubtitles);
    if (activeTab?.id) {
      sendMessage('updateSubtitleDelay', { tabId: activeTab.id, subtitleId: id, delay });
    }
  };

  const deleteSubtitle = (id: SubtitleId) => {
    modal.confirm({
      title: t('delete'),
      message: t('confirm_delete'),
      onConfirm: () => {
        const filtered = subtitles.filter((v) => v.id !== id);
        setLocalStorage(STORAGE_KEY, filtered);
        removeLocalSubtitle(id);
      },
    });
  };

  return { subtitles, editSubtitle, updateDelay, deleteSubtitle, loading };
}
