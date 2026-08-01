import { useCallback, useRef, useState } from 'react';

import { SubtitleId } from '@storage/subtitle';
import { TabInfo, updateTabInfo } from '@storage/tab';
import {
  COUPANG_PLAY_BASE_URL,
  SET_SUBTITLE_ACTION,
  SET_SUBTITLE_STORAGE_KEY_MAP,
  SetSubtitleAction,
} from '@utils/constants';
import { t } from '@utils/i18n';
import { sendMessageToTab } from '@utils/message/index';

import { modal } from '@/ui/components/modal';

export type SubtitleRole = 'primary' | 'secondary';
export type PendingSubtitleRoles = Record<SubtitleRole, boolean>;

export interface SubtitleRoleSelection {
  role: SubtitleRole;
  subtitleId: SubtitleId | null;
  delay: number;
  previousSubtitleId: SubtitleId | null;
  previousDelay: number;
}

type SubtitleSettingsDependencies = {
  sendMessageToTab: (
    tabId: number,
    action: SetSubtitleAction,
    params: { subtitleId: SubtitleId | null; delay: number }
  ) => Promise<{ success: true } | { success: false; message: string }>;
  updateTabInfo: typeof updateTabInfo;
};

const ROLE_ACTION_MAP: Record<SubtitleRole, SetSubtitleAction> = {
  primary: SET_SUBTITLE_ACTION.SET_PRIMARY,
  secondary: SET_SUBTITLE_ACTION.SET_SECONDARY,
};

const defaultDependencies: SubtitleSettingsDependencies = {
  sendMessageToTab,
  updateTabInfo,
};

const tabSessionUpdateQueues = new Map<number, Promise<unknown>>();

const enqueueTabSessionUpdate = async (tabId: number, update: () => Promise<unknown>) => {
  const previousUpdate = tabSessionUpdateQueues.get(tabId) ?? Promise.resolve();
  const currentUpdate = previousUpdate.catch(() => undefined).then(update);
  tabSessionUpdateQueues.set(tabId, currentUpdate);

  try {
    await currentUpdate;
  } finally {
    if (tabSessionUpdateQueues.get(tabId) === currentUpdate) tabSessionUpdateQueues.delete(tabId);
  }
};

export const applySubtitleRoleSelection = async (
  tabId: number,
  selection: SubtitleRoleSelection,
  dependencies: SubtitleSettingsDependencies = defaultDependencies
) => {
  const action = ROLE_ACTION_MAP[selection.role];
  const response = await dependencies.sendMessageToTab(tabId, action, {
    subtitleId: selection.subtitleId,
    delay: selection.delay,
  });
  if (!response.success) return response;

  try {
    await enqueueTabSessionUpdate(tabId, () =>
      dependencies.updateTabInfo(tabId, {
        [SET_SUBTITLE_STORAGE_KEY_MAP[action]]: selection.subtitleId,
      })
    );
  } catch (error) {
    try {
      const rollback = await dependencies.sendMessageToTab(tabId, action, {
        subtitleId: selection.previousSubtitleId,
        delay: selection.previousDelay,
      });
      if (!rollback.success) console.error('Failed to roll back subtitle role:', rollback.message);
    } catch (rollbackError) {
      console.error('Failed to roll back subtitle role:', rollbackError);
    }
    throw error;
  }

  return response;
};

export function useSubtitleSettings(activeTab: chrome.tabs.Tab | null, tabInfo: TabInfo | null) {
  const [pendingRoles, setPendingRoles] = useState<PendingSubtitleRoles>({ primary: false, secondary: false });
  const pendingRolesRef = useRef(pendingRoles);

  const useAsSubtitle = useCallback(
    async (selection: SubtitleRoleSelection) => {
      if (pendingRolesRef.current[selection.role]) return false;

      pendingRolesRef.current = { ...pendingRolesRef.current, [selection.role]: true };
      setPendingRoles(pendingRolesRef.current);

      try {
        const tabId = activeTab?.id;
        if (tabId === undefined) return false;

        const response = await applySubtitleRoleSelection(tabId, selection);
        if (!response.success) {
          modal.alert({ title: t('error'), message: response.message });
          return false;
        }
        return true;
      } catch (error) {
        console.error('Failed to update subtitle role:', error);
        modal.alert({ title: t('error'), message: t('error_subtitle_role_update') });
        return false;
      } finally {
        pendingRolesRef.current = { ...pendingRolesRef.current, [selection.role]: false };
        setPendingRoles(pendingRolesRef.current);
      }
    },
    [activeTab?.id]
  );

  return {
    useAsSubtitle,
    pendingRoles,
    isAvailable: Boolean(
      activeTab?.url?.startsWith(COUPANG_PLAY_BASE_URL) &&
        tabInfo?.connectionStatus === 'connected' &&
        tabInfo.videoStatus === 'detected'
    ),
  };
}
