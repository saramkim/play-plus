import { useEffect, useState } from 'react';

import { getLocalStorage, onLocalStorageChange, setLocalStorage } from '@storage/index';
import { SavedSubtitle } from '@storage/schema';
import { REVIEW } from '@utils/constants';
import { t } from '@utils/i18n';
import { toast } from 'sonner';

const { STORAGE_KEY } = REVIEW;

export function useSavedSubtitle() {
  const [subtitles, setSubtitles] = useState<SavedSubtitle[]>([]);

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

  const deleteSubtitle = (content: string) => {
    const filtered = subtitles.filter((v) => v.content !== content);
    setLocalStorage(STORAGE_KEY, filtered);

    toast(t('delete'), {
      description: content,
      action: {
        label: t('undo'),
        onClick: () => {
          toast.dismiss();
          const deletedItem = subtitles.find((v) => v.content === content);
          if (deletedItem) {
            setLocalStorage(STORAGE_KEY, [...filtered, deletedItem]);
          }
        },
      },
    });
  };

  return { subtitles, deleteSubtitle };
}
