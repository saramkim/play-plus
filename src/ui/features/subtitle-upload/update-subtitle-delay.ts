import { updateRegisteredSubtitle } from '@storage/registered-subtitle';
import { SubtitleId } from '@storage/subtitle';
import { getCoupangPlayVideoId } from '@utils/coupang-play';
import { sendMessageToTab } from '@utils/message';

import { useTabStore } from '@/ui/store/tab-store';

export class SubtitleDelayApplyError extends Error {}

export const updateSubtitleDelay = async (id: SubtitleId, delay: number, activeTab?: chrome.tabs.Tab | null) => {
  const tabId = activeTab?.id;
  const videoId = getCoupangPlayVideoId(activeTab?.url);
  const selection = useTabStore.getState().tabInfo;
  const primary = selection?.primarySubtitle === id;
  const secondary = selection?.secondarySubtitle === id;

  await updateRegisteredSubtitle(id, { delay });
  if (tabId === undefined || !videoId || activeTab?.active === false || (!primary && !secondary)) return 'stored';

  let timer: ReturnType<typeof setTimeout> | undefined;
  let expired = false;
  const checkTarget = async () => {
    const tab = await chrome.tabs.get(tabId);
    const current = useTabStore.getState();
    if (expired || !tab.active || getCoupangPlayVideoId(tab.url) !== videoId ||
      current.activeTab?.id !== tabId || getCoupangPlayVideoId(current.activeTab.url) !== videoId ||
      (current.tabInfo?.primarySubtitle === id) !== primary || (current.tabInfo?.secondarySubtitle === id) !== secondary) {
      throw new SubtitleDelayApplyError();
    }
  };
  try {
    await Promise.race([
      (async () => {
        await checkTarget();
        const response = await sendMessageToTab(tabId, 'updateSubtitleDelay', { subtitleId: id, delay, expectedVideoId: videoId });
        if (response?.success !== true) throw new SubtitleDelayApplyError();
        await checkTarget();
      })(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => { expired = true; reject(new SubtitleDelayApplyError()); }, 5000);
      }),
    ]);
    return 'applied';
  } catch {
    // Storage has succeeded. Never roll it back because current playback could not be confirmed.
    throw new SubtitleDelayApplyError();
  } finally {
    clearTimeout(timer);
  }
};
