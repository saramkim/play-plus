import { SubtitleId } from '@storage/subtitle';
import { updateTabInfo } from '@storage/tab';
import { COUPANG_PLAY_PLAY_URL, SET_SUBTITLE_STORAGE_KEY_MAP, SetSubtitleAction } from '@utils/constants';
import { t } from '@utils/i18n';
import { sendMessage } from '@utils/message';

import { MessagePopup } from '@/ui/components/message-popup';
import { usePopup } from '@/ui/contexts/popup-context';

export function useSubtitleSettings(activeTab: chrome.tabs.Tab | null) {
  const { showPopup, hidePopup } = usePopup();

  const useAsSubtitle = async (action: SetSubtitleAction, subtitleId: SubtitleId | null) => {
    const tabId = activeTab?.id;
    if (!tabId) return;

    const response = await sendMessage(action, { tabId, subtitleId });
    if (response.success) {
      updateTabInfo(tabId, { [SET_SUBTITLE_STORAGE_KEY_MAP[action]]: subtitleId });
    } else {
      showPopup({
        title: t('error'),
        content: <MessagePopup message={response.message} type='alert' hidePopup={hidePopup} />,
      });
    }
  };

  return {
    useAsSubtitle,
    isAvailable: activeTab?.url?.startsWith(COUPANG_PLAY_PLAY_URL) ?? false,
  };
}
