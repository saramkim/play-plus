import { useEffect, useState } from 'react';

import { getLocalStorage, onLocalStorageChange, setLocalStorage } from '@storage/index';
import { removeLocalSubtitle, SubtitleId } from '@storage/subtitle';
import { SubtitleMetadata } from '@storage/type';
import { Language, REGISTRATION } from '@utils/constants';
import { t } from '@utils/i18n';

import { MessagePopup } from '@/ui/components/message-popup';
import { usePopup } from '@/ui/contexts/popup-context';

const { STORAGE_KEY } = REGISTRATION;

export function useRegisteredSubtitles() {
  const [subtitles, setSubtitles] = useState<SubtitleMetadata[]>([]);
  const { showPopup, hidePopup } = usePopup();

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
    showPopup({
      title: t('delete'),
      content: (
        <MessagePopup
          type='confirm'
          message={t('confirm_delete')}
          onConfirm={() => {
            const filtered = subtitles.filter((v) => v.id !== id);
            setLocalStorage(STORAGE_KEY, filtered);
            removeLocalSubtitle(id);
          }}
          hidePopup={hidePopup}
        />
      ),
    });
  };

  return { subtitles, editSubtitle, deleteSubtitle };
}
