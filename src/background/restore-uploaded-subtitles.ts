import { getTabInfo, updateTabInfo } from '@storage/tab';
import { sendMessageToTab } from '@utils/message';

export const restoreUploadedSubtitles = async (tabId: number) => {
  const info = await getTabInfo(tabId);
  const selected = {
    primarySubtitle: info?.primarySubtitle ?? null,
    secondarySubtitle: info?.secondarySubtitle ?? null,
  };
  const result = await sendMessageToTab(tabId, 'restoreUploadedSubtitles', selected);
  if (!result.success) throw new Error(result.message);
  // Keep a newer panel selection; only reconcile the snapshot sent for restoration.
  await updateTabInfo(tabId, async (current) => ({
    ...((current.primarySubtitle ?? null) === selected.primarySubtitle ? { primarySubtitle: result.data.primarySubtitle } : {}),
    ...((current.secondarySubtitle ?? null) === selected.secondarySubtitle ? { secondarySubtitle: result.data.secondarySubtitle } : {}),
  }));
};
