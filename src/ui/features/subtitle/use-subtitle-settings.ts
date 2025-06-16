import { SubtitleId } from '@storage/subtitle';
import { updateTabInfo } from '@storage/tab';
import { SET_SUBTITLE_STORAGE_KEY_MAP, SetSubtitleAction } from '@utils/constants';
import { t } from '@utils/i18n';
import { sendMessage } from '@utils/message/index';
import { PLATFORM_URL_LIST } from '@utils/platform';

import { modal } from '@/ui/components/modal';

export function useSubtitleSettings(activeTab: chrome.tabs.Tab | null) {
  const useAsSubtitle = async (action: SetSubtitleAction, subtitleId: SubtitleId | null) => {
    const tabId = activeTab?.id;
    if (!tabId) return;

    const response = await sendMessage(action, { tabId, subtitleId });
    if (response.success) {
      updateTabInfo(tabId, { [SET_SUBTITLE_STORAGE_KEY_MAP[action]]: subtitleId });
    } else {
      modal.alert({ title: t('error'), message: response.message });
    }
  };

  return {
    useAsSubtitle,
    isAvailable: PLATFORM_URL_LIST.some((url) => activeTab?.url?.startsWith(url)),
  };
}
