import type { TabInfo } from '@storage/tab';
import type { V2RegisteredSubtitleMetadata, V2SyncStorage } from '@storage/v2/type';
import type { ContentBootstrap } from '@utils/message/type';

type SubtitleRoleReconciliationDependencies = {
  getLearningProfile: () => Promise<V2SyncStorage['learningProfile']>;
  getRegisteredSubtitles: () => Promise<V2RegisteredSubtitleMetadata[]>;
  getTabInfo: (tabId: number) => Promise<TabInfo | undefined>;
  updateTabInfo: (tabId: number, info: TabInfo) => Promise<unknown>;
};

export const reconcileTabSubtitleRoles = async (
  tabId: number,
  dependencies: SubtitleRoleReconciliationDependencies
): Promise<ContentBootstrap> => {
  const [profile, subtitles, tabInfo] = await Promise.all([
    dependencies.getLearningProfile(),
    dependencies.getRegisteredSubtitles(),
    dependencies.getTabInfo(tabId),
  ]);
  const subtitlesById = new Map(subtitles.map((subtitle) => [subtitle.id, subtitle]));
  const learningSubtitleId = validSelection(
    tabInfo?.learningSubtitleId,
    profile.learningLanguage,
    subtitlesById
  );
  const supportSubtitleId = validSelection(
    tabInfo?.supportSubtitleId,
    profile.supportLanguage,
    subtitlesById
  );

  if (
    learningSubtitleId !== (tabInfo?.learningSubtitleId ?? null) ||
    supportSubtitleId !== (tabInfo?.supportSubtitleId ?? null)
  ) {
    await dependencies.updateTabInfo(tabId, { learningSubtitleId, supportSubtitleId });
  }

  return { learningSubtitleId, supportSubtitleId };
};

const validSelection = (
  subtitleId: string | null | undefined,
  expectedLanguage: V2RegisteredSubtitleMetadata['language'] | null,
  subtitlesById: Map<string, V2RegisteredSubtitleMetadata>
) => {
  if (!subtitleId || expectedLanguage === null) return null;
  return subtitlesById.get(subtitleId)?.language === expectedLanguage ? subtitleId : null;
};
