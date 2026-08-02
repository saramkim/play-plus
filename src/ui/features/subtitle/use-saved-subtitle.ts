import { useCallback, useEffect, useState } from 'react';

import { onLocalStorageChange } from '@storage/index';
import {
  addSavedSubtitleCard,
  deleteSavedSubtitleCard,
  getSavedSubtitleCards,
  restoreSavedSubtitleCard,
  SavedSubtitleDraft,
  updateSavedSubtitleReviewStatus,
} from '@storage/saved-subtitle';
import { SavedSubtitle, SavedSubtitleReviewStatus } from '@storage/type';
import { REVIEW } from '@utils/constants';
import { t } from '@utils/i18n';
import { toast } from 'sonner';

const { STORAGE_KEY } = REVIEW;

export function useSavedSubtitle() {
  const [subtitles, setSubtitles] = useState<SavedSubtitle[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const cards = await getSavedSubtitleCards();
    setSubtitles(cards);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } finally {
        setLoading(false);
      }
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
    const deletion = await deleteSavedSubtitleCard(id);
    if (!deletion) return;
    const { card: removed } = deletion;

    toast(t('delete'), {
      description: removed.primary.text,
      action: {
        label: t('undo'),
        onClick: () => {
          toast.dismiss();
          void restoreSavedSubtitleCard(deletion);
        },
      },
    });
  };

  const updateReviewStatus = async (id: string, reviewStatus: SavedSubtitleReviewStatus) => {
    const updated = await updateSavedSubtitleReviewStatus(id, reviewStatus);
    if (updated) {
      setSubtitles((current) => current.map((card) => (card.id === id ? updated : card)));
    }
    return updated;
  };

  return { subtitles, saveSubtitle, deleteSubtitle, updateReviewStatus, loading };
}
