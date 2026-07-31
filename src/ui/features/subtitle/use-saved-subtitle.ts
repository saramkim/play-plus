import { useCallback, useEffect, useState } from 'react';

import { onLocalStorageChange } from '@storage/index';
import {
  addSavedSubtitleCard,
  getSavedSubtitleCards,
  removeSavedSubtitleById,
  restoreSavedSubtitleAt,
  SavedSubtitleDraft,
  setSavedSubtitleCards,
} from '@storage/saved-subtitle';
import { SavedSubtitle } from '@storage/type';
import { REVIEW } from '@utils/constants';
import { t } from '@utils/i18n';
import { toast } from 'sonner';

const { STORAGE_KEY } = REVIEW;

export function useSavedSubtitle() {
  const [subtitles, setSubtitles] = useState<SavedSubtitle[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const cards = await getSavedSubtitleCards();
    setSubtitles(cards);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();

    const { remove } = onLocalStorageChange((changes) => {
      if (changes[STORAGE_KEY]) void refresh();
    });
    return remove;
  }, [refresh]);

  const saveSubtitle = async (draft: SavedSubtitleDraft) => {
    const card = await addSavedSubtitleCard(draft);
    if (!card) return undefined;

    toast.success(t('success_save_subtitle'));
    return card;
  };

  const deleteSubtitle = async (id: string) => {
    const { cards, removed, index } = removeSavedSubtitleById(subtitles, id);
    if (!removed) return;

    await setSavedSubtitleCards(cards);

    toast(t('delete'), {
      description: removed.primary.text,
      action: {
        label: t('undo'),
        onClick: () => {
          toast.dismiss();
          void getSavedSubtitleCards().then((current) =>
            setSavedSubtitleCards(restoreSavedSubtitleAt(current, removed, index))
          );
        },
      },
    });
  };

  return { subtitles, saveSubtitle, deleteSubtitle, loading };
}
