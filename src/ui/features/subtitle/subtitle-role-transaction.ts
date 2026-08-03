import type { SubtitleId } from '@storage/subtitle';

import type {
  SubtitleRole,
  SubtitleRoleSelection,
} from '@/ui/features/subtitle/use-subtitle-settings';

export interface SelectedSubtitleRole {
  role: SubtitleRole;
  subtitleId: SubtitleId;
}

type ApplySubtitleRoleSelection = (selection: SubtitleRoleSelection) => Promise<boolean>;

export const clearSubtitleRolesWithRollback = async (
  selections: SelectedSubtitleRole[],
  applySelection: ApplySubtitleRoleSelection
) => {
  const cleared: SelectedSubtitleRole[] = [];
  const restore = async () => {
    for (const selection of [...cleared].reverse()) {
      const restored = await applySelection({
        role: selection.role,
        subtitleId: selection.subtitleId,
        previousSubtitleId: null,
      });
      if (!restored) throw new Error('Unable to restore a registered subtitle role');
    }
  };

  try {
    for (const selection of selections) {
      const succeeded = await applySelection({
        role: selection.role,
        subtitleId: null,
        previousSubtitleId: selection.subtitleId,
      });
      if (!succeeded) throw new Error('Unable to clear a registered subtitle role');
      cleared.push(selection);
    }
  } catch (error) {
    try {
      await restore();
    } catch {
      // The original failure remains authoritative; retained subtitles can be reselected manually.
    }
    throw error;
  }

  return restore;
};
