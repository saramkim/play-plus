import { getLocalStorage } from '@storage/index';
import { addSavedSubtitleCard, SavedSubtitleLineInput } from '@storage/saved-subtitle';
import { SETTINGS, SubtitleSettingStorageKey } from '@utils/constants';
import { stripTags } from '@utils/helper';
import { t } from '@utils/i18n';

import { useToastStore } from '@/content/core/store/toast-store';
import { buildPlayerSavedSubtitleDraft } from '@/content/features/subtitle/saved-subtitle-card';
import { useSubtitleStore } from '@/content/features/subtitle/subtitle-store';

const { PRIMARY, SECONDARY } = SETTINGS.SUBTITLES;
type GetSubtitleElement = (key: SubtitleSettingStorageKey) => HTMLElement;

export function setupSubtitleSaveHandler(
  key: SubtitleSettingStorageKey,
  subtitleElement: HTMLElement,
  getSubtitleElement: GetSubtitleElement
) {
  const handleSubtitleClick = (event: MouseEvent) => {
    event.stopPropagation();
    saveSubtitleWithToast(key, getSubtitleElement);
  };

  subtitleElement.addEventListener('click', handleSubtitleClick);
}

export async function saveSubtitleWithToast(key: SubtitleSettingStorageKey, getSubtitleElement: GetSubtitleElement) {
  const { addToast } = useToastStore.getState();
  try {
    const subtitle = await saveSubtitle(key, getSubtitleElement);
    addToast('✔ ' + t('success_save_subtitle'), subtitle.primary.text);
  } catch (error) {
    addToast('✖ ' + t('error_save_subtitle'), (error as Error).message);
  }
}

async function saveSubtitle(key: SubtitleSettingStorageKey, getSubtitleElement: GetSubtitleElement) {
  const primaryElement = getSubtitleElement(PRIMARY.STORAGE_KEY);
  const secondaryElement = getSubtitleElement(SECONDARY.STORAGE_KEY);
  const triggerElement = getSubtitleElement(key);
  if (!getSnapshot(triggerElement)) throw new Error(t('error_no_subtitle'));

  const registeredSubtitles = (await getLocalStorage('registeredSubtitles')) ?? [];
  const { customSubtitleId, subtitleSettings } = useSubtitleStore.getState();
  const getLanguage = (role: SubtitleSettingStorageKey) => {
    const customId = customSubtitleId[role];
    if (customId) return registeredSubtitles.find(({ id }) => id === customId)?.language;
    return subtitleSettings[role].language;
  };
  const primary = getSnapshot(primaryElement, getLanguage(PRIMARY.STORAGE_KEY));
  const secondary = getSnapshot(secondaryElement, getLanguage(SECONDARY.STORAGE_KEY));
  const draft = buildPlayerSavedSubtitleDraft({ primary, secondary, url: window.location.href });
  const saved = await addSavedSubtitleCard(draft);

  if (!saved) throw new Error(t('error_duplicate_subtitle'));
  return saved;
}

const getSnapshot = (element: HTMLElement, language?: SavedSubtitleLineInput['language']) => {
  const text = stripTags(element.textContent || '');
  return text ? { text, language, startTime: Number(element.dataset.startTime ?? 0) } : undefined;
};
