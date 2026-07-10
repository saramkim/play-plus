import { stripTags } from '@utils/helper';
import { t } from '@utils/i18n';

import { useToastStore } from '@/content/core/store/toast-store';

export async function copySubtitleWithToast(subtitleElement: HTMLElement) {
  const { addToast } = useToastStore.getState();
  try {
    const subtitle = await copySubtitle(subtitleElement);
    addToast(`✔ ${t('success_copy_subtitle')}`, subtitle);
  } catch (error) {
    addToast(`✖ ${t('error_copy_subtitle')}`, (error as Error).message);
  }
}

async function copySubtitle(subtitleElement: HTMLElement) {
  const rawContent = subtitleElement.textContent || '';
  const content = stripTags(rawContent);

  if (!content) throw new Error(t('error_no_subtitle'));

  await navigator.clipboard.writeText(content);
  return content;
}
