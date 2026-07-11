
import { useEffect, useState } from 'react';

import { getLocalStorage, onLocalStorageChange, setLocalStorage } from '@storage/index';
import { SavedSubtitle } from '@storage/type';
import { REVIEW } from '@utils/constants';
import { t } from '@utils/i18n';
import { toast } from 'sonner';

const { STORAGE_KEY } = REVIEW;

export function useSavedSubtitle() {
  const [subtitles, setSubtitles] = useState<SavedSubtitle[]>([]);
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

  const saveSubtitle = async (content: string, url: string, startTime: number) => {
    const data = {
      content,
      url,
      startTime,
      savedAt: new Date().toISOString(),
    };
    const newSubtitles = [...subtitles, data];
    await setLocalStorage(STORAGE_KEY, newSubtitles);
    toast.success(t('success_save_subtitle'));
  };

  const deleteSubtitle = async (content: string) => {
    const filtered = subtitles.filter((v) => v.content !== content);
    await setLocalStorage(STORAGE_KEY, filtered);

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

  return { subtitles, saveSubtitle, deleteSubtitle, loading };
}
