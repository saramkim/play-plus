import { useEffect, useState } from 'react';

import { getLocalStorage, onLocalStorageChange, setLocalStorage } from '@storage/index';
import { SubtitleMetadata } from '@storage/schema';
import { removeLocalSubtitle, SubtitleId } from '@storage/subtitle';
import { Language, REGISTRATION } from '@utils/constants';
import { t } from '@utils/i18n';

import { modal } from '@/ui/components/modal';

const { STORAGE_KEY } = REGISTRATION;

export function useRegisteredSubtitles() {
  const [subtitles, setSubtitles] = useState<SubtitleMetadata[]>([]);

  useEffect(() => {
    (async () => {
      const data = await getLocalStorage(STORAGE_KEY);
      if (data) setSubtitles(data);
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

  return { subtitles, editSubtitle, deleteSubtitle };
}
