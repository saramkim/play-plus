import { useCallback, useEffect, useRef, useState } from 'react';

import {
  deleteRegisteredSubtitle,
  getRegisteredSubtitles,
  onRegisteredSubtitlesChange,
  updateRegisteredSubtitle,
} from '@storage/registered-subtitle';
import { SubtitleId } from '@storage/subtitle';
import { migrationStateSchema } from '@storage/v2/schema';
import { V2RegisteredSubtitleMetadata, V2UnavailableRegisteredSubtitle } from '@storage/v2/type';
import { Language } from '@utils/constants';
import { t } from '@utils/i18n';
import { sendMessageToTab } from '@utils/message';

import { modal } from '@/ui/components/modal';

type SubtitleMutationRollback = () => void | Promise<void>;
type BeforeSubtitleDelete = (
  id: SubtitleId
) => void | SubtitleMutationRollback | Promise<void | SubtitleMutationRollback>;
type BeforeSubtitleLanguageChange = (
  id: SubtitleId,
  language: Language
) => void | SubtitleMutationRollback | Promise<void | SubtitleMutationRollback>;

export function useUploadedSubtitles(
  activeTab?: chrome.tabs.Tab | null,
  beforeDelete?: BeforeSubtitleDelete,
  beforeLanguageChange?: BeforeSubtitleLanguageChange
) {
  const [subtitles, setSubtitles] = useState<V2RegisteredSubtitleMetadata[]>([]);
  const [unavailableSubtitles, setUnavailableSubtitles] = useState<
    V2UnavailableRegisteredSubtitle[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const storageRevisionRef = useRef(0);

  const load = useCallback(async () => {
    const revision = storageRevisionRef.current;
    setLoading(true);
    setLoadError(false);
    try {
      const [registeredSubtitles, migrationResult] = await Promise.all([
        getRegisteredSubtitles(),
        chrome.storage.local.get('migrationState'),
      ]);
      const migrationState = migrationStateSchema.parse(migrationResult.migrationState);
      if (storageRevisionRef.current === revision) setSubtitles(registeredSubtitles);
      setUnavailableSubtitles(migrationState.unavailableRegisteredSubtitles);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const { remove } = onRegisteredSubtitlesChange((registeredSubtitles) => {
      storageRevisionRef.current += 1;
      setSubtitles(registeredSubtitles);
    });
    void load();
    return remove;
  }, [load]);

  const editSubtitle = async (id: SubtitleId, title: string, language: Language) => {
    await runGuardedMutation(
      () => beforeLanguageChange?.(id, language),
      () => updateRegisteredSubtitle(id, { title, language })
    );
  };

  const updateDelay = async (id: SubtitleId, delay: number) => {
    await updateRegisteredSubtitle(id, { delay });
    const tabId = activeTab?.id;
    if (tabId === undefined) return;

    try {
      const response = await sendMessageToTab(tabId, 'refreshRegisteredSubtitle', {
        subtitleId: id,
      });
      if (!response.success) throw new Error(t('v2_local_subtitles_refresh_error'));
    } catch {
      modal.alert({ title: t('error'), message: t('v2_local_subtitles_refresh_error') });
      throw new Error(t('v2_local_subtitles_refresh_error'));
    }
  };

  const deleteSubtitle = (id: SubtitleId) => {
    modal.confirm({
      title: t('delete'),
      message: t('v2_local_subtitles_confirm_delete'),
      onConfirm: async () => {
        try {
          await runGuardedMutation(
            () => beforeDelete?.(id),
            () => deleteRegisteredSubtitle(id)
          );
        } catch {
          modal.alert({
            title: t('error'),
            message: t('v2_local_subtitles_delete_error'),
          });
        }
      },
    });
  };

  return {
    subtitles,
    unavailableSubtitles,
    editSubtitle,
    updateDelay,
    deleteSubtitle,
    loading,
    loadError,
    reload: load,
  };
}

export const runGuardedMutation = async <T>(
  prepare: () => void | SubtitleMutationRollback | Promise<void | SubtitleMutationRollback>,
  mutate: () => Promise<T>
) => {
  let rollback: SubtitleMutationRollback | undefined;
  try {
    const prepared = await prepare();
    rollback = typeof prepared === 'function' ? prepared : undefined;
    return await mutate();
  } catch (error) {
    try {
      await rollback?.();
    } catch {
      // The initiating failure remains authoritative; callers expose one recoverable error.
    }
    throw error;
  }
};
