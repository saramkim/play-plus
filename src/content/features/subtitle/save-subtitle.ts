import { getLocalStorage, setLocalStorage } from '@storage/index';
import { REVIEW } from '@utils/constants';
import { stripTags } from '@utils/helper';
import { t } from '@utils/i18n';

import { useToastStore } from '@/content/core/store/toast-store';

export function setupSubtitleSaveHandler(subtitleElement: HTMLElement) {
  const handleSubtitleClick = (event: MouseEvent) => {
    event.stopPropagation();
    saveSubtitleWithToast(subtitleElement);
  };

  subtitleElement.addEventListener('click', handleSubtitleClick);
}

export async function saveSubtitleWithToast(subtitleElement: HTMLElement) {
  const { addToast } = useToastStore.getState();
  try {
    const subtitle = await saveSubtitle(subtitleElement);
    addToast(`✔ ${t('success_save_subtitle')}`, subtitle);
  } catch (error) {
    addToast(`✖ ${t('error_save_subtitle')}`, (error as Error).message);
  }
}

async function saveSubtitle(subtitleElement: HTMLElement) {
  const rawContent = subtitleElement.textContent || '';
  const content = stripTags(rawContent);
  const startTimeDataAttribute = subtitleElement.dataset[REVIEW.DATA_ATTRIBUTE.START_TIME];

  if (!content) throw new Error(t('error_no_subtitle'));

  const startTime = Number(startTimeDataAttribute || 0);
  const prevData = await getLocalStorage(REVIEW.STORAGE_KEY);
  const isDuplicated = prevData?.some(({ content: prevContent }) => prevContent === content);
  if (isDuplicated) throw new Error(t('error_duplicate_subtitle'));

  const data = { content, url: window.location.href, startTime, savedAt: new Date().toISOString() };
  await setLocalStorage(REVIEW.STORAGE_KEY, prevData ? [data, ...prevData] : [data]);

  return content;
}
