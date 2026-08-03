import { useCallback, useRef, useState } from 'react';

import { SubtitleId } from '@storage/subtitle';
import { TabInfo, updateTabInfo } from '@storage/tab';
import { V2SyncStorage } from '@storage/v2/type';
import { COUPANG_PLAY_BASE_URL, Language } from '@utils/constants';
import { t } from '@utils/i18n';
import { sendMessageToTab } from '@utils/message/index';
import { SubtitleRole as MessageSubtitleRole } from '@utils/message/type';

import { modal } from '@/ui/components/modal';

export type SubtitleRole = MessageSubtitleRole;
export type PendingSubtitleRoles = Record<SubtitleRole, boolean>;

export interface SubtitleRoleSelection {
  role: SubtitleRole;
  subtitleId: SubtitleId | null;
  previousSubtitleId: SubtitleId | null;
}

type SubtitleSettingsDependencies = {
  sendMessageToTab: (
    tabId: number,
    action: 'setSubtitleRole',
    params: { role: SubtitleRole; subtitleId: SubtitleId | null }
  ) => Promise<{ success: true } | { success: false; message: string }>;
  updateTabInfo: typeof updateTabInfo;
};

const ROLE_SESSION_KEY = {
  learning: 'learningSubtitleId',
  support: 'supportSubtitleId',
} as const satisfies Record<SubtitleRole, keyof TabInfo>;

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
  const response = await dependencies.sendMessageToTab(tabId, 'setSubtitleRole', {
    role: selection.role,
    subtitleId: selection.subtitleId,
  });
  if (!response.success) return response;

  try {
    await enqueueTabSessionUpdate(tabId, () =>
      dependencies.updateTabInfo(tabId, {
        [ROLE_SESSION_KEY[selection.role]]: selection.subtitleId,
      })
    );
  } catch (error) {
    try {
      await dependencies.sendMessageToTab(tabId, 'setSubtitleRole', {
        role: selection.role,
        subtitleId: selection.previousSubtitleId,
      });
    } catch {
      // The initiating failure remains authoritative; the caller presents a recoverable error.
    }
    throw error;
  }

  return response;
};

export const isSubtitleRoleLanguage = (
  role: SubtitleRole,
  language: Language,
  learningProfile: V2SyncStorage['learningProfile']
) => {
  const roleLanguage =
    role === 'learning' ? learningProfile.learningLanguage : learningProfile.supportLanguage;
  return roleLanguage !== null && language === roleLanguage;
};

export function useSubtitleSettings(
  activeTab: chrome.tabs.Tab | null,
  tabInfo: TabInfo | null,
  learningProfile: V2SyncStorage['learningProfile']
) {
  const [pendingRoles, setPendingRoles] = useState<PendingSubtitleRoles>({
    learning: false,
    support: false,
  });
  const pendingRolesRef = useRef(pendingRoles);
  const isAvailable = Boolean(
    activeTab?.url?.startsWith(COUPANG_PLAY_BASE_URL) &&
      tabInfo?.connectionStatus === 'connected' &&
      tabInfo.videoStatus === 'detected'
  );

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
      } catch {
        modal.alert({ title: t('error'), message: t('v2_local_subtitles_role_update_error') });
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
    isAvailable,
    isRoleAvailable: (role: SubtitleRole, language: Language) =>
      isAvailable && isSubtitleRoleLanguage(role, language, learningProfile),
  };
}
