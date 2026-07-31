import { buildSavedSubtitleDraft, SavedSubtitleLineInput } from '@storage/saved-subtitle';

export interface PlayerSubtitleSnapshot extends SavedSubtitleLineInput {
  startTime: number;
}

interface BuildPlayerSavedSubtitleDraftInput {
  primary?: PlayerSubtitleSnapshot;
  secondary?: PlayerSubtitleSnapshot;
  url: string;
}

export const buildPlayerSavedSubtitleDraft = ({
  primary,
  secondary,
  url,
}: BuildPlayerSavedSubtitleDraftInput) => {
  return buildSavedSubtitleDraft({
    primary: toLine(primary),
    secondary: toLine(secondary),
    url,
    startTime: primary?.startTime ?? secondary?.startTime ?? 0,
  });
};

const toLine = (snapshot?: PlayerSubtitleSnapshot) => {
  if (!snapshot) return undefined;
  const { startTime: _, ...line } = snapshot;
  return line;
};
